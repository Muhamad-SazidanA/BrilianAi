const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();
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

    const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`Executing migration: ${file} ...`);
      await client.query(sql);
      console.log(`Migration ${file} executed successfully!`);
    }

    const res = await client.query("SELECT * FROM pg_extension WHERE extname='vector';");
    console.log('Verification: pgvector extension status:', res.rows);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
