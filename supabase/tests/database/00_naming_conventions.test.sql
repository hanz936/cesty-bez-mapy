begin;
select plan(8);

-- 1) Žádný identifikátor ANI tělo funkce v public neobsahuje "facturoid"
select ok(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname ~* 'facturoid') = 0
  and (select count(*) from information_schema.columns
         where table_schema = 'public' and column_name ~* 'facturoid') = 0
  and (select count(*) from pg_policies
         where schemaname = 'public' and policyname ~* 'facturoid') = 0
  and (select count(*) from pg_constraint con join pg_namespace n on n.oid = con.connamespace
         where n.nspname = 'public' and con.conname ~* 'facturoid') = 0
  and (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and not t.tgisinternal and t.tgname ~* 'facturoid') = 0
  and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and (p.proname ~* 'facturoid' or p.prosrc ~* 'facturoid')) = 0,
  'no identifier or function body in public schema contains "facturoid"'
);

-- 2) Indexy idx_* používají plný název tabulky jako prefix
--    (literal-prefix porovnání — bez interpolace tablename do regexu)
select ok(
  (select count(*) from pg_indexes
     where schemaname = 'public'
       and indexname ~ '^idx_'
       and left(indexname, length('idx_' || tablename || '_'))
           is distinct from ('idx_' || tablename || '_')) = 0,
  'all idx_* indexes use full table-name prefix'
);

-- 3) RLS policy dodržují <table>_<audience>_<action> (vč. schématu storage)
select ok(
  (select count(*) from pg_policies
     where schemaname in ('public', 'storage')
       and policyname !~ '^[a-z0-9_]+_(public|authenticated|owner|admin|auth_admin)_(select|insert|update|delete)$') = 0,
  'all RLS policies (public + storage) follow <table>_<audience>_<action> grammar'
);

-- 4) FK/UNIQUE/CHECK suffixy
select ok(
  (select count(*) from pg_constraint con join pg_namespace n on n.oid = con.connamespace
     where n.nspname = 'public'
       and ( (con.contype = 'f' and con.conname !~ '_fkey$')
          or (con.contype = 'u' and con.conname !~ '_key$')
          or (con.contype = 'c' and con.conname !~ '_check$') )) = 0,
  'FK/UNIQUE/CHECK use _fkey/_key/_check suffixes'
);

-- 5) VŠECHNY funkce v public mají search_path nastaven na PRÁZDNÝ řetězec
--    (povinné u SECURITY DEFINER; projektový standard i pro SECURITY INVOKER).
--    Regex přijímá jen prázdnou hodnotu: "search_path=" nebo "search_path=\"\"".
select ok(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and not exists (
         select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
          where cfg ~ '^search_path=("")?$')) = 0,
  'all functions in public set search_path to the empty string'
);

-- 6) User triggery mají prefix trg_
select ok(
  (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not t.tgisinternal and t.tgname !~ '^trg_') = 0,
  'all user triggers use trg_ prefix'
);

-- 7) Type-preference: žádné varchar/char/json/timestamp-bez-tz v public
--    (preferuj text / jsonb / timestamptz)
select ok(
  (select count(*) from information_schema.columns
     where table_schema = 'public'
       and (udt_name in ('varchar', 'bpchar', 'json')
            or data_type = 'timestamp without time zone')) = 0,
  'no varchar/char/json/timestamp(without tz) columns in public (prefer text/jsonb/timestamptz)'
);

-- 8) Každá public tabulka má COMMENT
select ok(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and obj_description(c.oid, 'pg_class') is null) = 0,
  'every public table has a COMMENT'
);

select * from finish();
rollback;
