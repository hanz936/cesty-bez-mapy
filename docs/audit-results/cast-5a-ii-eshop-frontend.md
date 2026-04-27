# CAST 5a-ii: E-shop frontend bezpecnost

**Datum:** 2026-02-18
**Scope:** Frontend e-shopu (cesty-bez-mapy) - autentizace, checkout, kosik, download, formulare, XSS, Supabase keys
**Auditor:** Claude Opus 4.6

---

## Souhrnne hodnoceni

| Oblast | Hodnoceni | Poznamka |
|--------|-----------|----------|
| Anonymous auth flow | OK s vyhodou | Spravne pouziti signInAnonymously |
| Checkout user_id handling | STREDNI RIZIKO | user_id posilany v request body |
| Cart manipulation / price tampering | NIZKE RIZIKO | Ceny revalidovany server-side pres Stripe |
| Download URL handling | OK | Token-based pres Edge Function |
| XSS prevence | NIZKE RIZIKO | React JSX escapuje automaticky, 1x dangerouslySetInnerHTML |
| Supabase key handling | OK | Pouzit anon key, ne service_role |
| Security headers | KRITICKE | E-shop nema ZADNE security headers |
| CAPTCHA / spam ochrana | STREDNI RIZIKO | Chybi na vsech formularich |
| Console.log v produkci | NIZKE RIZIKO | Mnoho console.log/error volani |

---

## 1. Anonymous auth flow

### Checkout.jsx (radky 100-115)

```jsx
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
  if (anonError) {
    console.error('Anonymous sign-in error:', anonError);
  } else {
    userId = anonData.user?.id;
  }
} else {
  userId = user.id;
}
```

**Hodnoceni: OK**
- Spravne pouziva `getUser()` (serverovy check) misto `getSession()` (lokalni cache)
- Anonymni prihlaseni je fallback pro neprihlasene uzivatele
- user_id se ziskava ze Supabase auth odpovedi, ne z klientskych dat

### CustomItineraryForm.jsx (radky 101-127)

```jsx
const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
if (sessionError || !sessionData.session) {
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously({ ... });
  userId = authData.user.id;
} else {
  userId = sessionData.session.user.id;
}
```

**Hodnoceni: NIZKE RIZIKO**
- Pouziva `getSession()` misto `getUser()` - getSession cte z lokalni cache a muze byt zastaraly
- **Doporuceni:** Zmenit na `supabase.auth.getUser()` pro konzistenci s Checkout.jsx

### Race condition

- Oba soubory (Checkout + CustomItineraryForm) mohou volat `signInAnonymously()` nezavisle
- Pokud uzivatel rychle prepne mezi formularem a checkoutem, mohou vzniknout duplicitni anonymni sessiony
- **Dopad:** Nizky - Supabase handluje race conditions na urovni auth serveru

---

## 2. Checkout flow - user_id handling

### Soubor: `/src/pages/Checkout.jsx` (radky 118-137)

```jsx
const lineItems = cartItems.map(item => ({
  product_id: item.id,
  quantity: item.quantity || 1,
  custom_itinerary_request_id: item.customItineraryRequestId || null,
}));

const { data, error: fnError } = await supabase.functions.invoke('create-checkout-session', {
  body: {
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    user_id: userId,    // <-- user_id v request body
  },
});
```

**Hodnoceni: STREDNI RIZIKO**
- `user_id` je posilany v request body do Edge Function
- Utocnik muze teoreticky zmenit `user_id` na jine UUID (napr. pres browser DevTools)
- **Zmirneneni:** Edge Function `create-checkout-session` by mela overovat, ze `user_id` v body odpovida JWT tokenu ze Supabase auth headeru
- **Cross-ref:** Viz cast-4-edge-functions.md - overit zda Edge Function validuje JWT claims vs body.user_id
- **Doporuceni:** Edge Function by mela IGNOROVAT `user_id` z body a pouzit `user.id` z JWT tokenu

### product_id spoofing

- `product_id` pochazi z client-side `cartItems` - utocnik muze nastavit libovolne product_id
- **Zmirneneni:** Edge Function musi overit existenci produktu a nacist cenu z databaze (ne z klienta)
- Frontend NEPOSILA ceny do Edge Function - to je spravne

### custom_itinerary_request_id

- Pochazi z klientskeho stavu (CartContext -> localStorage)
- Utocnik muze zmenit na jiny request_id
- **Doporuceni:** Edge Function by mela overit, ze request_id patri danemu user_id

---

## 3. Cart manipulation / price tampering

### Soubor: `/src/contexts/CartContext.jsx`

**Ulozeni:** localStorage pod klicem `cbm_cart`

```jsx
const newItem = {
  id: product.id,
  title: product.title,
  price: product.price,      // <-- cena z klientskych dat
  image: product.image_url || product.image,
  alt: product.alt || `Pruvodce: ${product.title}`,
  duration: product.duration || '',
  slug: product.slug,
  quantity: 1,
  customItineraryRequestId: product.customItineraryRequestId || null,
};
```

**Hodnoceni: NIZKE RIZIKO (spravne zmirneno)**

- Ceny jsou ulozeny v localStorage a zobrazeny na frontendu
- Utocnik muze ceny v localStorage modifikovat
- **ALE:** Frontend NEPOSILA ceny do Edge Function `create-checkout-session` - posila pouze `product_id` a `quantity`
- Stripe Checkout Session se vytvari na serveru s cenami z databaze (pres `stripe_price_id`)
- **Vysledek:** Price tampering na frontendu ovlivni pouze zobrazeni, ne skutecnou platbu

**Validace v CartContext:**
- [x] Kontrola `product.id` existuje pred pridanim
- [x] Max 1 ks od kazdeho produktu (duplikace kontrola)
- [x] Validace Array.isArray pri nacitani z localStorage
- [ ] Chybi sanitizace dat z localStorage (mohl by obsahovat XSS payload v `title`)

---

## 4. Download URL handling

### Soubor: `/src/pages/OrderConfirmation.jsx` (radky 199-261)

```jsx
// Token se ziskava z Edge Function get-order-by-session
setDownloadToken(data.download_token);

// Stazeni PDF
const { data, error: fnError } = await supabase.functions.invoke('get-download-url', {
  body: { token: downloadToken },
});

if (data.downloads) {
  const download = data.downloads.find(d => d.product_id === productId);
  if (download) {
    window.open(download.download_url, '_blank');
  }
}
```

**Hodnoceni: OK**
- Download token se ziskava ze serveru, ne z URL parametru
- Token se posila zpet do Edge Function `get-download-url` pro validaci
- Frontend nemanipuluje s download URL primo - dostava ho ze serveru
- `session_id` z URL query parametru (`?session_id=...`) se posila do Edge Function pro overeni
- **Poznamka:** Download URL je casove omezeny (7 dni dle UI textu)
- **Doporuceni:** Overit v Edge Function, ze `download_token` je kryptograficky bezpecny a expiruje

---

## 5. XSS prevence

### React JSX auto-escaping

Vsechny soubory pouzivaji standardni React JSX syntaxi `{variable}`, ktera automaticky escapuje HTML entity. Toto platne pro:
- `Checkout.jsx` - `{item.title}`, `{item.price.toLocaleString()}`
- `OrderConfirmation.jsx` - `{order?.customer_name}`, `{order?.customer_email}`, `{item.title}`
- `CustomItineraryPreview.jsx` - `{request.customer_name}`, `{formData.vacation_type.join(', ')}`
- `CartContext.jsx` - data se renderuji az v komponentach pres JSX

### dangerouslySetInnerHTML

**Soubor:** `/src/components/layout/Footer.jsx` (radek 221)

```jsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Cesty (bez) mapy",
      "url": currentOrigin,
      ...
    })
  }}
/>
```

**Hodnoceni: NIZKE RIZIKO**
- Pouzito pro JSON-LD structured data ve `<script>` tagu
- Data jsou staticka (hardcoded) krome `currentOrigin` (`window.location.origin`)
- `JSON.stringify()` escapuje specialni znaky
- **Poznamka:** `window.location.origin` je bezpecny - prohlizec ho kontroluje

### CustomItineraryPreview.jsx - JSONB data rendering

```jsx
const formData = request.form_data || {};
// ...
<span className="font-semibold">Konkretni destinace:</span> {formData.specific_destination}
```

**Hodnoceni: OK (s poznamkou)**
- JSONB data z databaze se renderuji pres React JSX - automaticky escapovane
- I kdyz utocnik vlozi `<script>alert('xss')</script>` do formulare, React to escapuje
- **Poznamka:** Data z `form_data` JSONB se primo renderuji bez jakekoli sanitizace na serveru, ale React to kompenzuje na frontendu

---

## 6. Supabase key handling

### Soubor: `/src/lib/supabase.js`

```jsx
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Hodnoceni: OK**
- [x] Pouzit `VITE_SUPABASE_ANON_KEY` - spravne, anon key
- [x] Runtime validace ze env vars existuji
- [x] Zadny `service_role` key v klientskem kodu (overeno grepem)
- [x] `.env`, `.env.local` a vsechny varianty v `.gitignore`
- **Poznamka:** `.env.example` obsahuje komentovany `SUPABASE_SERVICE_ROLE_KEY` s poznamkou "only for server-side" - to je OK, je to jen sablona

### testConnection.js - INFO LEAK

```jsx
console.log('Project URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Anon key configured:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Yes' : 'No')
```

**Hodnoceni: NIZKE RIZIKO**
- Loguje Supabase URL do konzole (verejne dostupna informace - viditelne v network requestech)
- Anon key neni logovan primo (jen Yes/No)
- **Doporuceni:** Odstranit testConnection.js z produkce nebo podminkovat za `VITE_DEBUG`

---

## 7. Security headers - KRITICKE

### Soubor: `/vercel.json`

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "git": { "deploymentEnabled": { "main": false } }
}
```

**Hodnoceni: KRITICKE - ZADNE SECURITY HEADERS**

E-shop nema ZADNE security headers. Chybi:

| Header | Status | Dopad |
|--------|--------|-------|
| Content-Security-Policy | CHYBI | XSS, inline script injection |
| X-Content-Type-Options | CHYBI | MIME type sniffing |
| X-Frame-Options | CHYBI | Clickjacking |
| X-XSS-Protection | CHYBI | Reflektovane XSS (legacy prohlizece) |
| Referrer-Policy | CHYBI | URL leakage pri navigaci |
| Permissions-Policy | CHYBI | Neopravneny pristup ke kamepe/mikrofonu |
| Strict-Transport-Security | CHYBI | Downgrade utok na HTTP |

**Doporuceni: OKAMZITE pridat do `vercel.json`:**

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' https://*.supabase.co data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-src https://js.stripe.com; object-src 'none'; base-uri 'self'" }
      ]
    }
  ]
}
```

---

## 8. CAPTCHA / spam ochrana

**Hodnoceni: STREDNI RIZIKO**

### CustomItineraryForm.jsx

```jsx
// TODO: Add Cloudflare Turnstile spam protection when site keys are available
// import { Turnstile } from '@marsidev/react-turnstile';
```

- Formular umoznuje vlozeni do databaze bez CAPTCHA
- Utocnik muze automatizovane submitovat tisice pozadavku
- RLS pro INSERT do `custom_itinerary_requests` vyzaduje auth (anonymous staci)
- **Dopad:** Spam pozadavky, zbytecna zatez na databazi

### Contact.jsx

- Formular sbira jmeno, email, zpavu - ale aktualne **data neposila** (simulovany submit)
- **Poznamka:** Az bude napojeny na backend, pridat CAPTCHA

### Checkout.jsx

- Checkout nevyzaduje CAPTCHA - ale to je standardni (Stripe ma vlastni ochranu)

---

## 9. Console.log volani v produkci

**Hodnoceni: NIZKE RIZIKO**

Nalezeno **28+ console.log/error volani** napric zdrojovym kodem:

- `CartContext.jsx`: 5x console.log (kosik operace)
- `Checkout.jsx`: 2x console.error
- `OrderConfirmation.jsx`: 3x console.error
- `CustomItineraryForm.jsx`: 3x console.error
- `CustomItineraryPreview.jsx`: 3x console.error
- `TravelGuides.jsx`: 2x console.error
- `testConnection.js`: 7x console.log/error (vcetne Supabase URL)

**Doporuceni:**
- Pouzit existujici `src/utils/logger.js` konzistentne (uz existuje, ale neni pouzivan vsude)
- Odstranit `console.log` v CartContext (lekuji informace o kosiku)
- V produkci potlacit debug logy

---

## 10. CustomItineraryPreview.jsx - IDOR riziko

### Soubor: `/src/pages/CustomItineraryPreview.jsx` (radky 20-52)

```jsx
const { id } = useParams();
// ...
const { data, error: fetchError } = await supabase
  .from('custom_itinerary_requests')
  .select('*')
  .eq('id', id)
  .single();
```

**Hodnoceni: STREDNI RIZIKO**
- Stranka nacita custom itinerary request podle UUID z URL
- UUID je tezke uhodnout (122 bitu entropie)
- **ALE:** Zadna kontrola ze request patri prihlasenenmu uzivateli
- RLS politika by mela omezit pristup - **overit v cast-2a-rls-inventory.md**
- `select('*')` - nacita vsechna pole vcetne potencialne citlivych dat (jmeno, email, formularova data)
- **Doporuceni:** Overit RLS politiku pro `custom_itinerary_requests` SELECT

### Produkt nacitani

```jsx
const { data } = await supabase
  .from('products')
  .select('id, title, price, slug, stripe_price_id, image_url, duration')
  .eq('slug', 'itinerar-na-miru')
  .eq('is_active', true)
  .eq('is_deleted', false)
  .single();
```

**Hodnoceni: OK**
- Explicitni select (ne `select('*')`) - spravne
- Filtruje na `is_active` a `is_deleted` - spravne

---

## 11. Dalsi stranky

### ProductDetail.jsx, TravelGuides.jsx

- Nacitaji produkty z `products` tabulky pres Supabase
- Pouzivaji RLS - anonymni uzivatele mohou cist pouze aktivni produkty
- Ceny pochazi z databaze, ne z klientskych dat

### Contact.jsx

- Formular aktualne NEPOSILA data (simulovany `setTimeout`)
- **Poznamka:** Az bude napojeny na backend, pridat validaci a CAPTCHA

---

## Souhrnna tabulka nalezu

| # | Nalez | Zavaznost | Soubor | Doporuceni |
|---|-------|-----------|--------|------------|
| F1 | Zadne security headers v produkci | KRITICKE | `vercel.json` | Pridat kompletni sadu security headers |
| F2 | user_id z request body (ne z JWT) | STREDNI | `Checkout.jsx:135` | Edge Function by mela pouzit JWT claims |
| F3 | Chybejici CAPTCHA na CustomItineraryForm | STREDNI | `CustomItineraryForm.jsx:9` | Implementovat Cloudflare Turnstile |
| F4 | IDOR riziko v CustomItineraryPreview | STREDNI | `CustomItineraryPreview.jsx:24-28` | Overit RLS politiku, pridat auth check |
| F5 | getSession vs getUser nekonzistence | NIZKE | `CustomItineraryForm.jsx:102` | Zmenit na getUser() |
| F6 | Console.log v produkci | NIZKE | Vice souboru | Pouzit logger.js, potlacit v produkci |
| F7 | testConnection.js loguje Supabase URL | NIZKE | `src/lib/testConnection.js` | Odstranit z produkce |
| F8 | custom_itinerary_request_id bez overeni | NIZKE | `Checkout.jsx:121` | Edge Function overit vlastnictvi |

---

## Pozitivni nalezy

- [x] Anon key spravne pouzit (ne service_role)
- [x] Runtime validace env vars v supabase.js
- [x] .env soubory v .gitignore
- [x] Frontend neposila ceny do Edge Functions (price tampering zmirneny)
- [x] Download tokeny validovany server-side
- [x] React JSX auto-escaping pro XSS prevenci
- [x] dangerouslySetInnerHTML pouzit pouze pro staticka JSON-LD data
- [x] Edge Functions volany pres `supabase.functions.invoke()` (automaticky auth header)
- [x] Cart omezeny na 1 ks od kazdeho produktu
- [x] Polling v OrderConfirmation s maxAttempts limitem (30)

---

## Prioritni akce

1. **OKAMZITE:** Pridat security headers do `vercel.json` (F1)
2. **VYSOKA:** Implementovat CAPTCHA na CustomItineraryForm (F3)
3. **VYSOKA:** Overit ze Edge Functions ignoruji user_id z body a pouzivaji JWT (F2)
4. **STREDNI:** Overit RLS pro custom_itinerary_requests SELECT (F4)
5. **NIZKE:** Sjednotit getSession/getUser, vycistit console.log (F5, F6)
