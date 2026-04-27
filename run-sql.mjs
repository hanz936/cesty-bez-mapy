import pg from 'pg';
const { Client } = pg;

const sql = process.argv[2];
if (!sql) {
  console.error('Usage: PGPASSWORD=xxx node run-sql.mjs "SELECT ..."');
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
  console.error('Error:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
