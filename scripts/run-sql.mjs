// `pg` (devDependency, ad-hoc ops skript) nemá k ESM vstupu deklarace a `@types/pg`
// v projektu nedržíme — kvůli jednomu ručně spouštěnému skriptu by to byla další
// závislost navíc. `@ts-expect-error` je zároveň pojistka: až typy přibudou, TypeScript
// tenhle řádek ohlásí jako zbytečný.
// @ts-expect-error - modul 'pg' nemá typové deklarace
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const { Client } = pg;

const sql = process.argv[2];
if (!sql) {
  console.error('Usage: PGPASSWORD=xxx node scripts/run-sql.mjs "SELECT ..."');
  process.exit(1);
}

const host = process.env.PGHOST || 'aws-1-eu-central-1.pooler.supabase.com';
const port = parseInt(process.env.PGPORT || '6543');
const user = process.env.PGUSER || 'postgres.dkblgznhnixubyoghrqe';

/**
 * Kořenový certifikát Supabase. Pooler NEMÁ certifikát od veřejné autority —
 * změřeno 1. 9. 2026: `*.pooler.supabase.com` ← `Supabase Intermediate 2021 CA`
 * ← `Supabase Root 2021 CA`, což je self-signed kořen mimo systémové úložiště.
 * Samotné `rejectUnauthorized: true` by tedy spojení neotevřelo vůbec
 * (`SELF_SIGNED_CERT_IN_CHAIN`); ověřovat jde jen proti tomuhle souboru.
 *
 * Certifikát je veřejný (Supabase ho nabízí ke stažení v Database Settings),
 * takže v repu není žádné tajemství. Platí do 26. 4. 2031,
 * SHA-256 80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA.
 * `PGSSLROOTCERT` ho přebije, až ho Supabase vymění.
 */
const caPath = process.env.PGSSLROOTCERT || fileURLToPath(new URL('./prod-ca-2021.crt', import.meta.url));

/**
 * Lokální stack (`supabase start`) jede bez TLS, takže by na něm ověřování
 * certifikátu spadlo. Všude jinde se ověřuje, a to plně: `pg` posílá
 * `servername`, když host není holá IP, takže kromě podpisu sedí i jméno —
 * dohromady je to `sslmode=verify-full`, které Supabase doporučuje.
 *
 * Žádná úniková proměnná typu `PGSSL_INSECURE` tu schválně není. Skript posílá
 * heslo k produkční databázi a libovolné SQL; vypínač ověřování by se dřív nebo
 * později použil „jen na chvíli" a MITM na nedůvěryhodné síti by dostal obojí.
 */
const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';

console.error(`Connecting to ${host}:${port} as ${user}...`);
const client = new Client({
  host,
  port,
  database: 'postgres',
  user,
  password: process.env.PGPASSWORD,
  ssl: isLocal ? false : { ca: readFileSync(caPath), rejectUnauthorized: true },
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
