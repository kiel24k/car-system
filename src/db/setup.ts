/**
 * Usage:
 *   tsx src/db/setup.ts          create database if missing, apply schema, seed
 *   tsx src/db/setup.ts --reset  same, but drop all tables first
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { Client } from 'pg';
import { seed } from './seed';

dotenv.config({ quiet: true });

const DROP_TABLES_SQL = 'DROP TABLE IF EXISTS order_items, orders, cars, users CASCADE';

function databaseUrl(): URL {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set (see .env.example)');
  return new URL(raw);
}

async function ensureDatabase(url: URL): Promise<void> {
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(dbName)) {
    throw new Error(`Refusing to create database with unexpected name "${dbName}"`);
  }

  const maintenanceUrl = new URL(url);
  maintenanceUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: maintenanceUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if ((rowCount ?? 0) === 0) {
      // Identifiers cannot be parameterized; the name is validated above.
      await admin.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Created database ${dbName}`);
    } else {
      console.log(`Database ${dbName} already exists`);
    }
  } finally {
    await admin.end();
  }
}

async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');
  const url = databaseUrl();
  await ensureDatabase(url);

  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const schema = await readFile(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query('BEGIN');
    if (reset) {
      await client.query(DROP_TABLES_SQL);
      console.log('Dropped all tables');
    }
    await client.query(schema);
    console.log('Schema applied');
    await seed(client);
    await client.query('COMMIT');
    console.log(reset ? 'Database reset complete' : 'Database setup complete');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('Database setup failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
