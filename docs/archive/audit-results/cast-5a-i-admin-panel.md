# CAST 5a-i: Admin panel - auth, data provider, storage, audit trail, security

**Datum:** 2026-02-18
**Auditor:** Claude Opus 4.6 (automatizovany audit)
**Scope:** MFA enforcement, Supabase client config, Storage upload validace, Stripe sync auth, hardcoded secrets, .env handling, audit trail, security headers
**Status:** READ-ONLY audit, zadne fixy

---

## Souhrnna tabulka nalezu

| # | Nalez | Severity | Soubor |
|---|-------|----------|--------|
| 1 | `.env.local` s anon key neni v `.gitignore` historii overena | MEDIUM | `.env.local`, `.gitignore` |
| 2 | Env variable naming nekonzistence (API_KEY vs ANON_KEY) | LOW | `.env`, `src/App.tsx`, `src/supabaseClient.ts` |
| 3 | Zadna runtime validace env variables | MEDIUM | `src/supabaseClient.ts`, `src/App.tsx` |
| 4 | Storage upload: zadna validace typu a velikosti souboru | HIGH | `src/utils/storageUtils.ts`, `src/dataProvider/withStorageUpload.ts` |
| 5 | Stripe sync: edge function `create-stripe-product` nema auth | HIGH | `src/dataProvider/withStripeSync.ts` (cross-ref Cast 4) |
| 6 | MFA enforcement: spravne implementovano | PASS | `src/auth/MFAWrapper.tsx` |
| 7 | Zadny admin audit trail (logovani CRUD operaci) | HIGH | cely admin panel |
| 8 | Chybejici security headers (CSP, HSTS) | MEDIUM | chybi `vercel.json` |
| 9 | Role-based access: jen identity fetch, zadne enforcement | MEDIUM | `src/App.tsx` |
| 10 | Console.log/error v produkcnim kodu | LOW | `withStripeSync.ts`, `withStorageUpload.ts`, `Dashboard.tsx` |

---

## 1. MFA Enforcement

**Severity: PASS**

### Analyza

MFA je spravne vynuceno pro vsechny admin ucty. Implementace pouziva 3 soubory:

**`src/auth/MFAWrapper.tsx`** - Hlavni wrapper:
- Kontroluje AAL (Authenticator Assurance Level) pres `supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel()`
- Pokud uzivatel nema MFA: presmerovani na `MFAEnrollPage`
- Pokud AAL je `aal1` a `nextLevel` je `aal2`: presmerovani na `MFAVerifyPage`
- Pouze `aal2` = pristup do admin panelu
- Fail-closed: pri chybe defaultuje na `needsEnroll` (radek 57)
- Reaguje na auth state changes (`SIGNED_IN`, `TOKEN_REFRESHED`)

**`src/Layout.tsx`** - MFAWrapper obaluje cely Layout:
```tsx
<MFAWrapper>
  <RALayout>{children}</RALayout>
</MFAWrapper>
```

**`src/auth/MFAEnrollPage.tsx`** - Enrollment:
- Osetruje StrictMode double-render pres `useRef` (radek 24)
- Spravne unenrolluje stare unverified faktory pred novym enrollmentem
- Zobrazuje QR kod + manualni secret pro backup

**`src/auth/MFAVerifyPage.tsx`** - Verifikace:
- Challenge-response flow (challenge → verify)
- Input validace: 6 cislic, regex sanitizace (`/\D/g`)
- Neni rate-limited na klientu (ale Supabase Auth ma server-side rate limiting)

### Hodnoceni

MFA implementace je solidni. Zadny zpusob jak obejit MFAWrapper - je v Layout, ktery obaluje vsechny resource stranky. `requireAuth` prop na `<Admin>` zajistuje ze neprihlaseni uzivatele se nedostanou ani k MFA wrapperu.

---

## 2. Supabase Client Config

**Severity: MEDIUM** (kombinace vice mensich problemu)

### 2a. Env variable naming nekonzistence

**Severity: LOW**

**`.env` (sablona):**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_API_KEY=
```

**`src/supabaseClient.ts` a `src/App.tsx`:**
```typescript
const VITE_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

**`.env.local` (skutecne pouzite):**
```
VITE_SUPABASE_ANON_KEY=eyJ...
```

Problem: `.env` sablona uvadi `VITE_SUPABASE_API_KEY`, ale kod pouziva `VITE_SUPABASE_ANON_KEY`. Novy vyvojar pouzijici `.env` sablonu by mel undefined promenne.

### 2b. Zadna runtime validace env variables

**Severity: MEDIUM**

`src/supabaseClient.ts`:
```typescript
const VITE_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const VITE_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseClient = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);
```

Pokud env vars chybi, `createClient` dostane `undefined` jako URL i key. Supabase JS klient v tomto pripade muze selhat s neprehlednou chybou az pri prvnim API callu, ne pri startu.

**Doporuceni:**
```typescript
if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
  throw new Error('Missing required environment variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
}
```

### 2c. .env handling

**Severity: MEDIUM**

`.gitignore` spravne obsahuje:
```
.env
.env.local
.env*.local
```

`.env.local` obsahuje skutecny anon key (JWT token). Anon key je designovan jako verejny (je v kazdem klientskem requestu), ale:
- Obsahuje Supabase project ref v payloadu
- Je pouzit v `<Admin>` konfiguraci, ktera je client-side
- **NENI** bezpecnostni riziko samo o sobe, ale `.env.local` by nemela byt v git historii

**Doporuceni:** Overit `git log --all --diff-filter=A -- .env.local` zda soubor nebyl nikdy commitnut.

---

## 3. Storage Upload Validace

**Severity: HIGH**

### 3a. Zadna validace typu souboru

**`src/utils/storageUtils.ts`** - funkce `uploadFile`:
```typescript
export async function uploadFile(bucket: string, file: File, path?: string): Promise<UploadResult> {
  const uniquePath = path || generateUniqueFileName(file);
  const { data, error } = await supabaseClient.storage
    .from(bucket)
    .upload(uniquePath, file, {
      cacheControl: "3600",
      upsert: false,
    });
  // ...
}
```

**Chybejici validace:**
1. **MIME type** - zadna kontrola zda je soubor skutecne obrazek (pro `products-images`, `blog-images`) nebo PDF (pro `products-pdfs`)
2. **Velikost souboru** - zadny limit na klientu
3. **Nazev souboru** - `generateUniqueFileName` bere extension z originalniho nazvu bez sanitizace
4. **Content sniffing** - nekontroluje se skutecny obsah souboru (magic bytes)

**`src/dataProvider/withStorageUpload.ts`** - jedina "validace":
```typescript
if (data.image && data.image.rawFile instanceof File) {
```
Kontroluje jen zda je to `File` objekt, ne typ obsahu.

**Mozne utoky:**
- Upload executable souboru s `.jpg` priponou do public bucketu `products-images`
- Upload velkych souboru (DoS)
- Upload HTML souboru ktere by mohly byt servovany z Supabase Storage domeny

**Poznamka:** Supabase Storage sam o sobe NEprovadi content-type validaci na urovni bucketu (pokud to neni konfigurovano). RLS policies na storage kontroluji jen autentizaci, ne obsah.

**Doporuceni:**
```typescript
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_PDF_TYPES = ['application/pdf'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB

function validateFile(file: File, bucket: string): void {
  const allowedTypes = bucket.includes('pdf') ? ALLOWED_PDF_TYPES : ALLOWED_IMAGE_TYPES;
  const maxSize = bucket.includes('pdf') ? MAX_PDF_SIZE : MAX_IMAGE_SIZE;

  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Invalid file type: ${file.type}`);
  }
  if (file.size > maxSize) {
    throw new Error(`File too large: ${file.size} bytes (max ${maxSize})`);
  }
}
```

### 3b. Bucket name validace

Funkce `uploadFile` akceptuje libovolny `bucket` string jako parametr. V praxi je kontrolovan jen v `withStorageUpload.ts` kde se pouzivaji hardcoded nazvy (`products-images`, `products-pdfs`, `blog-images`), ale funkce sama nevaliduje povolene buckety.

---

## 4. Stripe Sync Auth

**Severity: HIGH** (cross-ref s Cast 4, Issue #3)

### Analyza

**`src/dataProvider/withStripeSync.ts`** vola edge function `create-stripe-product`:
```typescript
const { data, error } = await supabaseClient.functions.invoke(
  "create-stripe-product",
  {
    body: {
      title: product.title,
      description: product.description || "",
      price: product.price,
      image_url: product.image_url || undefined,
      product_id: product.id,
    },
  },
);
```

`supabaseClient.functions.invoke` automaticky posila Authorization header s JWT tokenem prihlaseneho uzivatele. **ALE** jak bylo zjisteno v Cast 4 auditu, edge function `create-stripe-product` tento JWT **IGNORUJE** a neprovadi zadnou autentizaci ani autorizaci.

**Dopady z pohledu admin panelu:**
1. Admin panel posila data do edge function bez overeni na strane serveru
2. Kdokoliv s anon key muze volat edge function primo a vytvorit/upravit Stripe produkty
3. Admin panel nema zpetnou vazbu zda edge function overila admin roli

**Doporuceni (strana admin panelu):**
- Neni co fixovat na strane admin panelu - fix musi byt v edge function
- Edge function musi overit JWT a zkontrolovat admin roli

### Stripe sync error handling

Pozitivni nalez: `withStripeSync.ts` spravne neblokuje CRUD operace pri selhani Stripe sync:
```typescript
// Don't throw - product was created, just Stripe sync failed
return result;
```

Ale chybi:
- Notifikace uzivateli ze Stripe sync selhal (jen `console.error`)
- Retry mechanismus
- Zpusob jak rucne re-syncnout produkt se Stripe

---

## 5. Role-Based Access Control

**Severity: MEDIUM**

### Analyza

`src/App.tsx` - authProvider fetchuje roli uzivatele:
```typescript
const authProvider = supabaseAuthProvider(supabaseClient, {
  getIdentity: async (user) => {
    const { data, error } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    // ...
    return { id: user.id, fullName: user.email, role: data.role };
  },
});
```

**Problem:** Role se fetchuje a uklada do identity, ale NIKDE se nepouziva pro:
1. **Skryti/zobrazeni resources** na zaklade role
2. **React Admin permissions** (`usePermissions`, `canAccess`)
3. **Kontrolu pred CRUD operacemi**

Vsichni prihlaseni uzivatele s MFA maji pristup ke VSEM resources (products, orders, customers, blog_posts, categories, custom_itinerary_requests).

**Oslabujici faktor:** Bezpecnost je aktualne zajistena na urovni:
1. Supabase Auth + MFA (pouze overeni uzivatele s MFA se dostanou dovnitr)
2. RLS policies s `is_admin()` kontrolou (server-side enforcement)

Takze i kdyz admin panel neimplementuje client-side RBAC, server-side RLS policies zajistuji ze ne-admin uzivatele nemohou provadet admin operace. Ale:
- UI zobrazuje vsechny resources vsem uzivatelum (matouci pro ne-admin uzivatele, pokud by existovali)
- Chybove hlasky pri RLS denial nejsou user-friendly

---

## 6. Admin Audit Trail

**Severity: HIGH**

### Analyza

**Zadny audit trail pro admin operace.** Admin panel nepouziva:
- React Admin `useAuditLogger` (k dispozici v ra-audit-log - enterprise feature)
- Custom audit middleware v data provideru
- Logovani do `integration_logs` tabulky (ta je pouzivana jen pro Stripe webhook eventy)

**Co NENI logovano:**
- Kdo vytvoril/upravil/smazal produkt
- Kdo zmenil objednavku (status, castku)
- Kdo pristupoval k udajum zakazniku (GDPR relevantni!)
- Kdo uploadoval/smazal soubory ze Storage
- Kdo menil blog posty

**Co JE k dispozici:**
- Supabase Auth audit log (`auth.audit_log_entries`) - zaznamenava login/logout/MFA eventy
- Supabase `updated_at` sloupce na tabulkach - ale bez informace KDO zmenil

**GDPR dopad:** Bez audit trailu neni mozne dosledne odpovidat na GDPR dotazy typu "kdo pristupoval k udajum zakaznika X a kdy?"

**Doporuceni:**
1. Pridat `modified_by` sloupec do klicovych tabulek (products, orders, customers, blog_posts)
2. Implementovat trigger ktery automaticky vyplnuje `modified_by = auth.uid()` pri UPDATE
3. Alternativne: pridat audit logging do data provider wrapperu:
```typescript
export function withAuditLog(dataProvider: DataProvider): DataProvider {
  return {
    ...dataProvider,
    update: async (resource, params) => {
      const result = await dataProvider.update(resource, params);
      await supabaseClient.from('admin_audit_log').insert({
        user_id: (await supabaseClient.auth.getUser()).data.user?.id,
        action: 'update',
        resource,
        record_id: params.id,
        changes: JSON.stringify(params.data),
        timestamp: new Date().toISOString(),
      });
      return result;
    },
    // ... analogicky pro create, delete
  };
}
```

---

## 7. Security Headers

**Severity: MEDIUM**

### Analyza

Admin panel **NEMA** soubor `vercel.json` s security headers. Hledani v projektu neodhalilo zadnou konfiguraci headers.

**Chybejici headers:**
1. **Content-Security-Policy (CSP)** - bez CSP je admin panel zranitelny vuci XSS utokum
2. **Strict-Transport-Security (HSTS)** - chybi vynuceni HTTPS
3. **X-Content-Type-Options: nosniff** - chybi prevence MIME type sniffing
4. **X-Frame-Options: DENY** - chybi prevence clickjacking
5. **Referrer-Policy** - chybi kontrola referrer headeru

**Doporuceni:** Vytvorit `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://*.supabase.co data:; connect-src 'self' https://*.supabase.co https://api.stripe.com; frame-ancestors 'none';" }
      ]
    }
  ]
}
```

---

## 8. Hardcoded Secrets

**Severity: PASS**

### Analyza

Grep pres cely `src/` adresar na vzory `supabase.co`, `eyJ`, `sk_live`, `sk_test`, `service_role`, `secret`, `password`, `apikey`:

**Vysledky:**
- `src/App.tsx:79: apiKey: VITE_SUPABASE_ANON_KEY` - pouziva env var, ne hardcoded (OK)
- `src/auth/MFAEnrollPage.tsx:18: const [secret, setSecret]` - lokalni state pro TOTP secret, ne hardcoded (OK)
- `src/utils/storageUtils.ts:130,137` - komentare s prikladem URL formatu (OK)

**Zadne hardcoded secrets v kodu.** Vsechny tajne hodnoty prichazeji z env variables.

**`.env` (sablona):** Prazdne hodnoty - OK
**`.env.local`:** Obsahuje anon key (ocekavane, je v `.gitignore`)

---

## 9. Dashboard - Overfetching

**Severity: LOW**

`src/dashboard/Dashboard.tsx`:
```typescript
const { data: orders } = await dataProvider.getList("orders", {
  pagination: { page: 1, perPage: 1000 },
  // ...
});
const { data: customers } = await dataProvider.getList("customers", {
  pagination: { page: 1, perPage: 1000 },
  // ...
});
```

Fetchuje az 1000 objednavek a 1000 zakazniku na dashboard. Pri rustuji databazi to muze byt:
- Pomale
- Zbytecne velky data transfer
- Potencialni DoS vektor (kazde otevreni dashboardu = 2 velke dotazy)

**Doporuceni:** Pouzit SQL aggregate dotazy (COUNT, SUM) misto fetchovani vsech zaznamu. Idealne pres Supabase RPC funkci.

---

## 10. Console Logging v Produkci

**Severity: LOW**

Nasledujici soubory pouzivaji `console.log`/`console.error`/`console.warn`:

- `withStripeSync.ts` - 8x `console.log`, 3x `console.error`
- `withStorageUpload.ts` - 4x `console.error`, 3x `console.warn`
- `Dashboard.tsx` - 1x `console.error`
- `MFAWrapper.tsx` - 1x `console.error`

V produkcnim prostredi to muze leakovat informace o Stripe operacich a chybach do browser konzole.

**Doporuceni:** Podmink logovani na `VITE_DEBUG` env var, nebo pouzit Vite `define` k odstraneni console.* v produkcnim buildu.

---

## Celkove hodnoceni

### Pozitivni nalezy
1. **MFA enforcement je spravne implementovano** - fail-closed, v Layout wrapperu, reaguje na auth state changes
2. **Zadne hardcoded secrets** - vsechny env vars
3. **`requireAuth` je zapnuty** na React Admin
4. **Stripe sync neselhava blokujicim zpusobem** - CRUD operace pokracuji i pri Stripe erroru
5. **.gitignore spravne vylucuje .env soubory**
6. **Supabase client pouziva anon key** (ne service_role)

### Kriticke akce (prioritizovane)

| Priorita | Akce | Effort |
|----------|------|--------|
| 1 | Pridat validaci typu a velikosti souboru do `uploadFile` | Nizky |
| 2 | Pridat auth + admin kontrolu do edge function `create-stripe-product` | Stredni |
| 3 | Implementovat admin audit trail (min. modified_by sloupce) | Stredni |
| 4 | Pridat `vercel.json` se security headers | Nizky |
| 5 | Pridat runtime validaci env variables | Nizky |
| 6 | Sjednotit env variable naming (.env sablona vs kod) | Nizky |
| 7 | Nahradit dashboard overfetching SQL aggregates | Stredni |
| 8 | Implementovat RBAC v admin panelu (pokud budou vice roli) | Vyssi |

---

## Cross-reference s predchozimi audity

| Nalez v Cast 5a-i | Souvisejici nalez | Cast |
|-------------------|-------------------|------|
| Stripe sync bez auth | create-stripe-product bez autorizace | Cast 4, Issue #3 (HIGH) |
| Storage upload bez validace | Storage RLS policies | Cast 2a |
| Chybejici audit trail | integration_logs jen pro Stripe | Cast 4 |
| Security headers | CORS wildcard na edge functions | Cast 4 (CRITICAL) |
