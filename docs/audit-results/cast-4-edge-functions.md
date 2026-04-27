# CAST 4: Bezpecnostni audit Edge Functions + rate limiting

**Datum:** 2026-02-15
**Auditor:** Claude Opus 4.6 (automatizovany audit)
**Scope:** 5 edge functions, CORS, dependency pinning, rate limiting, bezpecnostni matice
**Status:** READ-ONLY audit, zadne fixy

---

## 1. Verifikace 3 issues z Casti 0

### Issue #1: create-checkout-session - user_id spoofing

**POTVRZENO** | Severity: **HIGH**

**Dukaz v kodu:**
- `supabase/functions/create-checkout-session/index.ts`, radek 36: `user_id?: string; // Supabase auth user ID (muze byt anonymous)`
- Radek 48-55: `const body: CreateCheckoutRequest = await req.json();` - `user_id` se extrahuje primo z request body
- Radek 167-169: `if (user_id) { metadata.supabase_user_id = user_id; }` - user_id se ulozi do Stripe metadata bez overeni

**Jak klient posila user_id:**
- `src/pages/Checkout.jsx`, radek 102-115: Klient ziska user_id z `supabase.auth.getUser()` nebo `signInAnonymously()`
- Radek 130-137: Posila `user_id: userId` v body requestu

**Dopad:**
- Utocnik muze poslat libovolne `user_id` v POST body a vytvorit checkout session pod cizim uctem
- user_id se nasledne prenese do `orders.auth_user_id` pres stripe-webhook (radek 266)
- Utocnik nemuze primo ziskat pristup k cuzimu uctu, ale muze asociovat objednavky s cizim user ID

**Spravny pristup:** Edge function by mela extrahovat user_id z JWT Authorization headeru pomoci `supabase.auth.getUser()` na serveru, ne duverat klientskemu body.

**Poznamka k zavaznosti:** Prakticky dopad je omezeny - utocnik by mohl pridat objednavku pod cizi user_id, ale nema z toho primou vyhodu (platba jde na Stripe, produkty dostane ten kdo zaplatil). Nicmene porusuje princip "never trust client input" a mohlo by zpusobit zmatok v datech.

---

### Issue #2: stripe-webhook - customer ID kolize s crypto.randomUUID()

**POTVRZENO** | Severity: **CRITICAL**

**Dukaz v kodu:**
- `supabase/functions/stripe-webhook/index.ts`, radek 220-251
- Radek 234: `const newCustomerId = crypto.randomUUID();`
- Radek 235-244: INSERT do `customers` tabulky s tímto nahodnym UUID jako `id`

**Architekturni konflikt:**
- Migrace 013 (`013_customers_auth_sync.sql`, radek 17) explicitne rika: `-- IMPORTANT: customers.id must match auth.users.id for this to work!`
- Migrace 026 (`026_fix_active_bugs_and_cleanup.sql`, radek 100-103) pridava FK constraint: `FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE`

**Scenar kolize:**
1. Guest (neprihlaseny) zakaznik provede nakup
2. Stripe webhook zpracuje platbu, nenajde existujiciho customer podle emailu
3. Vytvori noveho customera s `crypto.randomUUID()` jako ID
4. **Pokud FK constraint `fk_customers_auth_users` existuje:** INSERT selze s FK violation (UUID neexistuje v `auth.users`)
5. **Pokud FK constraint nebyl pridan** (kvuli orphaned records v migraci 026, radky 86-97): Vytvori se orphaned customer zaznam

**Dulezity detail:** Migrace 026 obsahuje logiku, ktera PRESKOCI pridani FK constraintu pokud existuji orphaned customers s objednavkami (radek 86-97). Neni jiste, zda FK constraint skutecne existuje v produkci. Pokud ano, kazdy guest checkout selze pri vytvareni customera.

**Dalsi problem:** Funkce hleda existujiciho zakaznika podle emailu (radek 224-228), ale i kdyz ho najde, neaktualizuje jeho `name` ani jine udaje. Take neni osetren pripad, kdy dva ruzni auth users maji stejny email.

---

### Issue #3: create-stripe-product - chybejici admin autorizace

**POTVRZENO** | Severity: **HIGH**

**Dukaz v kodu:**
- `supabase/functions/create-stripe-product/index.ts` - cely soubor (129 radku)
- Zadna autentizace ani autorizace NIKDE v kodu
- Radek 29: `Deno.serve(async (req) => {` - primo zpracovani bez jakehokoliv auth checku
- Radek 37: `const body: CreateProductRequest = await req.json();` - okamzite parsovani body
- Zadne cteni Authorization headeru, zadne overeni JWT, zadna kontrola role

**Jak je funkce volana:**
- `cesty-bez-mapy-admin/src/dataProvider/withStripeSync.ts`, radek 27-38: `supabaseClient.functions.invoke("create-stripe-product", { body: {...} })`
- Supabase JS klient automaticky posila Authorization header s JWT tokenem, ale edge function ho IGNORUJE

**Dopad:**
- Kdokoliv s pristupem k Supabase URL a anon key muze:
  - Vytvorit libovolny produkt ve Stripe
  - Aktualizovat existujici Stripe produkt (radek 63-67)
  - Vytvorit novou cenu pro existujici produkt
- Neni nutna zadna autentizace - staci POST request s validnim JSON body
- Muze vest k financnim ziskum utocnika pokud vytvori produkty s nulovou nebo zapornou cenou a propoji je s existujicimi Supabase produkty

**Poznamka:** Supabase Edge Functions ve vychozim stavu vyzaduji `apikey` header (anon key), coz je maly ochrana. Ale anon key je verejny (je v klientskem kodu), takze tato "ochrana" je minimalni.

---

## 2. Bezpecnostni matice 5 edge functions

| Kontrola | create-checkout-session | stripe-webhook | create-stripe-product | get-order-by-session | get-download-url |
|----------|------------------------|----------------|----------------------|---------------------|-----------------|
| **Auth** | Zadna (akceptuje anon) | Stripe signature | **ZADNA** | Zadna (akceptuje anon) | Token-based (bez auth) |
| **Authz** | **CHYBI** (user_id z body) | N/A (Stripe server) | **CHYBI** (zadna admin kontrola) | **CHYBI** (kdokoliv se session_id) | Token vlastnictvi |
| **Input validace** | Castecna (line_items, URLs) | Stripe schema | Castecna (title, price, product_id) | Castecna (session_id existence) | Castecna (token existence) |
| **service_role** | Ano (SELECT + metadata) | Ano (INSERT orders, customers, tokens) | Ne (jen Stripe API) | Ano (SELECT orders, tokens, items) | Ano (SELECT + signed URL) |
| **CORS origin** | `*` **CRITICAL** | Nema CORS (spravne) | `*` **CRITICAL** | `*` **CRITICAL** | `*` **CRITICAL** |
| **Error leaks** | Stripe error.message + code | error.message | error.message | error.message | error.message |
| **Idempotence** | Ne (vzdy nova session) | **Ano** (existingOrder check, r.185-196) | Ne (vzdy novy Price) | Ano (read-only) | Ano (read-only) |
| **Rate limit** | **ZADNY** | N/A (Stripe ridi) | **ZADNY** | **ZADNY** | **ZADNY** |

---

## 3. CORS analyza

### Nalez: Wildcard `Access-Control-Allow-Origin: "*"` na 4 z 5 funkcich

**Severity: CRITICAL**

**Postizene funkce:**
1. `create-checkout-session/index.ts`, radek 19: `"Access-Control-Allow-Origin": "*"`
2. `create-stripe-product/index.ts`, radek 17: `"Access-Control-Allow-Origin": "*"`
3. `get-download-url/index.ts`, radek 14: `"Access-Control-Allow-Origin": "*"`
4. `get-order-by-session/index.ts`, radek 19: `"Access-Control-Allow-Origin": "*"`

**stripe-webhook:** Nema CORS hlavicky vubec - spravne, protoze Stripe posila server-to-server requesty.

**Rizika:**
- Jakykoliv web muze volat `create-checkout-session` a vytvorit checkout session pro produkty e-shopu
- Jakykoliv web muze volat `get-order-by-session` se session_id a ziskat info o objednavce (vcetne emailu, jmena, castky)
- Jakykoliv web muze volat `get-download-url` s download tokenem a ziskat signed URL pro PDF
- Jakykoliv web muze volat `create-stripe-product` a manipulovat se Stripe produkty

**Allowed headers:** `authorization, x-client-info, apikey, content-type` - standardni pro Supabase klienta

**Doporuceni:** Nahradit `*` whitelistem produkčnich domen.

---

## 4. Dependency pinning analyza

### Nalez: Nepinnovane major-range zavislosti

**Severity: HIGH**

**Aktualni stav importu:**

| Funkce | Stripe | Supabase JS |
|--------|--------|-------------|
| create-checkout-session | `stripe@20` | `@supabase/supabase-js@2` |
| stripe-webhook | `stripe@20` | `@supabase/supabase-js@2` |
| create-stripe-product | `stripe@20` | nepouziva |
| get-download-url | nepouziva | `@supabase/supabase-js@2` |
| get-order-by-session | `stripe@20` | `@supabase/supabase-js@2` |

**Vsechny importy pouzivaji `?target=denonext`** u Stripe a zadny target u supabase-js.

**Riziko:**
- `stripe@20` muze resolvovat na libovolnou 20.x.x verzi. Breaking changes v minor/patch verzich nejsou nemozne.
- `@supabase/supabase-js@2` muze resolvovat na libovolnou 2.x.x verzi. Supabase JS 2 ma rozsah od 2.0.0 do 2.49+.
- esm.sh cachuje resolvovane verze, ale pri redeploy nebo cache invalidaci se muze zmenit verze bez vedomi vyvojare.

**Zadny globalni import_map:** Nebyl nalezen zadny `deno.json` v adresarich edge functions (audit plán zmunoval jeden v create-stripe-product, ale nebyl nalezen).

**Doporuceni:** Pinnout na presne verze, napr. `stripe@20.16.0` a `@supabase/supabase-js@2.49.1`.

---

## 5. Rate limiting analyza

### 5.1 SQL dotazy (4-RATE-A, B, C)

**Poznamka:** SQL dotazy nebylo mozne spustit kvuli omezenemu pristupu k Bash nastroji v tomto auditu. Vysledky je nutne doplnit rucne spustenim nasledujicich dotazu:

```sql
-- 4-RATE-A: Podezrela aktivita - mnoho objednavek od jednoho usera
SELECT auth_user_id, COUNT(*) as order_count, MIN(created_at), MAX(created_at)
FROM orders GROUP BY auth_user_id HAVING COUNT(*) > 5 ORDER BY order_count DESC;

-- 4-RATE-B: Mnoho custom requests od jednoho usera
SELECT user_id, COUNT(*) as request_count
FROM custom_itinerary_requests GROUP BY user_id HAVING COUNT(*) > 3;

-- 4-RATE-C: Newsletter spam
SELECT email, COUNT(*) as signup_count
FROM newsletter_consent_log GROUP BY email HAVING COUNT(*) > 1;
```

### 5.2 Rate limiting na edge functions

**Severity: MEDIUM**

**Zadna z 5 edge functions neimplementuje vlastni rate limiting.**

Supabase Edge Functions maji built-in rate limiting na urovni platformy (priblizne 100 req/s na projekt na Free planu), ale toto je sdilene mezi vsemi funkcemi a neni per-user.

**Zranitelne endpointy:**
1. **create-checkout-session** - utocnik muze spamovat Stripe Checkout sessions (kazda session vytvori zaznam ve Stripe)
2. **get-order-by-session** - brute-force session_id (Stripe session IDs jsou vsak dlouhe a nahodne)
3. **get-download-url** - brute-force download tokenu (48 znaku, statisticky neprulomitelne)
4. **create-stripe-product** - neomezene vytvareni Stripe produktu a cen

**Doporuceni:** Implementovat per-IP nebo per-user rate limiting, idealne pomoci Supabase Edge Function middleware nebo externiho reseni.

---

## 6. Kompletni checklist

### 6.1 CORS
- [x] **PROBLEM:** Wildcard `*` origin na 4 z 5 funkcich
- [x] stripe-webhook spravne nema CORS (server-to-server)
- [ ] Implementovat origin whitelist na produkčni domeny

### 6.2 Dependency pinning
- [x] **PROBLEM:** Vsechny zavislosti pouzivaji major-range verze (stripe@20, supabase-js@2)
- [ ] Pinnout na presne minor/patch verze
- [x] **PROBLEM:** Nekonzistentni pristup (zadny deno.json nalezen, vsechny funkce importuji primo z URL)
- [ ] Sjednotit na spolecny import_map nebo vsechny primo

### 6.3 Secrets management
- [x] Stripe secret key cteny z `Deno.env.get("STRIPE_SECRET_KEY")` - spravne
- [x] Supabase service role key cteny z env - spravne
- [x] Webhook secret cteny z env - spravne
- [x] Zadne hardcoded secrets v kodu

### 6.4 Deno permissions
- [x] Zadne `--allow-all` nalezeno (Supabase Edge Functions bezi v sandboxu)
- [x] Pouziti `Deno.serve()` API - standardni

### 6.5 Error responses
- [x] **PROBLEM (MEDIUM):** `error.message` se vraci klientovi ve vsech 5 funkcich
  - `create-checkout-session`, r.230: `error: Stripe chyba: ${error.message}` + `code: error.code` - leakuje Stripe interni chybove zpravy
  - `create-stripe-product`, r.120: `error: error instanceof Error ? error.message : "Unknown error"` - muze leaknout stack info
  - Ostatni funkce: podobny pattern
- [x] Zadne stacktraces se nevracuji primo (pouziva se `error.message`, ne `error.stack`)
- [ ] Doporuceni: V produkci vracet genericke chybove zpravy, detaily logovat server-side

### 6.6 SQL injection
- [x] Vsechny DB dotazy pouzivaji Supabase JS klient s parametrizovanymi dotazy (`.eq()`, `.in()`, `.select()`)
- [x] Zadne raw SQL dotazy v edge functions
- [x] **Bezpecne** - riziko SQL injection je minimalni

### 6.7 Logging citlivych dat
- [x] **PROBLEM (MEDIUM):** `stripe-webhook/index.ts`, radek 140: `console.log('Customer details:', JSON.stringify(session.customer_details))` - loguje email, jmeno, adresu zakaznika
- [x] **PROBLEM (LOW):** `stripe-webhook/index.ts`, radek 138: `console.log('Session metadata:', JSON.stringify(session.metadata))` - loguje user_id a product_ids
- [x] Ostatni funkce: loguji pouze nekritacke informace (session IDs, product IDs, token prefix)

### 6.8 Kontroly po hotfixech (Cast 0)
- [x] **Hotfix 1 (user_id z JWT):** NEBYL APLIKOVAN - user_id stale z request body
- [x] **Hotfix 2 (customer ID):** NEBYL APLIKOVAN - stale pouziva crypto.randomUUID()
- [x] **Hotfix 3 (admin auth):** NEBYL APLIKOVAN - stale bez autorizace

### 6.9 Dalsi nalezy
- [x] **PROBLEM (LOW):** `generateOrderNumber()` (stripe-webhook, r.33-37) pouziva `Math.random()` - neni kryptograficky bezpecne, ale funkce NENI nikde volana (dead code)
- [x] **PROBLEM (LOW):** `generateToken()` (stripe-webhook, r.20-30) ma modulo bias: `chars.length = 62`, `randomValues[i] % 62` - hodnoty 0-61 nejsou rovnomerne distribuovane z rozsahu 0-255. Bias je vsak minimalni (< 2%) a pro download token nepredstavuje kritické riziko.
- [x] **PROBLEM (MEDIUM):** `get-order-by-session` - kdokoliv se Stripe session_id (napr. z URL parametru) muze ziskat plne detaily objednavky vcetne jmena, emailu, castky a download tokenu. Zadna owner verifikace.
- [x] **INFO:** Stripe webhook spravne overuje signaturu (radky 57-69 v stripe-webhook)
- [x] **INFO:** Webhook ma idempotenci pro orders (kontrola existingOrder, radky 185-196)

---

## 7. Souhrn nalezenych problemu podle severity

### CRITICAL (2)

| # | Problem | Funkce | Radek | Popis |
|---|---------|--------|-------|-------|
| C1 | Customer ID kolize | stripe-webhook | 234 | `crypto.randomUUID()` pro customer ID koliduje s architekturou `customers.id = auth.users.id` a potencialne s FK constraint z migrace 026. Guest checkout muze selhat na FK violation. |
| C2 | Wildcard CORS | 4 funkce | 19,17,14,19 | `Access-Control-Allow-Origin: "*"` umoznuje volani z jakehokoliv webu. Zejmena nebezpecne u `create-stripe-product` (manipulace Stripe produktu) a `get-order-by-session` (information disclosure). |

### HIGH (3)

| # | Problem | Funkce | Radek | Popis |
|---|---------|--------|-------|-------|
| H1 | Chybejici admin autorizace | create-stripe-product | cely soubor | Zadna autentizace ani autorizace. Kdokoliv s anon key muze vytvorit/upravit Stripe produkty a ceny. |
| H2 | user_id spoofing | create-checkout-session | 48-55, 167 | user_id se bere z request body misto z JWT. Utocnik muze asociovat objednavku s cizim user_id. |
| H3 | Nepinnovane zavislosti | vsechny | importy | Major-range verze (stripe@20, supabase-js@2) mohou zpusobit neocekavane breaking changes. |

### MEDIUM (4)

| # | Problem | Funkce | Radek | Popis |
|---|---------|--------|-------|-------|
| M1 | Information disclosure | get-order-by-session | 168-186 | Kdokoliv se session_id ziska plne detaily objednavky vcetne osobnich udaju a download tokenu. Zadna owner verifikace. |
| M2 | Error message leaking | vsechny | ruzne | `error.message` se vraci klientovi - muze obsahovat interni informace od Stripe nebo Supabase. |
| M3 | Logging PII | stripe-webhook | 140 | `customer_details` vcetne emailu a adresy se loguje v plaintext. |
| M4 | Zadny rate limiting | 4 funkce | - | Zadna z verejne pristupnych funkcí neimplementuje rate limiting. Muze vest k abuse (spam checkout sessions, Stripe produkt flooding). |

### LOW (3)

| # | Problem | Funkce | Radek | Popis |
|---|---------|--------|-------|-------|
| L1 | Dead code | stripe-webhook | 33-37 | `generateOrderNumber()` neni nikde volana. |
| L2 | Modulo bias v generateToken | stripe-webhook | 27 | `randomValues[i] % 62` ma maly bias (< 2%), pro download tokeny nepristavuje realne riziko. |
| L3 | Math.random() v dead code | stripe-webhook | 35 | `Math.random()` v generateOrderNumber - aktualne dead code, ale pokud se zacne pouzivat, neni kryptograficky bezpecne. |

---

## 8. Doporuceni (prioritizovana)

1. **[CRITICAL] Opravit customer vytvareni ve stripe-webhook** - Pouzit `supabase_user_id` z metadata pro prirazeni k existujicimu auth user, nebo vytvorit customera BEZ id vazby na auth.users pro guest checkout.
2. **[CRITICAL] Omezit CORS origin** - Nahradit `*` whitelistem produkčnich domen na vsech 4 funkcich.
3. **[HIGH] Pridat admin autorizaci do create-stripe-product** - Overit JWT token a zkontrolovat admin roli z `user_roles` tabulky.
4. **[HIGH] Extrahovat user_id z JWT v create-checkout-session** - Pouzit `supabase.auth.getUser()` na serveru misto duvery request body.
5. **[HIGH] Pinnout dependency verze** - Pouzit presne verze (napr. `stripe@20.16.0`).
6. **[MEDIUM] Pridat owner verifikaci do get-order-by-session** - Overit ze volajici je vlastnik objednavky (pres auth_user_id nebo session ownership).
7. **[MEDIUM] Sanitizovat error responses** - Vracet genericke zpravy, detaily logovat server-side.
8. **[MEDIUM] Odstranit PII z logu** - Nelogovat customer_details v plaintext.
9. **[MEDIUM] Implementovat rate limiting** - Alespon na create-checkout-session a create-stripe-product.
10. **[LOW] Odstranit dead code** - `generateOrderNumber()` ve stripe-webhook.
