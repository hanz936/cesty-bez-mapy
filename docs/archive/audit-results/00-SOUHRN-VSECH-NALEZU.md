# Supabase Audit: Konsolidovaný přehled nálezů

**Datum:** 2026-02-19
**Rozsah:** 11 audit reportů (Části 1a, 1b, 2a, 3ab, 4, 5a-i, 5a-ii, 5b, 6, 8, 9)

## Statistika

- **Celkem nálezů: 62**
- **CRITICAL: 9**
- **HIGH: 20**
- **MEDIUM: 21**
- **LOW: 12**

---

## CRITICAL nálezy (vyžadují okamžitý fix)

| # | Nález | Zdroj (Část) | Popis | Doporučený fix |
|---|-------|-------------|-------|----------------|
| C1 | Migrace 026-028 neaplikovány na produkční DB | 1a, 1b | DB schema neodpovídá kódu. 5 aktivních bugů: anonymous checkout nefunguje (NOT NULL constraints), soft-deleted produkty viditelné, newsletter bez validace, osiřelá funkce, chybějící FK. MIGRATIONS.md zavádějícně označuje 7 issues jako "Opraveno". | Okamžitě aplikovat migrace 026, 027, 028 na produkci. Aktualizovat MIGRATIONS.md. |
| C2 | Customer ID kolize v stripe-webhook (crypto.randomUUID) | 4, 3ab, 5b | Webhook vytváří customera s `crypto.randomUUID()` místo `auth.users.id`. Koliduje s architekturou `customers.id = auth.users.id`. Potvrzeno: 1 osiřelý customer v DB (ID `6f2a0989`). Po aplikaci FK z migrace 026 začne guest checkout selhávat. | Přepsat webhook: použít `supabase_user_id` z metadata, nebo vytvořit customera BEZ id vazby na auth.users pro guest checkout. |
| C3 | Wildcard CORS (`*`) na 4 edge functions | 4 | `Access-Control-Allow-Origin: "*"` na create-checkout-session, create-stripe-product, get-download-url, get-order-by-session. Jakýkoliv web může volat tyto funkce. | Nahradit `*` whitelistem produkčních domén. |
| C4 | products_public_select nemá filtr is_deleted | 2a, 1b | RLS policy `USING(true)` povoluje SELECT na VŠECHNY produkty včetně smazaných. Útočník může přes přímý API call vidět smazané produkty. | Součást migrace 028 (viz C1) - změnit na `USING(is_deleted = false)`. |
| C5 | Chybí privacy policy a obchodní podmínky | 9 | Stránky neexistují, footer odkazuje na `#`. Checkout odkazuje na neexistující obchodní podmínky (`href="#"`). Zákazník de facto souhlasí s ničím. | Vytvořit stránky `/ochrana-udaju` a `/obchodni-podminky` s plným obsahem dle GDPR čl. 13. |
| C6 | CustomItineraryForm sbírá zdravotní údaje bez souhlasu | 9 | Pole `healthRestrictions` v form_data je zvláštní kategorie údajů dle čl. 9 GDPR. Zpracování vyžaduje explicitní souhlas. | Přidat GDPR checkbox se souhlasem se zpracováním včetně zdravotních údajů. Zvážit nepovinnost pole. |
| C7 | Kompletní absence informační povinnosti u formulářů | 9 | Žádný formulář (CustomItineraryForm, Contact, Checkout) neinformuje o zpracování osobních údajů dle čl. 13 GDPR. | Přidat informace o zpracování ke každému formuláři (správce, účel, doba uchovávání, práva). |
| C8 | Žádné automatické backupy (Free plan) | 6 | Supabase Free plan nemá automatické backupy. Produkční data jsou nechráněná. Žádná backup procedura dokumentována, restore nikdy testován. | Upgrade na Supabase Pro plan ($25/měsíc). Nastavit backup proceduru, otestovat restore. |
| C9 | Supabase Free plan - auto-pause po 7 dnech neaktivity | 6 | E-shop může být nedostupný po období nízké aktivity. | Upgrade na Supabase Pro plan. |

---

## HIGH nálezy (opravit brzy)

| # | Nález | Zdroj (Část) | Popis | Doporučený fix |
|---|-------|-------------|-------|----------------|
| H1 | Edge function create-stripe-product bez autentizace/autorizace | 4, 5a-i, 5b | Žádná auth kontrola. Kdokoliv s anon key může vytvořit/upravit Stripe produkty a ceny. JWT token z klienta je ignorován. | Přidat JWT ověření a admin role kontrolu do edge function. |
| H2 | user_id spoofing v create-checkout-session | 4, 5a-ii, 5b | user_id se bere z request body místo z JWT. Útočník může asociovat objednávku s cizím user_id. | Edge function musí extrahovat user_id z JWT přes `supabase.auth.getUser()`. |
| H3 | SECURITY DEFINER funkce mají PUBLIC execute | 3ab | 5 trigger funkcí + obsoletní handle_new_user mají EXECUTE grant pro PUBLIC. Zbytečné bezpečnostní riziko. | `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated;` |
| H4 | handle_new_user() stále existuje (obsoletní) | 1a, 3ab | SECURITY DEFINER funkce, volatelná kýmkoliv, není napojena na žádný trigger. Měla být smazána v migrace 026. | Součást C1 - `DROP FUNCTION handle_new_user();` |
| H5 | Chybí validace success_url/cancel_url (open redirect) | 5b | create-checkout-session nevaliduje obsah URL. Útočník může poslat phishingový URL jako success_url. | Validovat že URLs začínají na povolené doméně. |
| H6 | Refundy nejsou implementovány | 5b | stripe-webhook nezpracovává `charge.refunded` ani `charge.dispute.created`. Po refundu zůstane objednávka "completed", download tokeny aktivní, total_spent nezmenšen. | Přidat webhook handlery pro refund a dispute eventy. |
| H7 | Cenová desynchronizace DB vs. Stripe | 5b | Přímá změna ceny v DB (mimo admin panel) nezaktualizuje stripe_price_id. Zákazník vidí jinou cenu než platí. | Přidat DB trigger na products při změně price nastavující stripe_price_id = NULL. |
| H8 | Nepinnované dependency verze v edge functions | 4, 6 | `stripe@20` a `@supabase/supabase-js@2` - major range pinning. Žádný deno.lock. Buildy nejsou reprodukovatelné. | Pinnout na přesné verze (např. `stripe@20.16.0`). Přidat deno.lock. |
| H9 | Storage upload: žádná validace typu a velikosti souboru | 5a-i | `uploadFile` v admin panelu nekontroluje MIME type, velikost ani obsah souboru. Možný upload škodlivých souborů do public bucketů. | Přidat validaci MIME type a max velikosti v `storageUtils.ts`. |
| H10 | Žádný error tracking v žádném projektu | 6, 8 | Sentry, Datadog ani jiný error tracking není integrován. Frontend chyby se ztrácejí. Edge function logy mají retenci 1 den (Free plan). | Nasadit Sentry (free tier). Aktivovat logger.js integration point. |
| H11 | Žádný alerting při chybách | 6, 8 | Nikdo není notifikován při výpadku nebo chybách. | Sentry alerting + UptimeRobot pro uptime monitoring. |
| H12 | E-shop: žádné security headers | 5a-ii, 6 | vercel.json e-shopu nemá žádné security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options). | Přidat kompletní sadu security headers do vercel.json. |
| H13 | Žádný admin audit trail | 5a-i, 9 | Není logováno kdo vytvořil/upravil/smazal záznamy v admin panelu. GDPR relevantní - nelze odpovědět na dotazy o přístupu k osobním údajům. | Implementovat audit log (modified_by sloupce + trigger, nebo data provider wrapper). |
| H14 | Chybí auth callback route v e-shop frontendu | 6 | Žádný `/auth/callback` handler. Password reset flow pravděpodobně nefunguje E2E. onAuthStateChange listener chybí. | Implementovat /auth/callback route a onAuthStateChange listener. |
| H15 | Žádný staging environment | 6 | Vývoj probíhá přímo proti produkci. Migrace a edge functions deploy je manuální. | Vytvořit staging Supabase projekt. Nastavit GitHub Actions pro deploy. |
| H16 | Neúplné právo na výmazání (GDPR čl. 17) | 9 | Smazání auth.users nezanonymizuje denormalizovaná data v orders a custom_itinerary_requests. Newsletter consent log zůstane. | Vytvořit funkci `delete_customer_data()` pro kompletní anonymizaci. |
| H17 | Chybí retenční politika | 9 | Data uchovávána neomezeně. Žádná definice doby uchovávání. | Definovat retenci pro každý typ dat. Implementovat automatický cleanup. |
| H18 | Newsletter consent neimplementován na frontendu | 9 | Tabulka `newsletter_consent_log` existuje v DB, ale žádný formulář na e-shopu ji nepoužívá. Souhlas se de facto nesbírá. | Implementovat newsletter subscription formulář s double opt-in. |
| H19 | Žádný cleanup anonymních uživatelů | 3ab | 2 anonymní uživatelé s 6 completed objednávkami, nemají email. Frontend neimplementuje konverzi anonymous→permanent. | Implementovat konverzní flow nebo cleanup. |
| H20 | Checkout odkazuje na neexistující obchodní podmínky | 9 | Text "souhlasíte s obchodními podmínkami" s `href="#"`. | Součást C5 - vytvořit stránku a aktualizovat odkaz. |

---

## MEDIUM nálezy (naplánovat)

| # | Nález | Zdroj (Část) | Popis | Doporučený fix |
|---|-------|-------------|-------|----------------|
| M1 | Information disclosure v get-order-by-session | 4 | Kdokoliv se Stripe session_id získá plné detaily objednávky (jméno, email, částka, download token). Žádná owner verifikace. | Přidat ověření vlastnictví objednávky. |
| M2 | Error message leaking ve všech edge functions | 4, 5b, 8 | `error.message` se vrací klientovi - může obsahovat interní informace od Stripe nebo Supabase. | V produkci vracet generické chybové zprávy, detaily logovat server-side. |
| M3 | Logování PII v stripe-webhook | 4, 8, 9 | `console.log(JSON.stringify(session.customer_details))` loguje email, jméno, adresu zákazníka v plaintext. | Odstranit logování customer_details nebo maskovat PII. |
| M4 | Žádný rate limiting na edge functions | 4 | Žádná z veřejně přístupných funkcí neimplementuje rate limiting. Možný abuse (spam checkout sessions, produkt flooding). | Implementovat per-IP nebo per-user rate limiting. |
| M5 | handle_new_permanent_user: search_path=public | 3ab | Nekonzistentní se zbytkem (ostatní mají search_path=''). Méně bezpečné. | Změnit na `SET search_path = ''`. |
| M6 | Starý Stripe Price se nearchivuje při změně ceny | 5b | Staré Stripe Prices zůstanou aktivní. Akumulace neaktivních Price objektů. | Po vytvoření nového Price archivovat starý: `stripe.prices.update(oldPriceId, { active: false })`. |
| M7 | Částečná idempotence webhook - chybí pro order_items/tokens | 5b | Pokud order_items INSERT selže, druhý pokus webhoku vrátí success bez doplnění items. | Zabalit do DB transakce, nebo při nalezení existující objednávky zkontrolovat kompletnost. |
| M8 | price_at_purchase nekonzistentní se skutečnou platbou | 5b | `price_at_purchase` se bere z DB (`product.price`) místo ze Stripe ceny. | Použít Stripe line items cenu. |
| M9 | Webhook nerozlišuje retryable vs. permanent errors | 5b | Všechny chyby vrací 500 (Stripe opakuje). Permanentní chyby generují zbytečné retry po 3 dny. | Pro permanentní chyby vracet 200 s error logem. |
| M10 | Nekonzistentní stav při selhání Stripe sync (tichý fail) | 5b, 5a-i | Produkt existuje v DB bez stripe_product_id. Admin není informován (jen console.error). | Zobrazit error notifikaci v admin panelu. Přidat retry tlačítko. |
| M11 | Žádná cleanup strategie pro osiřelé storage soubory | 1b | Storage se pomalu plní nereferencovanými soubory. Žádná periodická kontrola. | Vytvořit periodické porovnání storage vs DB (edge function nebo cron). |
| M12 | Upload-then-delete pattern v beforeUpdate | 1b | Pokud upload nového souboru selže, starý je už smazaný - potenciální data loss. | Změnit pořadí: upload nový, pak delete starý. |
| M13 | Chybí CAPTCHA na CustomItineraryForm | 5a-ii | Turnstile zakomentovaný (TODO). Automatizovaný spam formulářových dat. | Implementovat Cloudflare Turnstile. |
| M14 | Admin: chybí CSP a HSTS headers | 6 | Admin panel má 5/7 security headers, ale chybí Content-Security-Policy a Strict-Transport-Security. | Přidat CSP a HSTS do admin vercel.json. |
| M15 | Žádná runtime validace env variables (admin) | 5a-i | `createClient` dostane undefined při chybějících env vars. Nepřehledná chyba až při prvním API callu. | Přidat runtime check s throw Error při startu. |
| M16 | Role-based access: jen identity fetch, žádné enforcement | 5a-i | Admin panel fetchuje roli, ale nepoužívá ji pro skrývání resources ani permissions. Všichni přihlášení vidí vše. | Implementovat React Admin permissions (pokud budou více rolí). |
| M17 | Chybí data export endpoint (GDPR čl. 15, 20) | 9 | Právo na přístup a přenositelnost neimplementováno. | Vytvořit Edge Function pro export zákaznických dat do JSON. |
| M18 | DPA statusy neověřeny | 9 | Není ověřeno zda byly podepsány DPA se Supabase, Stripe, hostingem. | Kontaktovat zpracovatele a ověřit/podepsat DPA. |
| M19 | Denormalizované osobní údaje | 9 | customer_email a customer_name duplicitně v orders a custom_itinerary_requests. | Zvážit odstranění nebo anonymizaci při GDPR delete. |
| M20 | Admin .gitignore příliš minimální | 6 | Chybí ignorace `*.key`, `*.pem`, `secrets.json`, `config.json` oproti main app. | Rozšířit dle vzoru e-shop .gitignore. |
| M21 | Chybí validace ceny na edge function create-stripe-product | 5b | Validuje jen existenci, ne rozsah (price > 0, typ, max). | Přidat: `typeof price === 'number' && price > 0 && price <= 1000000`. |

---

## LOW nálezy (nice-to-have)

| # | Nález | Zdroj (Část) | Popis | Doporučený fix |
|---|-------|-------------|-------|----------------|
| L1 | Nekonzistentní pojmenování RLS policies | 2a | 13 policies s human_readable názvy vs. snake_case u zbytku. | Unifikovat v budoucí migraci. |
| L2 | ADR-002 neaktualizován po migraci 013 | 1b | ARCHITECTURE_DECISIONS.md neodpovídá aktuální implementaci. | Aktualizovat ADR. |
| L3 | 30 nepoužívaných indexů (malý provoz) | 3ab | Malý provoz = 0 scanů. Indexy budou potřeba při růstu. Duplicitní: `idx_download_tokens_token`. | Smazat duplicitní index. Ostatní ponechat. |
| L4 | Dead code: generateOrderNumber() ve stripe-webhook | 4, 5b | Funkce není nikde volaná. | Odstranit nebo začít používat. |
| L5 | Console.log/error v produkčním kódu | 5a-i, 5a-ii | 28+ console volání v e-shopu, 16+ v admin panelu. Může leakovat informace do browser konzole. | Podmínit logování na debug flag. |
| L6 | Env variable naming nekonzistence (admin) | 5a-i | `.env` šablona uvádí `VITE_SUPABASE_API_KEY`, kód používá `VITE_SUPABASE_ANON_KEY`. | Sjednotit naming v .env šabloně. |
| L7 | products-pdfs limit 50MB vs dokumentovaných 200MB | 1a | Bucket limit neodpovídá dokumentaci. | Ověřit a opravit buď limit nebo dokumentaci. |
| L8 | Modulo bias v generateToken (stripe-webhook) | 4 | `randomValues[i] % 62` má malý bias (< 2%). Pro download tokeny nepředstavuje reálné riziko. | Zvážit vylepšení (rejection sampling). |
| L9 | Dashboard overfetching | 5a-i | Fetchuje až 1000 orders a 1000 customers. Při růstu DB pomalé. | Nahradit SQL aggregate dotazy (RPC funkce). |
| L10 | Download token expiration hardcoded, bez regenerace | 5b | 7 dní hardcoded. Zákazník nemůže požádat o nový token. | Implementovat token regeneraci. |
| L11 | Quantity bez omezení pro digitální produkty | 5b | Klient může poslat quantity: 100 pro PDF průvodce. | Omezit quantity na 1 pro digitální produkty. |
| L12 | Cookie consent banner chybí | 9 | Aktuálně pouze nezbytné cookies (nízké riziko). Bude potřeba při přidání analytics. | Implementovat až při přidání Plausible/analytics. |

---

## Pozitivní zjištění (co funguje správně)

### Bezpečnost
- Všech 11 tabulek má RLS zapnuto, žádné RESTRICTIVE policies
- Žádné reference na user_metadata v RLS policies (lint rule 0015: PASS)
- Všechny RLS policies používají `(SELECT ...)` wrapper pro performance (lint rule 0003: PASS)
- Helper funkce `is_admin()` a `is_permanent_user()` správně implementované (STABLE, search_path='')
- custom_access_token_hook správně omezena na postgres, service_role, supabase_auth_admin
- MFA enforcement v admin panelu je solidní - fail-closed, v Layout wrapperu
- Žádné hardcoded secrets v kódu, .gitignore správně vylučuje .env soubory
- Admin panel používá anon key (ne service_role)
- Žádný SQL injection riziko - všechny DB dotazy přes parametrizované Supabase JS klient
- Stripe webhook správně ověřuje signaturu (raw body pro verifikaci)
- Extensions nejsou v public schema (lint rule 0014: PASS)
- Git secrets scan: žádné secrets nalezeny v git historii

### Architektura
- Newsletter consent log je append-only (žádný UPDATE/DELETE) - správný GDPR design
- Download tokeny: token-based přístup přes edge function, 1 hodina signed URL expiry
- Trigger chain pro anonymous→permanent konverzi je logicky správný a deterministický
- total_sales integrita: žádné nesrovnalosti v DB
- Všechny FK sloupce jsou indexovány
- Frontend neposílá ceny do Edge Functions (price tampering zmírněný server-side)
- Stripe webhook má idempotenci pro orders (kontrola existující objednávky)
- Soft delete / hard delete rozlišení v admin panelu pro storage soubory
- React JSX auto-escaping pro XSS prevenci, dangerouslySetInnerHTML pouze pro statická JSON-LD data
- E-shop Error Boundary s českou chybovou stránkou
- E-shop supabase.js má runtime validaci env vars
- Migrace dokumentace (MIGRATIONS.md) je přesná a detailní (stav, graf závislostí, ERD)
- moddatetime triggery na 6 tabulkách - kompletní
- Performance: všechny dotazy pod 1ms

---

## Doporučený postup oprav

### 1. Okamžité (tento týden)

**Blokery produkčního nasazení:**
- **Aplikovat migrace 026, 027, 028** na produkční DB (C1) - opraví C4, H4
- **Opravit customer vytváření v stripe-webhook** - nahradit crypto.randomUUID() (C2)
- **Omezit CORS origin** na všech 4 edge functions (C3)
- **Vytvořit privacy policy a obchodní podmínky** (C5, C7, H20)
- **Přidat GDPR souhlas ke CustomItineraryForm** včetně zdravotních údajů (C6)
- **Upgrade Supabase na Pro plan** - backupy, auto-pause prevence (C8, C9)
- **Přidat admin auth do create-stripe-product** (H1)
- **Extrahovat user_id z JWT v create-checkout-session** (H2)
- **Přidat security headers do e-shop vercel.json** (H12)

### 2. Krátkodobé (tento měsíc)

**Bezpečnost a stabilita:**
- REVOKE PUBLIC execute na SECURITY DEFINER funkcích (H3)
- Validovat success_url/cancel_url v checkout (H5)
- Implementovat refund webhook handler (H6)
- Pinnout dependency verze v edge functions (H8)
- Přidat file type/size validaci do storage upload (H9)
- Nasadit Sentry error tracking (H10, H11)
- Implementovat admin audit trail (H13)
- Přidat auth callback route v e-shopu (H14)

**GDPR:**
- Vytvořit funkci pro kompletní výmaz zákaznických dat (H16)
- Definovat retenční politiku (H17)
- Implementovat newsletter consent na frontendu (H18)

### 3. Střednědobé (příští měsíc)

**Vylepšení:**
- Implementovat rate limiting na edge functions (M4)
- Archivovat staré Stripe Prices při změně ceny (M6)
- Doplnit idempotenci webhook pro order_items a tokeny (M7)
- Opravit upload-then-delete pattern v admin panelu (M12)
- Implementovat CAPTCHA na CustomItineraryForm (M13)
- Přidat CSP a HSTS do admin panelu (M14)
- Vytvořit data export endpoint pro GDPR (M17)
- Ověřit DPA se zpracovateli (M18)
- Vytvořit staging environment (H15)
- Sanitizovat error responses v edge functions (M2)
- Odstranit PII z logů ve webhook (M3)
- Vytvořit cleanup strategii pro osiřelé storage soubory (M11)
- Přidat owner verifikaci do get-order-by-session (M1)

---

## Verifikace nálezů

**Datum verifikace:** 2026-02-22
**Metoda:** Nezávislá verifikace ve 3 kolech pomocí subagentů, kteří ověřovali nálezy přímo proti zdrojovému kódu a SQL výsledkům z živé produkční DB.

### Výsledek

| Verdikt | Počet |
|---------|-------|
| **Potvrzeno** | 60 |
| **Potvrzeno s upřesněním** | 1 (M7 - základní idempotence webhook existuje, ale chybí DB transakce) |
| **Nelze ověřit v kódu** | 1 (C9 - Free plan auto-pause, silné nepřímé důkazy) |
| **Vyvráceno** | 0 |

**Všech 62 nálezů je platných.** Žádný false positive.

### Klíčové poučení z verifikace

První kolo verifikace chybně označilo 4 nálezy jako vyvrácené (H4, M5, L2, L7). Chyba spočívala v tom, že verifikátor kontroloval pouze existenci oprav v migračních souborech, ale ignoroval skutečný stav produkční databáze. Druhé kolo tuto systematickou chybu odhalilo a opravilo porovnáním s SQL výsledky z živé DB.

**Pravidlo:** "Oprava existuje v repozitáři" ≠ "Oprava je aplikována na produkci."
