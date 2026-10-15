const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
try { require('dotenv').config(); } catch {}
const { getConnectionString } = require('./get-db-url');

async function runMigration() {
  const connectionString = getConnectionString();

  const client = new Client({
    connectionString,
  });

  try {
    console.log('Connecting to PostgreSQL database...');
    await client.connect();
    console.log('Connected successfully.');

    // Check if pgvector extension is available
    let hasPgVector = false;
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
      hasPgVector = true;
      console.log('pgvector extension is installed and active.');
    } catch {
      console.warn('pgvector extension is not available in this PostgreSQL instance. Enabling local compatibility mode...');
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
            CREATE DOMAIN vector AS text;
          END IF;
        END $$;
      `);
    }

    const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      let sql = fs.readFileSync(filePath, 'utf8');

      if (!hasPgVector) {
        // Strip or adapt pgvector-specific syntax for standard PostgreSQL
        sql = sql
          .replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+vector\s*;/gi, '-- skipped pgvector')
          .replace(/VECTOR\s*\(\s*\d+\s*\)/gi, 'vector')
          .replace(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+\w+\s+USING\s+hnsw\s*\([^)]*\)\s*;/gi, '-- skipped hnsw index');
      }

      console.log(`Executing migration: ${file} ...`);
      await client.query(sql);
      console.log(`Migration ${file} executed successfully!`);
    }

    if (hasPgVector) {
      const res = await client.query("SELECT * FROM pg_extension WHERE extname='vector';");
      console.log('Verification: pgvector extension status:', res.rows);
    } else {
      console.log('Verification: Database schema is ready with local vector compatibility mode.');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();

