begin;
select plan(6);

-- 1) Žádný identifikátor v public neobsahuje "facturoid"
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
         where n.nspname = 'public' and p.proname ~* 'facturoid') = 0,
  'no identifier in public schema contains "facturoid"'
);

-- 2) Indexy idx_* používají plný název tabulky jako prefix
select ok(
  (select count(*) from pg_indexes
     where schemaname = 'public'
       and indexname ~ '^idx_'
       and indexname !~ ('^idx_' || tablename || '_')) = 0,
  'all idx_* indexes use full table-name prefix'
);

-- 3) RLS policy dodržují <table>_<audience>_<action>
select ok(
  (select count(*) from pg_policies
     where schemaname = 'public'
       and policyname !~ '^[a-z_]+_(public|authenticated|owner|admin|auth_admin)_(select|insert|update|delete)$') = 0,
  'all RLS policies follow <table>_<audience>_<action> grammar'
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

-- 5) SECURITY DEFINER funkce mají explicitní search_path
select ok(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and not exists (
         select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
          where cfg like 'search_path=%')) = 0,
  'all SECURITY DEFINER functions set explicit search_path'
);

-- 6) User triggery mají prefix trg_
select ok(
  (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not t.tgisinternal and t.tgname !~ '^trg_') = 0,
  'all user triggers use trg_ prefix'
);

select * from finish();
rollback;
