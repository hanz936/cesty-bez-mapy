# Cookie banner — právní determinace (PRIV-03)

**Datum:** 2026-06-21 · **Závěr: cookie banner NENÍ potřeba.**

## Zjištění (firsthand audit kódu)
- Žádné manuální cookies v `src/` (`document.cookie`, js-cookie, Cookies.* = 0 výskytů).
- Analytika: **Umami cookieless** (`window.umami`, `src/lib/analytics.js`) — neukládá cookies ani identifikátory.
- `localStorage` jen funkční/nezbytné: košík (`src/contexts/CartContext.jsx`), stav objednávky (`src/pages/OrderConfirmation.jsx`), Supabase auth session.

## Právní opora (EU ePrivacy směrnice, čl. 5(3))
Souhlas NENÍ vyžadován pro úložiště/přístup „strictly necessary for providing
an online service explicitly requested by the user". Košík, přihlášení a stav
objednávky jsou nezbytné pro službu, kterou uživatel výslovně požaduje →
osvobozeno. Cookieless analytika neukládá identifikátory → mimo souhlas.
(Zdroje 06/2026: gdpr.eu/cookies, matomo.org ePrivacy FAQ.)

## Závěr
Web neukládá žádné non-essential cookies ani trackery vyžadující souhlas.
Cookie banner se nezavádí. Re-posoudit při přidání reklamních/3rd-party trackerů.
