const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/brilian_ai',
  });

  try {
    console.log('Connecting to PostgreSQL database...');
    await client.connect();
    console.log('Connected successfully.');

    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '001_create_ingestion_tables.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration: 001_create_ingestion_tables.sql ...');
    await client.query(sql);
    console.log('Migration executed successfully!');

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
