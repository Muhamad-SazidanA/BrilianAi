import { Pool } from 'pg';
import { getPool } from './dbClient';

let isMigrationRunning = false;
let isMigrationDone = false;

/**
 * Memastikan skema database PostgreSQL 100% kompatibel dan tersinkronisasi,
 * baik menggunakan database baru maupun database lama dari migrasi sebelumnya.
 *
 * Menambahkan semua kolom, tabel, dan indeks yang hilang secara idempoten dan aman.
 */
export async function ensureCompleteDatabaseSchema(): Promise<void> {
  if (isMigrationDone || isMigrationRunning) return;
  isMigrationRunning = true;

  try {
    const pool = getPool();

    // 1. Ekstensi pgcrypto untuk gen_random_uuid()
    await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";').catch(() => {});

    // 2. Ekstensi pgvector (jika tersedia)
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector;').catch(() => {});

    // 3. Tabel upload_batches & seluruh kolom ABAC / Lifecycle
    await pool.query(`
      CREATE TABLE IF NOT EXISTS upload_batches (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          original_filename TEXT NOT NULL,
          chunk_count INT NOT NULL DEFAULT 0,
          page_count INT NOT NULL,
          is_active_knowledge BOOLEAN DEFAULT false,
          uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS is_active_knowledge BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE upload_batches ALTER COLUMN is_active_knowledge SET DEFAULT false;
      ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS owner_id UUID;
      ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS division_id VARCHAR(100) NOT NULL DEFAULT 'General';
      ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS classification VARCHAR(50) NOT NULL DEFAULT 'Internal';
      ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'Menunggu Kurasi';
      ALTER TABLE upload_batches ALTER COLUMN status SET DEFAULT 'Menunggu Kurasi';
      ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS version VARCHAR(20) NOT NULL DEFAULT '1.0';
      ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS supersedes_id UUID;
      ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS effective_date TIMESTAMPTZ NOT NULL DEFAULT now();
      ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS review_due_date TIMESTAMPTZ;
      CREATE INDEX IF NOT EXISTS idx_batches_status ON upload_batches (status);
      CREATE INDEX IF NOT EXISTS idx_batches_division ON upload_batches (division_id);
      CREATE INDEX IF NOT EXISTS idx_batches_classification ON upload_batches (classification);

      -- Sinkronisasi Ketat: Dokumen yang belum memiliki insight terkurasi TIDAK BOLEH aktif untuk AI
      UPDATE upload_batches
      SET is_active_knowledge = false, status = 'Menunggu Kurasi'
      WHERE is_active_knowledge = true
        AND NOT EXISTS (
          SELECT 1 FROM curated_insights ci WHERE ci.upload_batch_id = upload_batches.id
        );
    `).catch((e) => console.warn('[AutoMigration] upload_batches warn:', e?.message));

    // 4. Tabel document_chunks
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
          id BIGSERIAL PRIMARY KEY,
          upload_batch_id UUID NOT NULL REFERENCES upload_batches(id) ON DELETE CASCADE,
          chunk_index INT NOT NULL,
          content TEXT NOT NULL,
          source_page_start INT NOT NULL,
          source_page_end INT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_chunks_batch ON document_chunks (upload_batch_id);
    `).catch((e) => console.warn('[AutoMigration] document_chunks warn:', e?.message));

    // 5. Tabel roles & users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          is_system BOOLEAN NOT NULL DEFAULT false,
          permissions JSONB NOT NULL DEFAULT '[]',
          allowed_classifications JSONB NOT NULL DEFAULT '["Publik", "Internal"]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      ALTER TABLE roles ADD COLUMN IF NOT EXISTS allowed_classifications JSONB NOT NULL DEFAULT '["Publik", "Internal"]'::jsonb;

      CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(120) NOT NULL,
          email VARCHAR(150) NOT NULL UNIQUE,
          role_id VARCHAR(50) NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT DEFAULT 'member',
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          department VARCHAR(100),
          avatar_color VARCHAR(20) DEFAULT '#2563EB',
          last_login_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color VARCHAR(20) DEFAULT '#2563EB';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
      CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
    `).catch((e) => console.warn('[AutoMigration] roles & users warn:', e?.message));

    // Seed default roles if empty or update classifications
    await pool.query(`
      INSERT INTO roles (id, name, description, is_system, permissions, allowed_classifications)
      VALUES
          ('admin', 'Super Administrator', 'Akses penuh ke seluruh modul sistem, dokumen, kurasi AI, manajemen pengguna, dan audit log.', true, '["dashboard:admin", "dashboard:documents", "dashboard:personal", "documents:read", "documents:upload", "documents:toggle_active", "documents:delete", "curation:trigger", "curation:edit", "curation:delete", "chat:query", "chat:export", "users:manage", "roles:manage", "audit:read"]'::jsonb, '["Publik", "Internal", "Rahasia", "Sangat Rahasia"]'::jsonb),
          ('editor', 'Knowledge Manager & Editor', 'Dapat mengunggah dokumen PDF, mengelola basis pengetahuan, menjalankan dan menyunting kurasi AI, serta bertanya ke Chatbot.', true, '["dashboard:documents", "dashboard:personal", "documents:read", "documents:upload", "documents:toggle_active", "curation:trigger", "curation:edit", "curation:delete", "chat:query", "chat:export"]'::jsonb, '["Publik", "Internal", "Rahasia"]'::jsonb),
          ('member', 'Member / Viewer', 'Hak akses standar untuk membaca dokumen aktif dan bertanya pada AI Chatbot RAG.', true, '["dashboard:personal", "documents:read", "chat:query", "chat:export"]'::jsonb, '["Publik", "Internal"]'::jsonb),
          ('chat_only', 'Chatbot Specialist', 'Hak akses khusus percakapan: hanya dapat bertanya dan berdiskusi dengan AI Chatbot RAG.', false, '["chat:query", "chat:export"]'::jsonb, '["Publik", "Internal"]'::jsonb),
          ('knowledge_only', 'Knowledge Viewer', 'Hak akses khusus pembaca: hanya dapat membuka dan mempelajari repositori dokumen pengetahuan.', false, '["documents:read"]'::jsonb, '["Publik", "Internal"]'::jsonb)
      ON CONFLICT (id) DO UPDATE SET 
        allowed_classifications = CASE 
          WHEN roles.id = 'admin' THEN '["Publik", "Internal", "Rahasia", "Sangat Rahasia"]'::jsonb
          WHEN roles.id = 'editor' THEN '["Publik", "Internal", "Rahasia"]'::jsonb
          ELSE COALESCE(roles.allowed_classifications, '["Publik", "Internal"]'::jsonb)
        END;
    `).catch(() => {});

    // Seed default Super Admin
    const superadminEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@brilian.ai').trim().toLowerCase();
    await pool.query(`
      INSERT INTO users (id, name, email, role_id, status, department, avatar_color, last_login_at)
      VALUES ('a0000000-0000-0000-0000-000000000001', 'Super Admin', $1, 'admin', 'active', 'System Administration', '#2563EB', now())
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, role_id = EXCLUDED.role_id, status = 'active';
    `, [superadminEmail]).catch(() => {});

    // 6. Tabel curated_insights
    await pool.query(`
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
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      ALTER TABLE curated_insights ADD COLUMN IF NOT EXISTS source_chunk_id BIGINT REFERENCES document_chunks(id) ON DELETE SET NULL;
      ALTER TABLE curated_insights ADD COLUMN IF NOT EXISTS source_pages TEXT DEFAULT '';
      ALTER TABLE curated_insights ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'track1_financial';
      ALTER TABLE curated_insights ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
      ALTER TABLE curated_insights ADD COLUMN IF NOT EXISTS importance TEXT NOT NULL DEFAULT 'medium';
      CREATE INDEX IF NOT EXISTS idx_curated_batch ON curated_insights (upload_batch_id);
    `).catch((e) => console.warn('[AutoMigration] curated_insights warn:', e?.message));

    // 7. Tabel chat_sessions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(200) NOT NULL DEFAULT 'Chat Baru',
          is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
          messages JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS last_shared_message_id VARCHAR(64);
      ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS title VARCHAR(200) NOT NULL DEFAULT 'Chat Baru';
      ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS messages JSONB NOT NULL DEFAULT '[]'::jsonb;
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated ON chat_sessions (user_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_pinned ON chat_sessions (user_id, is_pinned DESC, updated_at DESC);
    `).catch((e) => console.warn('[AutoMigration] chat_sessions warn:', e?.message));

    // 8. Tabel chat_response_cache
    await pool.query(`
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
      ALTER TABLE chat_response_cache ADD COLUMN IF NOT EXISTS access_group_id VARCHAR(100) NOT NULL DEFAULT 'all';
      ALTER TABLE chat_response_cache ADD COLUMN IF NOT EXISTS corpus_version VARCHAR(50) NOT NULL DEFAULT 'v1';
      CREATE INDEX IF NOT EXISTS idx_chat_cache_key ON chat_response_cache (cache_key);
    `).catch((e) => console.warn('[AutoMigration] chat_response_cache warn:', e?.message));

    // 9. Tabel document_access_grants
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_access_grants (
          id BIGSERIAL PRIMARY KEY,
          upload_batch_id UUID NOT NULL REFERENCES upload_batches(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          access_level VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (access_level IN ('viewer', 'editor')),
          granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT uq_doc_user_grant UNIQUE (upload_batch_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_doc_grants_batch ON document_access_grants (upload_batch_id);
      CREATE INDEX IF NOT EXISTS idx_doc_grants_user ON document_access_grants (user_id);
    `).catch((e) => console.warn('[AutoMigration] document_access_grants warn:', e?.message));

    // 10. Tabel user_sessions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_token VARCHAR(255) UNIQUE NOT NULL,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          user_agent TEXT,
          ip_address VARCHAR(45),
          expires_at TIMESTAMPTZ NOT NULL,
          revoked_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions (session_token);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);
    `).catch((e) => console.warn('[AutoMigration] user_sessions warn:', e?.message));

    // 11. Tabel shared_chats
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shared_chats (
          share_id VARCHAR(64) PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
          title VARCHAR(200) NOT NULL DEFAULT 'Percakapan AI',
          messages JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          expires_at TIMESTAMPTZ,
          revoked_at TIMESTAMPTZ,
          requires_approval BOOLEAN NOT NULL DEFAULT false
      );
      ALTER TABLE shared_chats ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
      ALTER TABLE shared_chats ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
      ALTER TABLE shared_chats ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT false;
    `).catch((e) => console.warn('[AutoMigration] shared_chats warn:', e?.message));

    // 12. Tabel knowledge_gaps, answer_feedback, chat_audit_logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS knowledge_gaps (
          id BIGSERIAL PRIMARY KEY,
          query_text TEXT NOT NULL,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          division_id VARCHAR(100) DEFAULT 'General',
          frequency INT NOT NULL DEFAULT 1,
          status VARCHAR(50) NOT NULL DEFAULT 'open',
          resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
          resolution_note TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS answer_feedback (
          id BIGSERIAL PRIMARY KEY,
          session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          query_text TEXT NOT NULL,
          answer_text TEXT NOT NULL,
          rating VARCHAR(20) NOT NULL CHECK (rating IN ('helpful', 'incorrect', 'outdated')),
          feedback_text TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS chat_audit_logs (
          id BIGSERIAL PRIMARY KEY,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          user_name VARCHAR(120),
          user_email VARCHAR(150),
          user_role VARCHAR(50),
          query TEXT NOT NULL,
          answer TEXT,
          sources_count INT DEFAULT 0,
          latency_ms INT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `).catch((e) => console.warn('[AutoMigration] audit & feedback tables warn:', e?.message));

    // 13. Auto-Purge Cache: Bersihkan jawaban gagal/tidak ditemukan dari chat_response_cache
    await pool.query(`
      DELETE FROM chat_response_cache
      WHERE answer ILIKE '%tidak ditemukan%'
         OR answer ILIKE '%tidak terdapat di dalam dokumen%'
         OR answer ILIKE '%tidak memuat informasi%'
         OR answer ILIKE '%gagal memproses%'
         OR answer ILIKE '%internal server error%'
         OR (sources::text = '[]' AND allow_public_knowledge = false);
    `).catch((e) => console.warn('[AutoMigration] purge cache warn:', e?.message));

    isMigrationDone = true;
  } catch (err: any) {
    console.warn('[AutoMigration] ensureCompleteDatabaseSchema warning:', err?.message || err);
  } finally {
    isMigrationRunning = false;
  }
}
