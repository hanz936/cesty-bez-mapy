# Cast 9: GDPR a ochrana osobnich udaju

## Metadata

| Polozka | Hodnota |
|---------|---------|
| Datum auditu | 2026-02-19 |
| Auditor | Claude Code (Opus 4.6) |
| Scope | E-shop + Admin panel + Supabase DB |
| Verze projektu | main branch, commit 0af4e2c |

---

## 1. Prehled osobnich udaju v databazi

### 1.1 Tabulky obsahujici osobni udaje

| Tabulka | Osobni udaje | Zakonny zaklad | Poznamka |
|---------|-------------|----------------|----------|
| `customers` | email, name, phone, ecomail_subscriber_id | Plneni smlouvy (cl. 6/1b) | Hlavni tabulka zakazniku, id = auth.users.id |
| `orders` | customer_email, customer_name | Plneni smlouvy (cl. 6/1b) + zakonny pozadavek (uctovni doklady) | Denormalizovane udaje pro rychle dotazy |
| `custom_itinerary_requests` | customer_email, customer_name, form_data (JSONB) | Plneni smlouvy (cl. 6/1b) | form_data obsahuje potencialne citlive udaje (zdravotni omezeni) |
| `newsletter_consent_log` | email, ip_address, user_agent | Souhlas (cl. 6/1a) | GDPR audit log - append only |
| `auth.users` | email, raw_user_meta_data | Plneni smlouvy (cl. 6/1b) | Supabase spravovana tabulka |
| `download_tokens` | (neprime - order_id -> orders) | Plneni smlouvy (cl. 6/1b) | Token s expiraci 7 dni |
| `integration_logs` | metadata (JSONB - muze obsahovat order_id, email) | Opravneny zajem (cl. 6/1f) | Provozni logy |

### 1.2 Detailni analyza form_data v custom_itinerary_requests

Pole `form_data` (JSONB) uklada:
- Cestovni preference (typ dovolene, delka, rozpocet)
- Pocet osob a skladba skupiny (rodina s detmi - vek deti)
- **Zdravotni omezeni** (`health_restrictions`) - **ZVLASTNI KATEGORIE udaju dle cl. 9 GDPR**
- Cestovani s mazlickem
- Dalsi informace (volny text)

**SEVERITY: HIGH** - Zdravotni udaje jsou zvlastni kategorii osobnich udaju. Jejich zpracovani vyzaduje explicitni souhlas (cl. 9/2a) nebo jiny zakonny zaklad z cl. 9/2.

### 1.3 Sifrovani dat

| Vrstva | Stav | Poznamka |
|--------|------|----------|
| Sifrovani pri prenosu (TLS/SSL) | OK | Supabase vynucuje HTTPS |
| Sifrovani v klidu (at rest) | OK | Supabase PostgreSQL - transparentni sifrovani disku |
| Sifrovani na urovni sloupcu | CHYBI | Citlive udaje (health_restrictions, phone) nejsou sifrovany na urovni sloupcu |

---

## 2. Newsletter consent

### 2.1 Struktura tabulky newsletter_consent_log

```
id                    uuid PK
email                 text NOT NULL
consent_given         boolean NOT NULL
source                text NOT NULL
ip_address            inet (nullable)
user_agent            text (nullable)
privacy_policy_version text (nullable)
created_at            timestamptz NOT NULL DEFAULT now()
```

### 2.2 Hodnoceni implementace

| Aspekt | Stav | Detail |
|--------|------|--------|
| Explicitni opt-in | OK (design) | `consent_given = true/false`, ne predvyplneny checkbox |
| Source tracking | OK | Pole `source` sleduje odkud souhlas prisel |
| Timestamp | OK | `created_at` automaticky |
| IP logging | OK (design) | Pole `ip_address` existuje |
| User agent | OK (design) | Pole `user_agent` existuje |
| Privacy policy version | OK (design) | Pole `privacy_policy_version` existuje |
| Withdrawal of consent | CASTECNE | Lze vlozit zaznam s `consent_given = false`, ale **neexistuje UI** pro odvolani souhlasu |
| RLS politiky | OK | Public INSERT s validaci (028), admin-only SELECT |

### 2.3 Kriticke problemy newsletter consent

**SEVERITY: HIGH** - **Newsletter consent neexistuje na frontendu.** Tabulka `newsletter_consent_log` je pripravena v DB, ale **zadny formular na e-shopu ji nepouziva**. Neni newsletter subscription form, neni cookie pro newsletter, neni checkbox v checkoutu. Souhlas se de facto nesbirá.

**SEVERITY: MEDIUM** - **Neexistuje mechanismus pro odvolani souhlasu** (unsubscribe odkaz/stranka). Pokud se newsletter spusti, je nutne implementovat.

---

## 3. Formulare sbirajici osobni udaje

### 3.1 CustomItineraryForm (`src/pages/CustomItineraryForm.jsx`)

| Aspekt | Stav | Detail |
|--------|------|--------|
| Sbirane udaje | Jmeno, email, cestovni preference, zdravotni omezeni, dalsi | Rozsahly formular (5 kroku) |
| Informacni povinnost | **CHYBI** | Zadna informace o zpracovani osobnich udaju pred odeslanim |
| Souhlas se zpracovanim | **CHYBI** | Zadny GDPR checkbox |
| Souhlas pro zvlastni kategorii (zdravi) | **CHYBI** | Zdravotni udaje vyzaduji explicitni souhlas |
| Data minimizace | CASTECNE | Vetsina poli neni `required`, ale formular je rozsahly |
| Spam ochrana | **CHYBI** | Turnstile je zakomentovany (TODO v kodu, radek 9) |
| Validace | MINIMALNI | Pouze name a email (radek 93) |

**SEVERITY: CRITICAL** - Formular sbira zdravotni udaje (`healthRestrictions`, radek 977) bez explicitniho souhlasu se zpracovanim zvlastni kategorie osobnich udaju. Toto je primy rozpor s cl. 9 GDPR.

### 3.2 Contact (`src/pages/Contact.jsx`)

| Aspekt | Stav | Detail |
|--------|------|--------|
| Sbirane udaje | Jmeno, email, predmet, zprava | Standardni kontaktni formular |
| Backend zpracovani | **SIMULOVANO** | `setTimeout(resolve, 1500)` - data se nikam neodesilaji (radek 61) |
| Informacni povinnost | **CHYBI** | Zadna informace o zpracovani |
| GDPR dopad | NIZKY (aktualne) | Protoze data se realne neposilaji |

**SEVERITY: LOW** (aktualne), **HIGH** (po napojeni na backend) - Formulář momentalne simuluje odeslani. Pred napojenim na real backend nutno pridat GDPR informace.

### 3.3 Checkout (`src/pages/Checkout.jsx`)

| Aspekt | Stav | Detail |
|--------|------|--------|
| Sbirane udaje | Platebni udaje (pres Stripe), user_id | Redirect na Stripe Checkout |
| Souhlas s podminkami | **NEUPLNY** | Text "Pokracovanim souhlasite s nasimi obchodnimi podminkami" (radek 313), ale link vede na `href="#"` - stranka neexistuje |
| Newsletter checkbox | CHYBI | V checkoutu neni moznost prihlaseni k newsletteru |
| Informacni povinnost | **CHYBI** | Zadna informace o zpracovani osobnich udaju |
| Stripe GDPR | OK | Platebni udaje zpracovava primo Stripe |

**SEVERITY: HIGH** - Odkaz na obchodni podminky vede na `#` (neexistujici stranka). Zakaznik de facto souhlasi s necim, co neexistuje.

---

## 4. Prava subjektu udaju (cl. 15-22 GDPR)

### 4.1 Pravo na pristup (cl. 15)

| Stav | NENI IMPLEMENTOVANO |
|------|---------------------|
| Detail | Neexistuje zadny endpoint, stranka ani funkce pro export zakaznickych dat |
| Doporuceni | Vytvorit Edge Function pro export vsech dat zakaznika ve formatu JSON |

### 4.2 Pravo na opravu (cl. 16)

| Stav | NENI IMPLEMENTOVANO |
|------|---------------------|
| Detail | Zakaznik nema moznost editovat sve udaje (neni ucet/profil sekce) |
| Doporuceni | Implementovat zakaznicky profil nebo kontaktni formular pro opravu |

### 4.3 Pravo na vymazani (cl. 17)

| Stav | CASTECNE (pouze pres DB) |
|------|--------------------------|
| Detail | FK `customers.id -> auth.users(id) ON DELETE CASCADE` (migrace 026) zajistuje kaskadove smazani customers zaznamu pri smazani auth.users. Ale: |
| Problemy | |

**Co se stane pri smazani uzivatele z auth.users:**
1. `customers` - **CASCADE DELETE** (migrace 026) - smazano
2. `orders` - `customer_id` nastaven na NULL (`ON DELETE SET NULL`) - **objednavky ZUSTANOU**, ale `customer_email` a `customer_name` zustanou v tabulce (denormalizovane)
3. `custom_itinerary_requests` - `customer_id` nastaven na NULL (`ON DELETE SET NULL`) - **data ZUSTANOU**, vcetne `customer_email`, `customer_name` a `form_data` se zdravotnimi udaji
4. `newsletter_consent_log` - **ZADNA VAZBA** na customers/auth.users - data zustanou
5. `download_tokens` - CASCADE pres orders -> zustanou (orders zustanou)
6. `integration_logs` - **ZADNA VAZBA** - data zustanou
7. Storage soubory - **ZADNA AUTOMATICKA MAZANI**

**SEVERITY: HIGH** - Smazani uzivatele nesplnuje pravo na vymazani. Denormalizovane osobni udaje (email, jmeno) zustanou v orders a custom_itinerary_requests. Newsletter consent log zustane. Neexistuje funkce pro kompletni vymazani.

### 4.4 Pravo na prenositelnost (cl. 20)

| Stav | NENI IMPLEMENTOVANO |
|------|---------------------|
| Detail | Neexistuje export dat ve strojove citelnem formatu (JSON/CSV) |

### 4.5 Pravo na odvolani souhlasu (cl. 7)

| Stav | NENI IMPLEMENTOVANO |
|------|---------------------|
| Detail | Newsletter consent log umoznuje zaznam s `consent_given = false`, ale neexistuje UI |

---

## 5. Cookies a sledovani

### 5.1 Prehled cookies a storage

| Typ | Klic | Ucel | Osobni udaje | Nutny souhlas |
|-----|------|------|-------------|---------------|
| localStorage | `cbm_cart` | Obsah kosiku (ID, title, price, slug produktu) | NE | NE (funkcni) |
| localStorage | `sb-*-auth-token` | Supabase auth session (JWT token) | ANO (user ID, email v tokenu) | NE (nezbytne) |
| Cookies | Supabase session cookies | Autentizace | ANO | NE (nezbytne) |

### 5.2 Third-party tracking

| Sluzba | Stav | Detail |
|--------|------|--------|
| Google Analytics | **NEPRITOMNO** | Neni v package.json, neni v index.html |
| Meta Pixel | **NEPRITOMNO** | Neni v kodu |
| Plausible Analytics | **NENI IMPLEMENTOVANO** | Zmineno v ROADMAP.md jako plan (Faze 6), aktualne neaktivni |
| Jine tracking | **NEPRITOMNO** | Zadne tracking skripty |

### 5.3 Cookie consent banner

| Stav | **CHYBI** |
|------|-----------|
| Detail | Na webu neni zadny cookie consent banner ani mechanismus |
| Dopad | Aktualne pouziva pouze nezbytne cookies (auth session), pro ktere neni nutny souhlas dle ePrivacy smernice. **Pokud se prida analytics (Plausible), bude nutny consent banner.** |
| Aktualni riziko | NIZKE - pouzivaji se pouze nezbytne cookies |

---

## 6. Informacni povinnost (cl. 13-14 GDPR)

### 6.1 Privacy policy

| Stav | **NEEXISTUJE** |
|------|----------------|
| Detail | Footer obsahuje odkaz "Ochrana udaju" smerujici na `href="#soukromi"` - stranka neexistuje |
| Dopad | Poruseni cl. 13 GDPR - subjekty udaju nejsou informovany o zpracovani |

### 6.2 Obchodni podminky

| Stav | **NEEXISTUJI** |
|------|----------------|
| Detail | Footer obsahuje odkaz "Obchodni podminky" smerujici na `href="#podminky"` - stranka neexistuje. Checkout odkazuje na obchodni podminky, ale link vede na `#` |
| Dopad | Zakaznik "souhlasi" s neexistujicim dokumentem |

### 6.3 Informace pri sbirani dat

| Formular | Informacni povinnost | Stav |
|----------|---------------------|------|
| CustomItineraryForm | Kdo zpracovava, ucel, doba uchovani, prava | **ZCELA CHYBI** |
| Contact | Kdo zpracovava, ucel | **ZCELA CHYBI** |
| Checkout | Informace o zpracovani platby, odkaz na podminky | **NEUPLNE** (odkaz na neexistujici podminky) |

**SEVERITY: CRITICAL** - Kompletni absence informacni povinnosti dle cl. 13 GDPR. Pri sbirani osobnich udaju musi byt subjekt informovan o: totoznosti spravce, ucelu zpracovani, zakonnem zaklade, dobe uchovani, pravech subjektu, kontaktu na spravce.

---

## 7. Technicka opatreni (cl. 32 GDPR)

| Opatreni | Stav | Detail |
|----------|------|--------|
| Sifrovani pri prenosu | OK | HTTPS/TLS (Supabase default) |
| Sifrovani v klidu | OK | Supabase PostgreSQL disk encryption |
| Pristupova prava (RLS) | OK | Row Level Security na vsech tabulkach |
| MFA pro adminy | OK | TOTP povinne pro admin panel |
| Audit trail | **CASTECNE** | `integration_logs` pro API volani, ale **chybi log pristupu k osobnim udajum** (identifikovano take v cast-5a-i) |
| Data minimizace | **CASTECNE** | Nektere udaje denormalizovany (customer_email/name v orders i custom_itinerary_requests) |
| Retencni politika | **CHYBI** | Zadna definice doby uchovani dat |
| Cleanup expired tokens | CASTECNE | `cleanup_expired_tokens()` existuje, ale pg_cron vyzaduje Pro plan |

---

## 8. Zpracovatel (cl. 28 GDPR)

### 8.1 DPA (Data Processing Agreement) status

| Zpracovatel | DPA | Poznamka |
|-------------|-----|----------|
| Supabase | K OVERENI | Supabase nabizi DPA na pozadani - je nutne overit, zda byl podepsan |
| Stripe | K OVERENI | Stripe ma standardni DPA - je nutne overit, zda byl akceptovan |
| GitHub Pages (hosting) | K OVERENI | Pokud web bezi na GH Pages, je nutne DPA s GitHubem |
| Ecomail | K OVERENI | `ecomail_subscriber_id` v DB naznacuje planovany Ecomail - pred aktivaci nutny DPA |

---

## 9. Data minimizace a retence

### 9.1 Data minimizace

| Problem | Tabulka | Detail |
|---------|---------|--------|
| Denormalizovane osobni udaje | orders, custom_itinerary_requests | `customer_email` a `customer_name` duplicitne ulozeny mimo `customers` tabulku |
| Siroky form_data | custom_itinerary_requests | JSONB obsahuje zdravotni udaje, ktere nemusi byt nezbytne |
| IP a user agent | newsletter_consent_log | Legitimni pro GDPR proof, ale je nutne definovat retenci |

### 9.2 Retencni politika

| Typ dat | Aktualni retence | Doporuceni |
|---------|-----------------|------------|
| Zakaznicke udaje | Neomezena | 3 roky po posledni objednavce (+ zakonny pozadavek pro uctovni doklady) |
| Objednavky | Neomezena | 10 let (ceske uctovni predpisy), pak anonymizovat |
| Custom itinerary requests | Neomezena | 1 rok po dokonceni, pak anonymizovat form_data |
| Newsletter consent log | Neomezena | Po celou dobu aktivniho souhlasu + 3 roky po odhlaseni |
| Download tokens | Expiraci (7 dni) | OK, ale cleanup vyzaduje pg_cron (Pro plan) |
| Integration logs | Neomezena | 1 rok, pak archivovat/mazat |

**SEVERITY: HIGH** - Neexistuje zadna retencni politika. Data jsou uchovavana neomezene.

---

## 10. Admin panel - pristup k osobnim udajum

### 10.1 CustomerList (`src/resources/customers/CustomerList.tsx`)

Zobrazuje: jmeno, email, telefon, celkem utraceno, Ecomail ID, datum vytvoreni.

### 10.2 CustomerEdit (`src/resources/customers/CustomerEdit.tsx`)

Umoznuje editaci: jmeno, email, telefon, Ecomail ID. Zobrazuje objednavky a zakazkove pozadavky.

### 10.3 Audit trail pro pristup k udajum

| Stav | **CHYBI** |
|------|-----------|
| Detail | Neexistuje zaznam o tom, kdo a kdy pristupoval k osobnim udajum zakazniku v admin panelu |
| GDPR dopad | Nelze odpovidat na dotazy "kdo pristupoval k udajum zakaznika X" |
| Doporuceni | Implementovat audit log pro SELECT/UPDATE operace na tabulce customers |

---

## 11. Souhrnna tabulka nalezu

| # | Nalez | Severity | Kategorie |
|---|-------|----------|-----------|
| 9.1 | **Chybi privacy policy a obchodni podminky** - stranky neexistuji, footer odkazuje na `#` | CRITICAL | Informacni povinnost |
| 9.2 | **CustomItineraryForm sbira zdravotni udaje bez souhlasu** - `healthRestrictions` pole v form_data | CRITICAL | Zvlastni kategorie udaju |
| 9.3 | **Kompletni absence informacni povinnosti u formularu** - zadny formular neinformuje o zpracovani | CRITICAL | Informacni povinnost |
| 9.4 | **Neuplne pravo na vymazani** - smazani auth.users nezanonymizuje denormalizovana data v orders a custom_itinerary_requests | HIGH | Prava subjektu |
| 9.5 | **Chybi retencni politika** - data uchovavana neomezene | HIGH | Data retence |
| 9.6 | **Checkout odkazuje na neexistujici obchodni podminky** - `href="#"` | HIGH | Informacni povinnost |
| 9.7 | **Newsletter consent neimplementovan na frontendu** - tabulka existuje, ale neni pouzivana | HIGH | Souhlas |
| 9.8 | **Chybi audit trail pristupu k osobnim udajum** | HIGH | Technicka opatreni |
| 9.9 | **Chybi data export endpoint** - pravo na pristup a prenositelnost neimplementovano | MEDIUM | Prava subjektu |
| 9.10 | **DPA statusy neovereny** - Supabase, Stripe, hosting | MEDIUM | Zpracovatel |
| 9.11 | **Denormalizovane osobni udaje** v orders a custom_itinerary_requests | MEDIUM | Data minimizace |
| 9.12 | **Contact formular nema backend** - aktualne simulovany, ale pri napojeni bude GDPR relevant | LOW | Informacni povinnost |
| 9.13 | **Cookie consent banner chybi** - aktualne pouze nezbytne cookies, nizke riziko | LOW | Cookies |

---

## 12. Doporuceni k naprave (prioritizovano)

### Priorita 1 - CRITICAL (pred spustenim e-shopu)

#### 12.1 Vytvorit stranku Privacy Policy (`/ochrana-udaju`)

Musi obsahovat:
- Totoznost a kontakt spravce
- Ucel zpracovani a zakonny zaklad pro kazdou kategorii
- Kategorie zpracovavanych udaju
- Prijemci/zpracovatele (Supabase, Stripe)
- Doba uchovani
- Prava subjektu udaju (pristup, oprava, vymazani, prenositelnost, namitka)
- Pravo podat stiznost u UOOU
- Informace o automatizovanem rozhodovani (pokud existuje)

#### 12.2 Vytvorit stranku Obchodni podminky (`/obchodni-podminky`)

#### 12.3 Pridat GDPR informace ke CustomItineraryForm

- Checkbox souhlasu se zpracovanim osobnich udaju (vcetne zdravotnich)
- Odkaz na privacy policy
- Moznost neuvadet zdravotni udaje (udelat pole jasne nepovinne s upozornenim)

#### 12.4 Aktualizovat odkazy ve Footer.jsx

Zmenit `href="#podminky"` a `href="#soukromi"` na skutecne routy.

### Priorita 2 - HIGH (co nejdrive po spusteni)

#### 12.5 Implementovat data deletion funkci

```sql
-- Navrhova SQL funkce pro kompletni vymazani zakaznika
CREATE OR REPLACE FUNCTION delete_customer_data(target_email TEXT)
RETURNS void AS $$
BEGIN
  -- Anonymizovat objednavky (zachovat pro uctovnictvi)
  UPDATE orders SET
    customer_email = 'deleted@anonymized.local',
    customer_name = 'Anonymizovano'
  WHERE customer_email = target_email;

  -- Anonymizovat custom itinerary requests
  UPDATE custom_itinerary_requests SET
    customer_email = 'deleted@anonymized.local',
    customer_name = 'Anonymizovano',
    form_data = '{}'::jsonb
  WHERE customer_email = target_email;

  -- Smazat newsletter consent log
  DELETE FROM newsletter_consent_log WHERE email = target_email;

  -- Smazat customers zaznam (CASCADE z auth.users to udela automaticky)
  DELETE FROM customers WHERE email = target_email;

  -- Poznamka: auth.users je nutne smazat pres Supabase Admin API
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 12.6 Definovat retencni politiku

Vytvorit dokument s dobami uchovani a implementovat automaticky cleanup (pg_cron nebo Edge Function na CRON).

#### 12.7 Implementovat audit trail pro pristup k osobnim udajum

### Priorita 3 - MEDIUM (pred plnym provozem)

#### 12.8 Vytvorit data export Edge Function

Pro splneni prava na pristup (cl. 15) a prenositelnost (cl. 20) - export zakaznickych dat do JSON.

#### 12.9 Overit DPA se zpracovateli

- Kontaktovat Supabase pro DPA
- Overit Stripe DPA akceptaci
- Overit hosting DPA

#### 12.10 Implementovat newsletter consent UI

Pokud se planuje newsletter, implementovat:
- Subscribe formular s checkboxem
- Double opt-in (potvrzeni emailem)
- Unsubscribe odkaz

### Priorita 4 - LOW (po spusteni)

#### 12.11 Cookie consent banner

Implementovat az pri pridani analytics (Plausible). Aktualne pouze nezbytne cookies.

#### 12.12 Napojit Contact formular na backend

Pridat GDPR informace pred napojenim na skutecny backend.

---

## 13. GDPR Checklist - Status

| Pozadavek | Stav | Komentar |
|-----------|------|----------|
| **Zakonny zaklad zpracovani** | CASTECNE | Zaklady existuji (smlouva, souhlas), ale nejsou zdokumentovany pro subjekty |
| **Informacni povinnost (cl. 13)** | NESPLNENO | Chybi privacy policy, informace u formularu |
| **Souhlas pro newsletter** | NEPOUZIVANO | Tabulka pripravena, ale neni na frontendu |
| **Souhlas pro zvlastni kategorii** | NESPLNENO | Zdravotni udaje sbirane bez souhlasu |
| **Pravo na pristup (cl. 15)** | NESPLNENO | Zadny export mechanism |
| **Pravo na opravu (cl. 16)** | NESPLNENO | Zadny zakaznicky profil |
| **Pravo na vymazani (cl. 17)** | CASTECNE | CASCADE na customers, ale denormalizovana data zustanou |
| **Pravo na prenositelnost (cl. 20)** | NESPLNENO | Zadny export |
| **Odvolani souhlasu (cl. 7)** | NESPLNENO | Zadne UI |
| **Sifrovani (cl. 32)** | SPLNENO | TLS + encryption at rest |
| **Pristupova prava** | SPLNENO | RLS + MFA |
| **DPA se zpracovateli (cl. 28)** | NEOVERENO | Nutno overit |
| **Retencni politika** | NESPLNENO | Neni definovana |
| **Cookie consent** | NEPOTREBNE (aktualne) | Pouze nezbytne cookies |

---

## 14. Reference

- Obecne narizeni o ochrane osobnich udaju (GDPR) - Narizeni (EU) 2016/679
- Zakon c. 110/2019 Sb. o zpracovani osobnich udaju (cesky adaptacni zakon)
- Smernice ePrivacy 2002/58/ES (cookies)
- UOOU doporuceni pro e-shopy
- Supabase GDPR compliance: https://supabase.com/docs/company/privacy
- Stripe GDPR: https://stripe.com/privacy
- Predchozi audit: cast-5a-i (audit trail), cast-8 (logování customer_details ve webhook)

---

## 15. Soubory auditovane v teto casti

### E-shop (`/Users/janparma/Desktop/Projekty/cesty-bez-mapy`)
- `src/pages/CustomItineraryForm.jsx` - formular sbirajici osobni udaje vcetne zdravotnich
- `src/pages/Contact.jsx` - kontaktni formular (simulovany submit)
- `src/pages/Checkout.jsx` - checkout s odkazem na neexistujici podminky
- `src/pages/OrderConfirmation.jsx` - potvrzeni objednavky
- `src/contexts/CartContext.jsx` - localStorage pro kosik
- `src/components/layout/Footer.jsx` - odkazy na neexistujici pravni stranky
- `src/App.jsx` - routing (zadna route pro podminky/privacy)
- `index.html` - zadne analytics skripty
- `package.json` - zadne analytics zavislosti

### Migrace (`supabase/migrations/`)
- `001_initial_schema.sql` - definice vsech tabulek s osobnimi udaji
- `013_customers_auth_sync.sql` - customers.id = auth.users.id, lifecycle triggery
- `018_newsletter_consent_performance_index.sql` - partial index pro newsletter
- `026_fix_active_bugs_and_cleanup.sql` - FK customers->auth.users ON DELETE CASCADE
- `028_fix_products_and_newsletter_policies.sql` - RLS pro newsletter consent

### Admin panel (`/Users/janparma/Desktop/Projekty/cesty-bez-mapy-admin`)
- `src/resources/customers/CustomerList.tsx` - zobrazeni osobnich udaju
- `src/resources/customers/CustomerEdit.tsx` - editace osobnich udaju
