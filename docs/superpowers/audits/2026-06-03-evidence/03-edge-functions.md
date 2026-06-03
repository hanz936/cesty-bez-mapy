# Edge funkce — verify_jwt matice + bezpečnostní průchod (Task 1.3)

> 13 funkcí (+ `_shared`). Zachyceno 2026-06-03. Nasazený stav přes MCP `list_edge_functions`, kód z disku.

## verify_jwt matice (config.toml vs DEPLOYED)

| Funkce | config.toml | DEPLOYED | Auth model v kódu | Verdikt |
|---|---|---|---|---|
| create-checkout-session | (default) true | **true** | anon JWT (gateway) + service role; URL allowlist | ✓ |
| create-invoice | (default) true | **true** | admin RPC check + service role | ✓ |
| create-stripe-product | (default) true | **true** | admin (volá z adminu) | ✓ |
| csp-report | **false** | **false** | žádná auth (public report sink) + size cap | ✓ |
| download-invoice-pdf | (default) true | **true** | getUser + `is_admin` RPC (defense-in-depth) | ✓ |
| get-blog-preview | (default) true | **true** | per-post `preview_token` (UUID) + service role | ✓ |
| get-download-url | (default) true | **true** | `download_tokens.token` capability + service role | ✓ |
| get-order-by-session | (default) true | **true** | Stripe `session_id` capability + email ownership check | ⚠️ viz nálezy |
| resend-email | (default) true | **true** | admin (volá z adminu) + service role | ✓ |
| resend-webhook | (default) true | **true** | **svix podpis (Resend)** | 🔴 **verify_jwt MÁ být false** |
| send-custom-itinerary-email | (default) true | **true** | admin + service role | ✓ |
| stripe-webhook | **false** | **false** | Stripe `constructEventAsync` podpis | ✓ |
| submit-contact-form | **false** | **false** | Cloudflare Turnstile + validace | ✓ |

config.toml ↔ deployed jsou **konzistentní** (žádný deploy drift). Problém je obsahový u `resend-webhook`.

## 🔴 NÁLEZY

### [HIGH] resend-webhook má verify_jwt=true, ale je to externí webhook
- **Surface:** 10 (edge) + 6 (config)
- **Důkaz:** `list_edge_functions` → `resend-webhook verify_jwt:true`; config.toml ho neuvádí (default true). Kód (`index.ts:52–63`) ověřuje **svix** podpis (`svix-id/timestamp/signature` + `RESEND_WEBHOOK_SECRET`), fail-closed.
- **Problém:** Resend posílá webhook se svix podpisem, **ne** Supabase JWT. Gateway s `verify_jwt=true` request odmítne (401) DŘÍV, než dorazí k funkci → bounce/complaint → `email_suppressions` pipeline pravděpodobně **tiše nefunguje**. Dopad: e-maily na hard-bounced adresy se dál odesílají (reputace odesílatele), GDPR suppression neúčinkuje.
- **Doporučení:** `[functions.resend-webhook] verify_jwt = false` v config.toml + redeploy (podpis se ověřuje v kódu). Ověřit přes logy/`email_events`, zda dosud chodily eventy.
- **Blok:** B6

### [MEDIUM] get-order-by-session čte neexistující sloupec download_tokens.expires_at
- **Surface:** 10 (edge) / 1 (schema konzistence)
- **Důkaz:** `get-order-by-session/index.ts:151` `select("token, expires_at")`. Introspekce (Task 1.2) `download_tokens` NEMÁ sloupec `expires_at` (sloupce: id, order_id, token, created_at, asset_type, custom_itinerary_request_id, download_count, last_downloaded_at). Komentář v `get-download-url` potvrzuje „Tokens are perpetual (no expiration)".
- **Problém:** dotaz vždy skončí chybou (column does not exist) → `tokenError` → `download_token: null` v odpovědi. Success page po platbě nemusí dostat token touto cestou. Latentní bug po odstranění expirace tokenů.
- **Doporučení:** odstranit `expires_at` ze selectu (+ `download_expires_at` z response, nebo ho nechat vždy null). Sjednotit s perpetual-token modelem.
- **Blok:** B6

### [LOW] get-order-by-session přeskočí ownership check při prázdném emailu
- **Důkaz:** `index.ts:140–146` — kontrola `session.customer_details?.email !== order.customer_email` proběhne jen když je `customer_details.email` truthy; jinak se vrátí objednávka + token bez ověření vlastnictví.
- **Problém:** `session_id` je sám o sobě neuhodnutelný (Stripe `cs_...`), takže reálné riziko nízké, ale chybí fail-closed. 
- **Doporučení:** vyžadovat shodu emailu (nebo zamítnout, když email chybí). Blok B6 (volitelné).

## Pozitiva (bez nálezu) — výběr

- **stripe-webhook:** `constructEventAsync` (správná async varianta pro Deno), fail-closed na chybějící/neplatný podpis (400), service role, token přes `crypto.getRandomValues` (32 znaků). Idempotence event handlingu řešena v `lib.ts`. Exemplární.
- **submit-contact-form:** Turnstile (`verifyTurnstile` fail-closed: chybí secret → throw → 503; success jen při `data.success===true`), důkladná délková + email validace, service role insert.
- **csp-report:** dvojitý size cap (content-length + `raw.length`, 50 KB), normalizace legacy+modern report shape, vždy 204 (fire-and-forget), `auth.persistSession:false`.
- **download-invoice-pdf:** verify_jwt=true + **navíc** `getUser()` + `is_admin` RPC v kódu (defense-in-depth), service role jen pro Fakturoid.
- **get-blog-preview:** preview_token validovaný UUID regexem, `Cache-Control: no-store`, ACAO jen pro povolený origin.
- **create-checkout-session:** `isAllowedUrl` allowlist pro success/cancel URL (anti open-redirect).

## Cross-check na DB nálezy (RPC volající)

- `increment_download_count` — volá **jen** get-download-url (service role). → revoke anon/auth EXECUTE bezpečné.
- `increment_email_resend_count` — volá resend-email + send-custom-itinerary-email (oba service role). → revoke anon/auth EXECUTE bezpečné.
- `notify_vercel_blog_publish` — trigger funkce (volá trigger, ne RPC). → revoke anon/auth EXECUTE bezpečné.
- `get-download-url` používá **service role** → broad `USING(true)` SELECT policies na `download_tokens` jsou pro legitimní flow **zbytečné** → jejich odstranění (CRITICAL fix) nic nerozbije.

## CORS poznámka (napříč funkcemi)

Většina funkcí sdílí hardcoded `allowedOrigins` (cestybezmapy.cz, admin, localhost, jeden Vercel preview). Fallback při neznámém originu = `allowedOrigins[0]` (produkční doména) — bezpečné (nezrcadlí libovolný origin). Konzistentní, bez nálezu. (Drobnost: duplikace seznamu napříč ~8 soubory — mohlo by žít v `_shared`; kosmetika, mimo scope.)
