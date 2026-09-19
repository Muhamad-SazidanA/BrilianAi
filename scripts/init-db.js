const { Client } = require('pg');
try { require('dotenv').config(); } catch { }
const { getConnectionString } = require('./get-db-url');

async function init() {
  const connectionString = getConnectionString();

  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to:', connectionString);

  // 1. Check or create vector extension / domain
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('pgvector extension active!');
  } catch {
    console.log('pgvector extension not found in system, creating vector domain fallback...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
          CREATE DOMAIN vector AS text;
        END IF;
      END $$;
    `);
  }

  // 2. upload_batches
  await client.query(`
    CREATE TABLE IF NOT EXISTS upload_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        original_filename TEXT NOT NULL,
        chunk_count INT NOT NULL DEFAULT 0,
        page_count INT NOT NULL,
        is_active_knowledge BOOLEAN DEFAULT true,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  console.log('upload_batches ready');

  // 3. document_chunks
  await client.query(`
    CREATE TABLE IF NOT EXISTS document_chunks (
        id BIGSERIAL PRIMARY KEY,
        upload_batch_id UUID NOT NULL REFERENCES upload_batches(id) ON DELETE CASCADE,
        chunk_index INT NOT NULL,
        content TEXT NOT NULL,
        source_page_start INT NOT NULL,
        source_page_end INT NOT NULL,
        embedding vector NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_chunks_batch ON document_chunks (upload_batch_id);
  `);
  console.log('document_chunks ready');

  // 4. curated_insights
  await client.query(`
    CREATE TABLE IF NOT EXISTS curated_insights (
        id BIGSERIAL PRIMARY KEY,
        upload_batch_id UUID NOT NULL REFERENCES upload_batches(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        importance TEXT NOT NULL DEFAULT 'medium',
        category TEXT DEFAULT 'track1_financial',
        tags TEXT[] DEFAULT '{}',
        source_pages TEXT DEFAULT '',
        source_chunk_id BIGINT REFERENCES document_chunks(id) ON DELETE SET NULL,
        embedding vector,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_curated_batch ON curated_insights (upload_batch_id);
  `);
  console.log('curated_insights ready');

  // 5. chat_response_cache
  await client.query(`
    CREATE TABLE IF NOT EXISTS chat_response_cache (
        cache_key TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        answer TEXT NOT NULL,
        sources JSONB NOT NULL DEFAULT '[]',
        allow_public_knowledge BOOLEAN NOT NULL DEFAULT false,
        retrieved_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_chat_cache_key ON chat_response_cache (cache_key);
  `);
  console.log('chat_response_cache ready');

  // 6. roles, users, chat_audit_logs
  const { ensureUsersAndRolesTables } = require('../lib/db/userStore');
  await ensureUsersAndRolesTables();
  console.log('users, roles, and chat_audit_logs ready');

  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
  console.log('All tables in brilian_db:', res.rows.map(r => r.table_name));
  await client.end();
}

init().catch(console.error);
