# CAST 5b: Stripe integrace end-to-end

**Datum:** 2026-02-18
**Auditor:** Claude Opus 4.6 (automatizovany audit)
**Scope:** E2E flow: product sync (admin) -> checkout session -> payment -> webhook -> order creation -> download token. Stripe price immutability, refund handling, idempotence, webhook signature, error handling.
**Status:** READ-ONLY audit, zadne fixy

---

## 1. E2E Flow prehled

```
[Admin panel]                    [Frontend]                     [Stripe]                      [Supabase DB]
     |                               |                              |                              |
     |-- withStripeSync.ts --------->|                              |                              |
     |   afterCreate/afterUpdate     |                              |                              |
     |         |                     |                              |                              |
     |         |--- create-stripe-product (Edge Function) -------->|                              |
     |         |    title, price, product_id                       |                              |
     |         |<-- stripe_product_id, stripe_price_id ------------|                              |
     |         |                     |                              |                              |
     |         |--- UPDATE products (stripe_product_id, stripe_price_id) --------------------->  |
     |                               |                              |                              |
     |                               |-- create-checkout-session -->|                              |
     |                               |   line_items, user_id       |                              |
     |                               |<-- session.url --------------|                              |
     |                               |                              |                              |
     |                               |-- Redirect to Stripe ------>|                              |
     |                               |                              |-- Payment processing         |
     |                               |                              |                              |
     |                               |                              |-- stripe-webhook ----------->|
     |                               |                              |   checkout.session.completed  |
     |                               |                              |                              |
     |                               |                              |   1. Idempotence check       |
     |                               |                              |   2. Load products           |
     |                               |                              |   3. Find/create customer    |
     |                               |                              |   4. Create order            |
     |                               |                              |   5. Create order_items      |
     |                               |                              |   6. Create download_token   |
     |                               |                              |   7. Update customer spent   |
```

---

## 2. Product Sync (Admin -> Stripe)

### 2.1 Soubory

- **Admin data provider:** `cesty-bez-mapy-admin/src/dataProvider/withStripeSync.ts` (201 radku)
- **Edge function:** `supabase/functions/create-stripe-product/index.ts` (129 radku)

### 2.2 Flow analyza

#### Vytvoreni noveho produktu (afterCreate)

1. Admin vytvori produkt v Supabase (INSERT do `products`)
2. `afterCreate` callback zkontroluje `product.price > 0`
3. Zavola `create-stripe-product` Edge Function s: `title`, `description`, `price`, `image_url`, `product_id`
4. Edge function vytvori Stripe Product + Stripe Price (v CZK)
5. Callback aktualizuje produkt v DB: `stripe_product_id`, `stripe_price_id`

#### Zmena ceny (afterUpdate)

1. Admin zmeni cenu produktu (UPDATE `products`)
2. `afterUpdate` callback detekuje zmenu: `previousData?.price !== product.price`
3. Zavola `create-stripe-product` s `stripe_product_id` (existujici Stripe produkt)
4. Edge function vytvori NOVY Stripe Price (Stripe Prices jsou immutable) a aktualizuje metadata produktu
5. Callback aktualizuje `stripe_price_id` v DB na novou cenu

### 2.3 Nalezy

#### FINDING 5B-01: Stary Stripe Price se nearchivuje pri zmene ceny

**Severity: MEDIUM**

Kdyz se zmeni cena produktu, vytvori se novy Stripe Price, ale stary Price zustane aktivni ve Stripe. Postup:

- `withStripeSync.ts`, radky 96-143: Pri zmene ceny se vytvori novy Price, ale stary se nearchivuje
- `create-stripe-product/index.ts`, radky 88-95: Vytvori novy Price, ale nedeaktivuje stary

**Dopad:**
- Stare Stripe Prices zustanou aktivni a mohou byt zneuzity pokud je nekdo pouzije primo (napr. pres Stripe API)
- Akumulace neaktivnich Price objektu ve Stripe dashboardu

**Doporuceni:** Po vytvoreni noveho Price archivovat stary pomoci `stripe.prices.update(oldPriceId, { active: false })`.

---

#### FINDING 5B-02: Chybejici validace ceny na strane Edge Function

**Severity: MEDIUM**

- `create-stripe-product/index.ts`, radek 41: Validuje jen `!title || !price || !product_id`
- Chybi validace: `price > 0`, `price` je cislo (ne string), `price` neni prilis vysoka
- `Math.round(price * 100)` na radku 90 konvertuje na halere - zaporna cena by vytvorila zaporny Stripe Price (Stripe to odmitne, ale error handling vraci generickou zpravu)

**Doporuceni:** Pridat explicitni validaci: `typeof price === 'number' && price > 0 && price <= 1000000`.

---

#### FINDING 5B-03: Race condition pri afterCreate update

**Severity: LOW**

- `withStripeSync.ts`, radky 48-55: Po vytvoreni Stripe produktu se vola `dataProvider.update()` pro ulozeni `stripe_product_id` a `stripe_price_id`
- Pokud admin v tomto okamziku provede dalsi zmenu produktu, muze dojit ke ztrate Stripe IDs (lost update)
- V praxi nepravdepodobne (admin by musel editovat produkt behem ~1s po vytvoreni)

---

#### FINDING 5B-04: Nekonzistentni stav pri selhani Stripe sync

**Severity: MEDIUM**

- `withStripeSync.ts`, radky 40-44, 71-74: Pokud Stripe sync selze, produkt existuje v DB ale bez `stripe_product_id`/`stripe_price_id`
- Admin neni informovan o selhani (error se jen loguje do console, radek 42)
- Produkt je pak v inkonsistentnim stavu - existuje v DB ale neni propojeny se Stripe
- Nasledny pokus o checkout s timto produktem selze na `create-checkout-session` (radek 127-142: kontrola `stripe_price_id`)

**Doporuceni:**
1. Zobrazit error notifikaci v admin panelu pri selhani Stripe sync
2. Pridat "Retry Stripe sync" tlacitko v admin panelu
3. Alternativne: `needsStripeSync` logika v `afterUpdate` (radky 147-195) uz pokryva retry pri dalsim updatu - zdokumentovat toto chovani

---

## 3. Checkout Session

### 3.1 Soubor

- **Edge function:** `supabase/functions/create-checkout-session/index.ts` (250 radku)

### 3.2 Flow analyza

1. Frontend posle `line_items` (product IDs), `customer_email`, `customer_name`, `success_url`, `cancel_url`, `user_id`
2. Edge function nacte `stripe_price_id` z DB pro kazdy produkt (overuje `is_active` a `is_deleted`)
3. Vytvori Stripe Checkout Session s parametry: CZK, payment mode, card only
4. Vrati `session.url` pro redirect

### 3.3 Nalezy

#### FINDING 5B-05: Chybejici validace success_url a cancel_url

**Severity: HIGH**

- `create-checkout-session/index.ts`, radky 70-80: Validuje jen ze URLs existuji, ale NE jejich obsah
- Utocnik muze poslat `success_url: "https://evil.com/phishing"` a `cancel_url: "https://evil.com"`
- Stripe po platbe redirectne uzivatele na utocnikuv web, kde muze byt phishingovy formular

**Doporuceni:** Validovat ze URLs zacinaji na povolene domene (napr. `https://cestybezmapy.cz`).

---

#### FINDING 5B-06: Metadata limit a product_ids

**Severity: LOW**

- Radek 163: `product_ids: productIds.join(",")` - Stripe metadata maji limit 500 znaku na hodnotu
- UUID ma 36 znaku, takze limit je ~13 produktu v jedne objednavce (36 * 13 + 12 carek = 480)
- Pro typicky e-shop s pruvodniky dostatecne, ale neni osetren edge case

---

#### FINDING 5B-07: Quantity handling nekonzistence

**Severity: LOW**

- Radek 146-154: `stripeLineItems` mapuje produkty z DB, ale pouziva `requestItem?.quantity || 1`
- Pokud klient posle `quantity: 0` nebo `quantity: -1`, defaultuje na 1 (ok)
- Ale pokud posle `quantity: 100`, vytvori se validni checkout s 100 kusy
- Pro digitalni produkty (PDF pruvodce) nema smysl nakupovat vice kusu

**Doporuceni:** Pro digitalni produkty omezit `quantity` na 1.

---

## 4. Webhook Processing

### 4.1 Soubor

- **Edge function:** `supabase/functions/stripe-webhook/index.ts` (391 radku)

### 4.2 Webhook Signature Verification

**SPRAVNE IMPLEMENTOVANO**

- Radky 47-48: Telo requestu se cte jako `req.text()` (ne `req.json()`) - nutne pro spravnou verifikaci signatury
- Radky 50-53: Kontrola pritomnosti `stripe-signature` headeru
- Radky 57-69: `stripe.webhooks.constructEventAsync(body, signature, webhookSecret)` - pouziva async verzi pro Deno kompatibilitu
- Radek 17: Webhook secret z env variable `STRIPE_WEBHOOK_SECRET`

**Hodnoceni:** Toto je spravna implementace. Sirove telo se pouziva pro verifikaci (ne parsovane JSON), coz je nutne protoze Stripe podepisuje presny byte obsah.

### 4.3 Idempotence

**CASTECNE IMPLEMENTOVANO**

- Radky 185-196: Kontrola `existingOrder` podle `stripe_payment_id` pred vytvorenim nove objednavky
- Pokud objednavka uz existuje, vrati `{ success: true, orderId: existingOrder.id }` - spravne

**Problem:** Idempotence kontrola pokryva POUZE vytvoreni objednavky. Nasledne operace (order_items, download_tokens, customer update) nemaji vlastni idempotenci:

#### FINDING 5B-08: Castecna idempotence - order_items a download_tokens

**Severity: MEDIUM**

Scenar:
1. Webhook prijde poprve, vytvori order (radek 263-276)
2. Vytvareni order_items (radek 299-301) SELZE (napr. DB timeout)
3. Webhook vrati 500, Stripe opakuje
4. Druhy pokus najde existujici order (radek 185-196), vrati success
5. **Vysledek:** Objednavka existuje, ale BEZ order_items a BEZ download_tokenu

**Doporuceni:** Zabalit cely postup do DB transakce, nebo pri nalezeni existujici objednavky zkontrolovat, zda ma order_items a download_tokens, a pripadne je doplnit.

---

#### FINDING 5B-09: Chybejici order_number v objednavce

**Severity: LOW**

- Radky 33-37: Funkce `generateOrderNumber()` existuje (generuje format `CBM-2026-XXXXXX`)
- Ale NENI nikde volana - INSERT do `orders` (radky 263-276) neobsahuje `order_number`
- Dead code - pravdepodobne zapomenuto pri implementaci

---

### 4.4 Customer handling

#### FINDING 5B-10: Customer vytvareni s nahodnym UUID (jiz reportovano v Cast 4 jako C1)

**Severity: CRITICAL** (potvrzeni z Cast 4)

- Radek 234: `const newCustomerId = crypto.randomUUID()` koliduje s architekturou kde `customers.id = auth.users.id`
- Detailni analyza viz Cast 4, Issue #2

---

### 4.5 Download token generovani

- Radky 331-355: Token se generuje pouze pokud alespon jeden produkt ma `pdf_url`
- Token ma 48 znaku, expirace 7 dni
- Jeden token na celou objednavku (ne per-produkt) - efektivni design

#### FINDING 5B-11: Download token expiration neni konfigurovatelna

**Severity: LOW**

- Radek 342: Hardcoded `7 * 24 * 60 * 60 * 1000` (7 dni)
- Zakaznik nema moznost pozadat o novy token po expiraci
- Neni implementovan mechanismus pro prodlouzeni nebo regeneraci tokenu

---

### 4.6 Custom itinerary request handling

- Radky 309-329: Pokud objednavka obsahuje `custom_itinerary_request_id`, aktualizuje se status na "paid"
- Radky 293-296: `custom_itinerary_request_id` se priradi POUZE k produktu se `slug === "itinerar-na-miru"` - spravna logika

---

## 5. Price Consistency analyza

### 5.1 Cena v DB vs. Stripe

**Flow ceny:**
1. Admin nastavi cenu v DB (napr. 699 CZK)
2. `create-stripe-product` konvertuje: `Math.round(699 * 100) = 69900` haleru
3. Stripe Price ma `unit_amount: 69900`, `currency: "czk"`
4. Pri checkoutu se pouziva `stripe_price_id` z DB, takze Stripe pouzije SVOU cenu

#### FINDING 5B-12: Cena v DB a Stripe se mohou rozsynchronizovat

**Severity: HIGH**

**Scenar:**
1. Admin vytvori produkt s cenou 699 CZK -> Stripe Price = 69900 haleru
2. Nekdo primo upravi cenu v DB (napr. pres Supabase dashboard) na 499 CZK
3. `stripe_price_id` v DB stale ukazuje na stary Stripe Price (699 CZK)
4. Zakaznik vidi cenu 499 CZK na webu (z DB), ale pri checkoutu plati 699 CZK (ze Stripe)

**Protiargument:** `withStripeSync.ts` afterUpdate handler detekuje zmenu ceny a vytvori novy Stripe Price. ALE:
- Funguje POUZE pri zmene pres admin panel (React Admin data provider)
- Nefunguje pri prime zmene v DB (Supabase dashboard, SQL, migrace)
- Nefunguje pri zmene pres jiny klient nebo API

**Doporuceni:**
1. Pridat DB trigger na `products` tabulku, ktery pri zmene `price` nastavi `stripe_price_id = NULL` (vynuti re-sync)
2. V `create-checkout-session` OVERIT ze `product.price * 100 == stripe_price.unit_amount` (to by ale vyzadovalo dalsi Stripe API call)
3. Alternativne: v checkoutu pouzit `price_data` misto `price` ID (dynamicka cena) - ale to ma jine nevyhody

---

### 5.2 Cena v objednavce

- `stripe-webhook/index.ts`, radky 255-260: `totalAmount = session.amount_total / 100` nebo fallback na soucet `product.price`
- Radek 287-297: `price_at_purchase: product.price` - uklada aktualni DB cenu, NE Stripe cenu

#### FINDING 5B-13: price_at_purchase muze byt nekonzistentni se skutecnou platbou

**Severity: MEDIUM**

- `price_at_purchase` se bere z DB (`product.price`) v okamziku zpracovani webhooku
- Ale zakaznik zaplatil Stripe Price, ktery mohl byt jiny (viz 5B-12)
- `totalAmount` se spravne bere ze `session.amount_total` (skutecna castka od Stripe), ale `order_items.price_at_purchase` se bere z DB

**Doporuceni:** Pro `price_at_purchase` pouzit Stripe line items cenu (z `session.amount_total / pocet_items` nebo z `listLineItems` API call).

---

## 6. Refund handling

#### FINDING 5B-14: Refundy nejsou implementovany

**Severity: HIGH**

**Analyza:**
- `stripe-webhook/index.ts` zpracovava POUZE tyto eventy:
  - `checkout.session.completed` (radek 82)
  - `payment_intent.succeeded` (radek 88) - jen log, zadna akce
  - `payment_intent.payment_failed` (radek 94) - jen log, zadna akce
- **CHYBI** handler pro:
  - `charge.refunded` - refund pres Stripe dashboard
  - `charge.dispute.created` - chargeback
  - `payment_intent.canceled` - zruseni platby

**Dopad:**
- Pokud admin provede refund pres Stripe dashboard, objednavka v DB zustane ve stavu "completed"
- Download tokeny zustanou aktivni i po refundu
- `total_spent` u zakaznika se nesnizi
- Financni reporting bude nekonzistentni (DB ukazuje prijmy, ktere byly refundovany)

**Doporuceni:**
1. Pridat handler pro `charge.refunded`:
   - Aktualizovat `orders.status` na "refunded"
   - Deaktivovat download tokeny pro danou objednavku
   - Snizit `customers.total_spent`
2. Pridat handler pro `charge.dispute.created`:
   - Aktualizovat `orders.status` na "disputed"
   - Notifikovat admina
3. Registrovat tyto eventy v Stripe webhook konfiguraci

---

## 7. Error handling analyza

### 7.1 create-stripe-product

- Radky 115-127: Vraci `error.message` klientovi - muze leaknout Stripe interni chyby
- **Nema retry logiku** - pokud Stripe API selze, produkt zustane bez Stripe propojeni

### 7.2 create-checkout-session

- Radky 223-248: Rozlisuje Stripe errory (vraci `error.message` + `error.code`) od ostatnich
- **Nema retry logiku** - klient musi zkusit znovu

### 7.3 stripe-webhook

- Radky 107-114: Pokud `handleCheckoutCompleted` vrati `{ success: false }`, webhook vrati 500
- Stripe pak opakuje (exponential backoff, az 3 dny) - **spravne chovani**
- Radky 120-128: Obecny catch vraci 500 - Stripe opakuje

#### FINDING 5B-15: Webhook nerozlisuje retryable vs. permanent errors

**Severity: MEDIUM**

- Vsechny chyby vracuji 500 (Stripe opakuje)
- Ale nektere chyby jsou permanentni (napr. produkt neexistuje v DB) a opakovani nepomaha
- Stripe bude opakovat az 3 dny, generovat zbytecne logy a zatez

**Doporuceni:** Pro permanentni chyby (missing products, invalid metadata) vracet 200 s error logem (Stripe nebude opakovat). Pro transientni chyby (DB timeout, connection error) vracet 500.

---

## 8. Bezpecnostni matice E2E

| Aspekt | create-stripe-product | create-checkout-session | stripe-webhook | Hodnoceni |
|--------|----------------------|------------------------|----------------|-----------|
| **Autentizace** | ZADNA | ZADNA | Stripe signature | KRITICKY PROBLEM na prvnich dvou |
| **Cenova konzistence** | Vytvari Price z body.price | Pouziva stripe_price_id z DB | Bere price z DB | POTENCIALNI ROZSYNC |
| **Idempotence** | Ne (vzdy novy Price) | Ne (vzdy nova session) | Castecna (order check) | VYLEPSSIT webhook |
| **Refundy** | N/A | N/A | NEIMPLEMENTOVANO | CHYBI |
| **Error recovery** | Fail silently | Vraci chybu klientovi | Stripe retry (500) | CASTECNE OK |
| **Logging** | Standardni | Standardni | PII v logu | OPRAVIT PII |

---

## 9. Souhrn nalezenych problemu

### CRITICAL (1)
| # | Problem | Odkaz |
|---|---------|-------|
| 5B-10 | Customer UUID kolize (potvrzeni Cast 4 C1) | stripe-webhook r.234 |

### HIGH (3)
| # | Problem | Odkaz |
|---|---------|-------|
| 5B-05 | Chybejici validace success_url/cancel_url (open redirect) | create-checkout-session r.70-80 |
| 5B-12 | Cenova desynchronizace DB vs. Stripe | withStripeSync.ts / create-checkout-session |
| 5B-14 | Refundy nejsou implementovany | stripe-webhook - chybejici eventy |

### MEDIUM (5)
| # | Problem | Odkaz |
|---|---------|-------|
| 5B-01 | Stary Stripe Price se nearchivuje | create-stripe-product / withStripeSync.ts |
| 5B-02 | Chybejici validace ceny na Edge Function | create-stripe-product r.41 |
| 5B-04 | Nekonzistentni stav pri selhani Stripe sync (tichy fail) | withStripeSync.ts r.40-44 |
| 5B-08 | Castecna idempotence - chybi pro order_items/tokens | stripe-webhook r.185-355 |
| 5B-13 | price_at_purchase nekonzistentni se skutecnou platbou | stripe-webhook r.287 |
| 5B-15 | Webhook nerozlisuje retryable vs. permanent errors | stripe-webhook r.107-128 |

### LOW (4)
| # | Problem | Odkaz |
|---|---------|-------|
| 5B-03 | Race condition pri afterCreate update | withStripeSync.ts r.48-55 |
| 5B-06 | Metadata limit pro product_ids | create-checkout-session r.163 |
| 5B-07 | Quantity bez omezeni pro digitalni produkty | create-checkout-session r.146-154 |
| 5B-09 | generateOrderNumber() dead code | stripe-webhook r.33-37 |
| 5B-11 | Download token expiration hardcoded, bez regenerace | stripe-webhook r.342 |

---

## 10. Prioritizovana doporuceni

### Okamzite (pred spustenim do produkce)

1. **Implementovat refund webhook handler** (`charge.refunded`, `charge.dispute.created`) - 5B-14
2. **Validovat success_url/cancel_url** proti whitelistu domen - 5B-05
3. **Opravit customer vytvareni** pro guest checkout (viz Cast 4 C1) - 5B-10

### Kratkodoba (prvni sprint po spusteni)

4. **Archivovat stare Stripe Prices** pri zmene ceny - 5B-01
5. **Doplnit idempotenci** pro order_items a download_tokens ve webhooku - 5B-08
6. **Pridat DB trigger** pro detekci prime zmeny ceny (bez admin panelu) - 5B-12
7. **Zobrazit chybu v admin panelu** pri selhani Stripe sync - 5B-04
8. **Rozlisit retryable vs. permanent errors** ve webhooku - 5B-15

### Strednedoba (backlog)

9. **Pridat validaci ceny** v Edge Function (rozsah, typ) - 5B-02
10. **Pouzit Stripe line items** pro `price_at_purchase` - 5B-13
11. **Omezit quantity** na 1 pro digitalni produkty - 5B-07
12. **Implementovat token regeneraci** pro expirované download tokeny - 5B-11
13. **Odstranit dead code** `generateOrderNumber()` - 5B-09
