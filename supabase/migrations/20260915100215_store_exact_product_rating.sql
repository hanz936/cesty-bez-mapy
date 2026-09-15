-- Průměrné hodnocení produktu se zaokrouhlovalo DVAKRÁT, a vždy nahoru.
--
-- `refresh_product_rating` ukládal `round(avg, 2)` do `numeric(3,2)` a web (`roundRating`
-- v `src/utils/rating.ts`) pak zaokrouhlil znovu, na jedno desetinné místo. 11 schválených
-- recenzí se součtem 50 má průměr 4,5454…; uložilo se 4.55 a web i JSON-LD pro Google
-- ukázaly 4,6 místo 4,5. Změřeno na skutečné `roundRating` přes všechny součty pro 1–100
-- recenzí: zasaženo 69 počtů recenzí, 820 případů, všechny o desetinu NAHORU. Na
-- PostgreSQL 17.6 reprodukováno přes skutečný trigger (uloženo 4.55, přesně
-- 4.5454545454545455). `/overovani-recenzi` přitom veřejně slibuje průměr „zaokrouhlený
-- na jedno desetinné místo".
--
-- Proč právě nahoru: PostgreSQL 17, `round(numeric, integer)`: „Ties are broken by rounding
-- away from zero." První zaokrouhlení vyrobí z 4,545… přesnou polovinu 4.55 a druhé ji
-- pošle výš — MDN, `Math.round`: „rounded to the next integer in the direction of +∞".
--
-- Oprava: zaokrouhluje se jen jednou, až při zobrazení. Sloupec drží přesný průměr jako
-- `numeric` bez přesnosti; `avg(smallint)` vrací `numeric` (docs, „Aggregate Functions").
-- Frontend se měnit nemusí: PostgREST skládá odpověď JSONem PostgreSQL a ten čísla předává
-- jako JSON čísla — PostgreSQL 17, `to_json`: „For any scalar other than a number, a Boolean,
-- or a null value, the text representation will be used". Ověřeno na skutečné `roundRating`
-- pro všechny součty až do 1 000 recenzí, včetně 3 600 přesných polovin: 0 chyb.
--
-- Migrace je OPAKOVATELNÁ, a to schválně: zda `apply_migration` (Management API) balí SQL
-- do transakce, dokumentace neuvádí, a vlastní BEGIN/COMMIT by případnou vnější transakci
-- ukončil předčasně. Když spadne v půlce, stačí ji pustit znovu. Vyzkoušeno na PG 17.6
-- oběma směry: z napůl provedeného stavu (typ změněn, funkce ne) i z hotového stavu.

-- ── 1. Typ sloupce ─────────────────────────────────────────────────────────
-- Stráž z 20260901194427 je trigger `UPDATE OF … average_rating`, na sloupci tedy závisí,
-- a PostgreSQL 17.6 změnu typu odmítne: „cannot alter type of a column used in a trigger
-- definition" (vyzkoušeno). Proto pryč, změna typu a hned zpátky, beze změny definice —
-- okno bez stráže jsou dva příkazy.
DROP TRIGGER IF EXISTS "trg_products_reject_manual_rating_write" ON "public"."products";

ALTER TABLE "public"."products" ALTER COLUMN "average_rating" TYPE numeric;
ALTER TABLE "public"."products" ALTER COLUMN "average_rating" SET DEFAULT 0;

CREATE TRIGGER "trg_products_reject_manual_rating_write"
BEFORE INSERT OR UPDATE OF "review_count", "average_rating" ON "public"."products"
FOR EACH ROW EXECUTE FUNCTION "public"."reject_manual_rating_write"();

COMMENT ON COLUMN "public"."products"."average_rating" IS 'Exact (unrounded) mean rating of approved reviews, 0 when there are none. Maintained by trigger refresh_product_rating and not writable via the API (trg_products_reject_manual_rating_write). Round only for display, exactly once (src/utils/rating.ts).';

-- ── 2. Trigger přepočtu ────────────────────────────────────────────────────
-- Tělo je shodné s 20260901194427 (včetně samostatného zámku `for no key update` —
-- zdůvodnění tam), jediná změna je průměr bez `round`. `create or replace` zachová
-- vlastníka i odebrané EXECUTE z 20260716181000; pgTAP to hlídá.
create or replace function "public"."refresh_product_rating"()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
DECLARE
  target_product_id uuid;
BEGIN
  target_product_id := COALESCE(NEW.product_id, OLD.product_id);

  -- Musí to být samostatný příkaz. Kdyby se zámek přidal až do UPDATE níž,
  -- nezmění se nic: čekalo by se uvnitř téhož příkazu a poddotaz by pořád
  -- četl ze snapshotu pořízeného před commitem konkurenta.
  PERFORM 1 FROM public.products WHERE id = target_product_id FOR NO KEY UPDATE;

  UPDATE public.products p SET
    -- Bez zaokrouhlení. Zaokrouhluje jen web, jednou (viz hlavička).
    average_rating = COALESCE(
      (SELECT avg(r.rating)
         FROM public.reviews r
        WHERE r.product_id = target_product_id AND r.status = 'approved'),
      0),
    review_count = (SELECT count(*)
                      FROM public.reviews r
                     WHERE r.product_id = target_product_id AND r.status = 'approved')
  WHERE p.id = target_product_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── 3. Už uložené průměry ──────────────────────────────────────────────────
-- Jen řádky, kde se hodnota opravdu mění; přesně vyjádřitelné průměry (4.50, 0) zůstanou
-- netknuté. Změněným se posune `updated_at` (`trg_products_set_updated_at`) — stejně jako
-- při každém schválení recenze; sitemapa ani prerender `products.updated_at` nečtou.
-- Stráž tenhle UPDATE pustí: neběží pod rolí `anon` ani `authenticated`.
UPDATE public.products p
   SET average_rating = COALESCE(
         (SELECT avg(r.rating) FROM public.reviews r
           WHERE r.product_id = p.id AND r.status = 'approved'),
         0)
 WHERE p.average_rating IS DISTINCT FROM COALESCE(
         (SELECT avg(r.rating) FROM public.reviews r
           WHERE r.product_id = p.id AND r.status = 'approved'),
         0);
