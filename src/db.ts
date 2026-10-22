import pg from 'pg';
import { config } from './config';

const NUMERIC_OID = 1700;
const INT8_OID = 20;

// Return NUMERIC and BIGINT (e.g. COUNT(*)) as JS numbers instead of strings.
pg.types.setTypeParser(NUMERIC_OID, (value) => parseFloat(value));
pg.types.setTypeParser(INT8_OID, (value) => parseInt(value, 10));

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

// Without a listener, an idle client losing its connection would crash the process.
// The pool already discards the broken client and opens a new one on the next query.
pool.on('error', (err) => console.error('Idle PostgreSQL client error:', err.message));

export type Queryable = Pick<pg.PoolClient, 'query'>;

/** Runs `fn` inside a transaction, committing on success and rolling back on error. */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
