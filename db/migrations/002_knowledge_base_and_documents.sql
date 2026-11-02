-- ========================================================================
-- Migration 002: Knowledge Base, Vector Embeddings, Documents & Curation
-- ========================================================================

-- 1. Pastikan ekstensi pgvector aktif
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabel: upload_batches (Basis Pengetahuan & Dokumen Enterprise)
CREATE TABLE IF NOT EXISTS upload_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_filename TEXT NOT NULL,
    chunk_count INT NOT NULL DEFAULT 0,
    page_count INT NOT NULL,
    is_active_knowledge BOOLEAN NOT NULL DEFAULT false,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    division_id VARCHAR(100) NOT NULL DEFAULT 'General',
    classification VARCHAR(50) NOT NULL DEFAULT 'Internal',
    status VARCHAR(50) NOT NULL DEFAULT 'Menunggu Kurasi',
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    supersedes_id UUID REFERENCES upload_batches(id) ON DELETE SET NULL,
    effective_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    review_due_date TIMESTAMPTZ,
    suggested_questions TEXT[] DEFAULT '{}',
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batches_status ON upload_batches (status);
CREATE INDEX IF NOT EXISTS idx_batches_division ON upload_batches (division_id);
CREATE INDEX IF NOT EXISTS idx_batches_classification ON upload_batches (classification);
CREATE INDEX IF NOT EXISTS idx_batches_active_knowledge ON upload_batches (is_active_knowledge);
CREATE INDEX IF NOT EXISTS idx_batches_owner_id ON upload_batches (owner_id);
CREATE INDEX IF NOT EXISTS idx_batches_uploaded_at ON upload_batches (uploaded_at DESC);

-- 3. Tabel: document_chunks (Potongan Teks & Vektor Semantik 1024 Dimensi)
CREATE TABLE IF NOT EXISTS document_chunks (
    id BIGSERIAL PRIMARY KEY,
    upload_batch_id UUID NOT NULL REFERENCES upload_batches(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    source_page_start INT NOT NULL,
    source_page_end INT NOT NULL,
    embedding VECTOR(1024) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_chunks_batch ON document_chunks (upload_batch_id);

-- 4. Tabel: curated_insights (Wawasan & Fakta Kunci Terkurasi AI)
CREATE TABLE IF NOT EXISTS curated_insights (
    id BIGSERIAL PRIMARY KEY,
    upload_batch_id UUID NOT NULL REFERENCES upload_batches(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    importance TEXT NOT NULL DEFAULT 'medium', -- 'high', 'medium', 'low'
    category TEXT DEFAULT 'track1_financial',
    tags TEXT[] DEFAULT '{}',
    source_pages TEXT DEFAULT '',
    source_chunk_id BIGINT REFERENCES document_chunks(id) ON DELETE SET NULL,
    embedding VECTOR(1024),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_curated_embedding ON curated_insights USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_curated_batch ON curated_insights (upload_batch_id);

-- Partial Unique Index: Mencegah duplikasi kurasi dari potongan chunk yang sama
CREATE UNIQUE INDEX IF NOT EXISTS idx_curated_unique_chunk 
ON curated_insights (upload_batch_id, source_chunk_id) 
WHERE source_chunk_id IS NOT NULL;

-- 5. Tabel: document_access_grants (Hak Akses Eksplisit Pengguna / User-Level ACL)
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
CREATE INDEX IF NOT EXISTS idx_doc_grants_level ON document_access_grants (access_level);

-- 6. Tabel: review_reminders (Pengingat Kedaluwarsa Siklus Dokumen)
CREATE TABLE IF NOT EXISTS review_reminders (
    id BIGSERIAL PRIMARY KEY,
    upload_batch_id UUID REFERENCES upload_batches(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    review_due_date TIMESTAMPTZ NOT NULL,
    is_notified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_reminders_due ON review_reminders (review_due_date);
