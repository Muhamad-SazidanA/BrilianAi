import { Pool, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let poolInstance: Pool | null = null;

/**
 * Resolves PostgreSQL connection URL, seamlessly handling Docker vs Localhost hostname.
 */
export function getResolvedDatabaseUrl(): string {
  let connectionString =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/brilian_db';

  if (connectionString.includes('@postgres:') && !process.env.DOCKER_CONTAINER) {
    connectionString = connectionString.replace('@postgres:', '@localhost:');
  }
  return connectionString;
}

let migrationTriggered = false;

export function triggerBackgroundMigration(): void {
  if (migrationTriggered) return;
  migrationTriggered = true;
  Promise.resolve().then(async () => {
    try {
      const { ensureCompleteDatabaseSchema } = await import('./autoMigration');
      await ensureCompleteDatabaseSchema();
    } catch (err) {
      console.warn('[DB AutoMigration] Init warning:', err);
    }
  });
}

/**
 * Returns a singleton connection pool for PostgreSQL.
 */
export function getPool(): Pool {
  if (!poolInstance) {
    const connectionString = getResolvedDatabaseUrl();

    poolInstance = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    poolInstance.on('error', (err) => {
      console.error('[DB Pool] Unexpected error on idle PostgreSQL client:', err);
    });

    triggerBackgroundMigration();
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
