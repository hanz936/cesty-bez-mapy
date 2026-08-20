// `pg` (devDependency, ad-hoc ops skript) nemá k ESM vstupu deklarace a `@types/pg`
// v projektu nedržíme — kvůli jednomu ručně spouštěnému skriptu by to byla další
// závislost navíc. `@ts-expect-error` je zároveň pojistka: až typy přibudou, TypeScript
// tenhle řádek ohlásí jako zbytečný.
// @ts-expect-error - modul 'pg' nemá typové deklarace
import pg from 'pg';
const { Client } = pg;

const sql = process.argv[2];
if (!sql) {
  console.error('Usage: PGPASSWORD=xxx node scripts/run-sql.mjs "SELECT ..."');
  process.exit(1);
}

const host = process.env.PGHOST || 'aws-1-eu-central-1.pooler.supabase.com';
const port = parseInt(process.env.PGPORT || '6543');
const user = process.env.PGUSER || 'postgres.dkblgznhnixubyoghrqe';
console.error(`Connecting to ${host}:${port} as ${user}...`);
const client = new Client({
  host,
  port,
  database: 'postgres',
  user,
  password: process.env.PGPASSWORD,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  const result = await client.query(sql);
  if (result.rows.length > 0) {
    console.log(JSON.stringify(result.rows, null, 2));
  } else {
    console.log('(no rows)');
  }
} catch (err) {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await client.end();
}
