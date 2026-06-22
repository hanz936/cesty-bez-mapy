# Cookie banner — právní determinace (PRIV-03)

**Datum:** 2026-06-22 (determinace 2026-06-21, doplněno po nezávislé verifikaci 2026-06-22) · **Závěr: souhlasná cookie lišta NENÍ potřeba.**

## Zjištění (firsthand audit kódu)
- **Žádné manuální cookies** v `src/` (`document.cookie`, js-cookie, `Cookies.*` = 0 výskytů).
- **Analytika: Umami cookieless** (`src/lib/analytics.js` → `window.umami`; produkční injektáž `vite/umami-plugin.js` se `data-do-not-track="true"`, `umamiBeforeSend` čistí `session_id`/`token` z URL) — neukládá cookies ani trvalé identifikátory.
- **`localStorage`/`sessionStorage` jen funkční/nezbytné:**
  - košík — `src/contexts/CartContext.jsx` (`CART_STORAGE_KEY` = položky košíku, nezbytný stav pokladny);
  - dedup příznak nákupu — `src/pages/OrderConfirmation.jsx` (`sessionStorage` klíč `cbm_purchase_tracked_<sessionId>`, brání dvojímu započtení tržby v Umami při refreshi; není to „data objednávky");
  - Supabase auth session — interní úložiště SDK `@supabase/supabase-js` (`persistSession` default, mimo aplikační kód v `src/`), nezbytné pro přihlášení.
- **Žádné reklamní ani 3rd-party sledovací cookies.** (YouTube v blogu běží v režimu bez cookies; cookies až po spuštění videa — viz zásady.)

## Právní opora (k 06/2026)
**Režim:** ePrivacy směrnice 2002/58/ES, čl. 5(3) zůstává v platnosti — návrh ePrivacy *nařízení* byl Komisí **stažen 11. 2. 2025**, takže směrnice dál platí.

1. **Výjimka „strictly necessary" (čl. 5(3)).** Souhlas se nevyžaduje pro úložiště/přístup nezbytné k poskytnutí služby, kterou uživatel výslovně požaduje. Košík, přihlašovací (auth) session i stav dokončení objednávky pod tuto výjimku spadají — potvrzeno **WP29 Opinion 04/2012** (Criterion B: user-input/košík + autentizační cookies) a aktuální **ICO guidance 2026** (příklady „strictly necessary": košík, přihlašovací session). Technický rozsah čl. 5(3) viz **EDPB Guidelines 2/2023 v2.0** (přijaté 7. 10. 2024).
2. **Cookieless analytika bez identifikátorů.** Umami neukládá cookies ani trvalé ID → čl. 5(3) se na ni pro „cookies" ani nespouští; odpovídá kritériím výjimky pro měření návštěvnosti (CNIL „mesure d'audience", 4. 7. 2025; ICO „statistical purposes"). PURCHASE event posílá jen agregovanou tržbu (`revenue`/`items`) **bez Order ID a bez osobních údajů**, takže zůstává v mezích výjimky pro měření návštěvnosti.

## Přežívající povinnosti i bez souhlasu — SPLNĚNO v zásadách ochrany
Výjimka ze souhlasu neruší **transparenci** a **právo na námitku** (CNIL 07/2025, ICO 2026). Obojí web plní na stránce zásad (`src/pages/Privacy.jsx`):
- Umami uveden jako analytický nástroj (EU), výslovně „bez cookies, bez osobních údajů, neidentifikuje jednotlivce".
- Vyjmenováni zpracovatelé/úložiště dat v EU.
- Uvedeno **právo na námitku** (kontakt `cestybezmapy@gmail.com`) + tracker ctí prohlížečové **Do-Not-Track**.

## Závěr
Web neukládá žádné non-essential cookies ani trackery vyžadující souhlas → **souhlasná cookie lišta se nezavádí.** Transparentní informace o cookieless analytice a právo na námitku jsou pokryty v zásadách ochrany osobních údajů. **Re-posoudit při přidání** reklamních/3rd-party trackerů, cookies třetích stran nebo měření s identifikátory/Order ID.

## Zdroje (06/2026)
- ePrivacy směrnice 2002/58/ES, čl. 5(3); stažení ePrivacy nařízení COM(2025) 45 (11. 2. 2025).
- WP29 Opinion 04/2012 (wp194) — Cookie Consent Exemption.
- EDPB Guidelines 2/2023 v2.0 — Technical Scope of Art. 5(3) (7. 10. 2024).
- CNIL — Cookies: solutions pour la mesure d'audience (4. 7. 2025); ICO — storage & access / statistical purposes (2026).
- Umami docs — FAQ „no cookies / no PII".
