# scripts/

Ad-hoc skripty co se nespouštějí z `package.json`, ale jsou užitečné při údržbě.

## run-sql.mjs

Přímý Postgres dotaz proti produkční Supabase DB (přes connection pooler). Pouze pro lokální debugging / data inspection. Vyžaduje `PGPASSWORD` v env.

```bash
PGPASSWORD=xxx node scripts/run-sql.mjs "SELECT COUNT(*) FROM products;"
```

Volitelné env: `PGHOST`, `PGPORT`, `PGUSER` (defaulty viz zdrojový kód).
