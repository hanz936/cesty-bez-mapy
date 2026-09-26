-- Průměrné hodnocení produktu se zaokrouhlovalo DVAKRÁT, a vždy nahoru.
--
-- `refresh_product_rating` ukládal `round(avg, 2)` do `numeric(3,2)` a web (`roundRating`
-- v `src/utils/rating.ts`) pak zaokrouhlil znovu, na jedno desetinné místo. 11 schválených
-- recenzí se součtem 50 má průměr 4,5454…; uložilo se 4.55 a web i JSON-LD pro Google
-- ukázaly 4,6 místo 4,5. Změřeno na skutečné `roundRating` přes všechny součty pro 1–100
-- recenzí: zasaženo 69 počtů recenzí, 820 případů, všechny o desetinu NAHORU. Na
-- PostgreSQL 17.6 reprodukováno přes skutečný trigger (uloženo 4.55, `avg` dává
-- 4.5454545454545455). `/overovani-recenzi` přitom veřejně slibuje průměr „zaokrouhlený
-- na jedno desetinné místo".
--
-- Proč právě nahoru: PostgreSQL 17, `round(numeric, integer)`: „Ties are broken by rounding
-- away from zero." První zaokrouhlení vyrobí z 4,545… přesnou polovinu 4.55 a druhé ji
-- pošle výš — MDN, `Math.round`: „rounded to the next integer in the direction of +∞".
--
-- Oprava: na jedno desetinné místo se zaokrouhluje jen jednou, až při zobrazení. Sloupec
-- drží průměr zaokrouhlený na 12 desetinných míst jako `numeric` bez přesnosti; `avg(smallint)`
-- vrací `numeric` (docs, „Aggregate Functions"). „Exact" v názvu souboru znamená právě tohle:
-- v DB už žádné zaokrouhlení, které by na webu šlo poznat — ne neomezený počet číslic.
--
-- Proč 12 míst: PostgREST skládá odpověď JSONem PostgreSQL a ten čísla předává jako JSON
-- čísla — PostgreSQL 17, `to_json`: „For any scalar other than a number, a Boolean, or a null
-- value, the text representation will be used". JavaScriptový klient je čte do IEEE 754
-- double. Samotné `avg` má aspoň 16 platných číslic (55/12 → 4.5833333333333333), double
-- z toho udělá 4.583333333333333, tedy jiný `numeric`, a klient, který by neměněný řádek
-- poslal zpátky, by narazil na stráž z 20260901194427 (`IS DISTINCT FROM` → 42501). Průměr
-- má před desetinnou čárkou jedinou číslici, takže 12 míst je nejvýš 13 platných číslic
-- a ty double přenese beze změny. Frontend se měnit nemusí.
--
-- Zobrazení to nepokazí: zaokrouhlení na 12 míst může změnit výsledek na jedno desetinné
-- místo, jen když průměr s/n leží blíž než 5·10⁻¹³ k polovině (x,x5). Pokud to přímo polovina
-- není, je od ní aspoň 1/(20n) daleko (a přesná polovina projde `round(…, 12)` beze změny),
-- takže by to chtělo aspoň 10¹¹ recenzí. Ověřeno vzorcem `roundRating` (`Math.round(x * 10)`)
-- nad hodnotou z `JSON.parse` pro všechny součty do 1 000 recenzí (2 003 000 případů, z toho 3 600
-- přesných polovin): 0 chyb v zobrazení a 0 hodnot, které by cesta přes double změnila.
--
-- ── Nasazení ───────────────────────────────────────────────────────────────
-- Migrace je OPAKOVATELNÁ, a to schválně: zda `apply_migration` (Management API) balí SQL
-- do transakce, dokumentace neuvádí, a vlastní BEGIN/COMMIT by případnou vnější transakci
-- ukončil předčasně. Když spadne v půlce, stačí ji pustit znovu. Vyzkoušeno na PG 17.6
-- z každého mezistavu (po bloku DO, po krocích 1, 2 a 3 oddílu 1, po výměně funkce)
-- i z hotového stavu.
-- Znovu pouštět jen tenhle soubor, a jen dokud je nejnovější nasazenou migrací;
-- 20260901194427 po něm nikdy — tiše by vrátil `round(…, 2)` do `refresh_product_rating`.
--
-- `lock_timeout` 5 s (první a poslední příkaz souboru): kdyby migrace musela na zámek
-- `products` čekat za dlouhou transakcí, má rychle spadnout, a ne za sebou řadit čtení
-- i zápisy katalogu (blok DO i změna typu chtějí na `products` výhradní zámek). Produkce má
-- `lock_timeout = 0`, tedy čekání bez konce. S DROP TRIGGER by za ní čekala i přihlášení,
-- proto tu žádný není (viz oddíl 1). Díky opakovatelnosti znamená timeout jen pustit
-- migraci znovu. Obyčejné `SET` a na konci `RESET`, ne `SET LOCAL`: to mimo transakční
-- blok podle docs (SET) „emits a warning and otherwise has no effect". Když soubor běží
-- v transakci a ta spadne, zmizí `SET` s ní; bez transakce zůstane po pádu jen v tomhle
-- spojení.
--
-- Hned potom nejsilnější zámek, jaký migrace na `products` potřebuje (AccessExclusive).
-- Kdyby `apply_migration` pustil soubor v jedné transakci, první zámek na `products` by byl
-- ShareRowExclusive z kroku 1 a změna typu v kroku 2 by ho povyšovala. Souběžné schválení
-- recenze nebo nákup, který mezitím zamkl řádek produktu a pak ho UPDATEuje, by s migrací
-- čekal navzájem → `deadlock detected`; v kontejneru to odnesla souběžná transakce, tedy
-- schválení nebo nákup, ne migrace. Docs, „13.3.4 Deadlocks": „One should also ensure that
-- the first lock acquired on an object in a transaction is the most restrictive mode that
-- will be needed for that object." Blok DO proto, že samotné LOCK mimo transakci skončí
-- chybou („PostgreSQL reports an error if LOCK is used outside a transaction block.").
-- DO běží v transakci svého příkazu: bez vnější transakce zámek hned pustí a nic nezmění,
-- ve vnější ho drží až do COMMIT. `lock_timeout` platí i pro něj.
set lock_timeout = '5s';
do $$ begin lock table "public"."products" in access exclusive mode; end $$;

-- ── 1. Typ sloupce ─────────────────────────────────────────────────────────
-- Stráž z 20260901194427 je trigger `UPDATE OF "review_count", "average_rating"`. Závislost
-- triggeru na sloupci vzniká právě z toho seznamu a PostgreSQL 17.6 změnu typu takového
-- sloupce odmítne: „cannot alter type of a column used in a trigger definition" (vyzkoušeno).
-- Proto se seznam nejdřív zúží na `review_count` (krok 1), typ a default se změní (kroky 2
-- a 3) a stráž se vrátí v původní podobě (krok 4).
--
-- Ne DROP TRIGGER: pod rolí `postgres` si na Supabase (`supautils.drop_trigger_grants`)
-- bere AccessExclusiveLock i na tabulky `auth`, `storage` a `realtime`, takže zablokovaný
-- DROP by za sebou zdržel přihlašování i Storage. `create or replace trigger` tyhle zámky
-- nebere.
--
-- Stráž nad `review_count` běží celou dobu; nehlídaný je jen `average_rating`, a to jen
-- mezi kroky 1 a 4. Backfill (oddíl 3) musí přijít až po kroku 4: docs, CREATE TRIGGER,
-- nedoporučují nahrazovat trigger v transakci, která už nad jeho tabulkou měnila data,
-- protože už padlá rozhodnutí o spuštění triggerů se znovu neposuzují. Před krokem 4 tu
-- žádný UPDATE `products` není.
create or replace trigger "trg_products_reject_manual_rating_write"
before insert or update of "review_count" on "public"."products"
for each row execute function "public"."reject_manual_rating_write"();

ALTER TABLE "public"."products" ALTER COLUMN "average_rating" TYPE numeric;
ALTER TABLE "public"."products" ALTER COLUMN "average_rating" SET DEFAULT 0;

create or replace trigger "trg_products_reject_manual_rating_write"
before insert or update of "review_count", "average_rating" on "public"."products"
for each row execute function "public"."reject_manual_rating_write"();

COMMENT ON COLUMN "public"."products"."average_rating" IS 'Mean rating of approved reviews rounded to 12 decimal places, 0 when there are none. 12 places keep the value unchanged through a JSON round trip via an IEEE 754 double (JavaScript clients). Maintained by trigger refresh_product_rating and not writable via the API (trg_products_reject_manual_rating_write). Round for display only once (src/utils/rating.ts).';

-- ── 2. Trigger přepočtu ────────────────────────────────────────────────────
-- Tělo je shodné s 20260901194427 (včetně samostatného zámku `for no key update` —
-- zdůvodnění tam), jediná změna je průměr: `round(…, 12)` místo `round(…, 2)`.
-- `create or replace` zachová vlastníka i odebrané EXECUTE z 20260716181000; pgTAP to hlídá.
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
    -- 12 desetinných míst, aby hodnota přežila JSON a JavaScript beze změny; na jedno
    -- desetinné místo zaokrouhluje jen web, jednou (viz hlavička).
    average_rating = COALESCE(
      (SELECT round(avg(r.rating), 12)
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
-- Jen řádky, kde se hodnota opravdu mění; průměry, které se celé vejdou do dvou desetinných
-- míst (4.50, 0), zůstanou netknuté. Změněným se posune `updated_at`
-- (`trg_products_set_updated_at`) — stejně jako při každém schválení recenze; sitemapa ani
-- prerender `products.updated_at` nečtou.
-- Stráž tenhle UPDATE pustí: neběží pod rolí `anon` ani `authenticated`.
UPDATE public.products p
   SET average_rating = COALESCE(
         (SELECT round(avg(r.rating), 12) FROM public.reviews r
           WHERE r.product_id = p.id AND r.status = 'approved'),
         0)
 WHERE p.average_rating IS DISTINCT FROM COALESCE(
         (SELECT round(avg(r.rating), 12) FROM public.reviews r
           WHERE r.product_id = p.id AND r.status = 'approved'),
         0);

reset lock_timeout;
