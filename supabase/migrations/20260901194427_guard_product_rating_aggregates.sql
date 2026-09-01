-- Agregáty hodnocení produktu (`products.review_count`, `products.average_rating`)
-- řídí od stránky recenzí i stránkování, prerender a sitemapu. Neměly ale žádnou
-- serverovou záruku. Tahle migrace ji dodává ze dvou stran.
--
-- ── 1. Souběžné schválení ztrácelo přepočet ─────────────────────────────────
-- T1 schválí recenzi A, T2 souběžně recenzi B téhož produktu. Oba triggery pustí
-- UPDATE nad stejným řádkem `products`; T2 se zablokuje na zámku řádku, a když T1
-- commitne, PostgreSQL v READ COMMITTED přehodnotí jen WHERE — poddotaz nad
-- `reviews` ale dál běží nad PŮVODNÍM snapshotem T2, který schválení A nevidí.
-- Uloží se 11, i když schválených recenzí je 12.
--
-- PostgreSQL 17, „13.2.1 Read Committed": „it is possible for an updating command
-- to see an inconsistent snapshot: it can see the effects of concurrent updating
-- commands on the same rows it is trying to update, but it does not see effects
-- of those commands on other rows in the database." Řádky `reviews` jsou přesně
-- ty „other rows".
--
-- Řešením je zamknout řádek produktu SAMOSTATNÝM příkazem před přepočtem: čekání
-- proběhne v něm, a následující UPDATE je nový příkaz, takže si v READ COMMITTED
-- vezme čerstvý snapshot — už včetně commitnuté recenze konkurenta. Tentýž postup
-- doporučují docs v „Applications and Transaction Isolation" (SELECT FOR UPDATE).
--
-- `for no key update`, ne `for update`: docs, „Row-Level Lock Modes" — slabší
-- výhradní zámek, který „does not block key shares". Právě key-share zamyká vložení
-- řádku s cizím klíčem na produkt, tedy nákup. Silnější `for update` by po dobu
-- schvalování recenze blokoval checkout, a přitom by nepřidal nic: následný UPDATE
-- nemění klíčové sloupce, takže si stejně bere jen `no key update`.
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
    average_rating = COALESCE(
      (SELECT round(avg(r.rating)::numeric, 2)
         FROM public.reviews r
        WHERE r.product_id = target_product_id AND r.status = 'approved'),
      0.00),
    review_count = (SELECT count(*)
                      FROM public.reviews r
                     WHERE r.product_id = target_product_id AND r.status = 'approved')
  WHERE p.id = target_product_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── 2. Přes API se do agregátů dalo zapsat ─────────────────────────────────
-- Baseline dává `GRANT ALL ON TABLE products` rolím `anon` i `authenticated`, takže
-- admin (authenticated + is_admin()) smí PATCHnout produkt i s `review_count`. Kdyby
-- klient někdy poslal celý dřív načtený řádek, přepsal by agregát zastaralou hodnotou:
-- podpočet přes hranici strany schová poslední recenzi z webu úplně, nadpočet naopak
-- shodí produkční build. Dnes to nedělá nikdo — `pg_stat_statements` běží od 19. 4. 2026
-- a ani jeden PostgREST UPDATE nad `products` se těch dvou sloupců nedotkl — ale
-- bránit se tomu má databáze, ne zvyk klienta.
--
-- Proč ne sloupcová práva: `REVOKE UPDATE (review_count) ... ` by byl NO-OP. PostgreSQL 17,
-- REVOKE: „if a role has been granted privileges at the table level, revoking privileges
-- from individual columns will have no effect on their access." Funkční recept vyžaduje
-- odebrat tabulkový UPDATE a znovu udělit 35 z 37 sloupců jmenovitě — a každý budoucí
-- sloupec by pak bez dodatku k migraci tiše ztratil zapisovatelnost. Supabase to sama
-- doporučuje jen výjimečně: „This is an advanced feature. We do not recommend using
-- column-level privileges for most users."
create or replace function "public"."reject_manual_rating_write"()
returns trigger
-- SECURITY INVOKER (výchozí) je tu NOSNÉ, ne opomenutí. Jen tak je `current_user`
-- role, která příkaz opravdu poslala. `refresh_product_rating` je SECURITY DEFINER
-- vlastněná `postgres`, takže její UPDATE sem přijde jako `postgres` a projde;
-- PATCH z API přijde jako `anon`/`authenticated` a narazí. Kdyby někdo „pro
-- konzistenci" doplnil SECURITY DEFINER, stráž by přestala platit — a pgTAP to
-- pozná (test na zamítnutý zápis adminem zčervená).
language plpgsql
set search_path = ''
as $$
DECLARE
  writes_aggregate boolean;
BEGIN
  -- Trigger `refresh_product_rating` (SECURITY DEFINER, vlastník `postgres`),
  -- migrace i edge funkce přes `service_role` sem přijdou pod jinou rolí a projdou.
  -- Omezení platí jen pro to, co chodí z API.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  -- Nuly u INSERTu jsou defaulty obou sloupců. Jsou tu zopakované schválně:
  -- nový produkt nesmí přijít s hodnocením, které pod ním nemá ani jednu recenzi.
  writes_aggregate := CASE
    WHEN TG_OP = 'INSERT'
      THEN NEW.review_count IS DISTINCT FROM 0
        OR NEW.average_rating IS DISTINCT FROM 0.00
    ELSE NEW.review_count IS DISTINCT FROM OLD.review_count
      OR NEW.average_rating IS DISTINCT FROM OLD.average_rating
  END;

  IF writes_aggregate THEN
    RAISE EXCEPTION
      'products.review_count a products.average_rating udržuje trigger refresh_product_rating; přes API je zapisovat nelze'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- `UPDATE OF` znamená, že se stráž vůbec nespustí, dokud klient ty sloupce
-- nezmíní v SET — běžná editace produktu tak nestojí nic navíc. `IS DISTINCT FROM`
-- uvnitř pak pustí i zápis stejné hodnoty: kdyby klient jednou začal vracet celý
-- řádek, nerozbije mu to ukládání, dokud se hodnota opravdu neliší.
--
-- INSERT je ve stráži taky, i když tudy dnes nikdo nechodí (`pg_stat_statements`:
-- dva zaznamenané INSERTy produktu, ani jeden ty sloupce nejmenuje). Zakládaný
-- produkt s vymyšleným počtem recenzí by rozešel stránkování úplně stejně jako
-- přepis, jen by k tomu nepotřeboval ani závod, ani zastaralý formulář.
DROP TRIGGER IF EXISTS "trg_products_reject_manual_rating_write" ON "public"."products";
CREATE TRIGGER "trg_products_reject_manual_rating_write"
BEFORE INSERT OR UPDATE OF "review_count", "average_rating" ON "public"."products"
FOR EACH ROW EXECUTE FUNCTION "public"."reject_manual_rating_write"();

-- Domácí vzor pro trigger funkce (advisor 0028/0029, migrace 20260716181000):
-- přes RPC nesmí být volatelná. Spuštění triggeru EXECUTE volajícího nekontroluje,
-- takže stráž funguje dál i pro `authenticated`.
REVOKE ALL ON FUNCTION "public"."reject_manual_rating_write"() FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON FUNCTION "public"."reject_manual_rating_write"() TO "service_role";
