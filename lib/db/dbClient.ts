import { Pool, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let poolInstance: Pool | null = null;

/**
 * Returns a singleton connection pool for PostgreSQL.
 */
export function getPool(): Pool {
  if (!poolInstance) {
    let connectionString =
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/brilian_ai';

    // Jika berjalan lokal (di luar docker) dan URL mengarah ke hostname 'postgres', fallback otomatis ke localhost
    if (connectionString.includes('@postgres:') && !process.env.DOCKER_CONTAINER) {
      connectionString = connectionString.replace('@postgres:', '@localhost:');
    }

    poolInstance = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    poolInstance.on('error', (err) => {
      console.error('[DB Pool] Unexpected error on idle PostgreSQL client:', err);
    });
  }

  return poolInstance;
}

/**
 * Helper to execute a query on the pool.
 */
export async function query<R extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<R>> {
  const pool = getPool();
  return pool.query<R>(text, params);
}
