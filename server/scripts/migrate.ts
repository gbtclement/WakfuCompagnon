import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from '../src/db';

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
    if (rows.length > 0) continue;

    const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
    console.log(`Applying ${file}...`);
    await pool.query(sql);
    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
  }

  console.log('Migrations complete.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
