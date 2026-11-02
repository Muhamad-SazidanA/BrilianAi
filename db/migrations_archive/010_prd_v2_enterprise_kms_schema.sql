-- Migration 010: PRD v2.0 Enterprise KMS Schema
-- Menambahkan metadata siklus hidup, ABAC, Knowledge Gaps, Answer Feedback, dan Model Configs

-- 1. Penambahan Kolom Lifecycle & ABAC pada upload_batches
ALTER TABLE upload_batches 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS division_id VARCHAR(100) NOT NULL DEFAULT 'General',
ADD COLUMN IF NOT EXISTS classification VARCHAR(50) NOT NULL DEFAULT 'Internal',
ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'Aktif',
ADD COLUMN IF NOT EXISTS version VARCHAR(20) NOT NULL DEFAULT '1.0',
ADD COLUMN IF NOT EXISTS supersedes_id UUID REFERENCES upload_batches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS effective_date TIMESTAMPTZ NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS review_due_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_batches_status ON upload_batches (status);
CREATE INDEX IF NOT EXISTS idx_batches_division ON upload_batches (division_id);
CREATE INDEX IF NOT EXISTS idx_batches_classification ON upload_batches (classification);

-- 2. Penambahan Kolom Smart Cache (ABAC & Corpus Version)
ALTER TABLE chat_response_cache
ADD COLUMN IF NOT EXISTS access_group_id VARCHAR(100) NOT NULL DEFAULT 'all',
ADD COLUMN IF NOT EXISTS corpus_version VARCHAR(50) NOT NULL DEFAULT 'v1';

CREATE INDEX IF NOT EXISTS idx_chat_cache_access_group ON chat_response_cache (access_group_id);

-- 3. Penambahan Kolom Shared Chats Keamanan & Kedaluwarsa
ALTER TABLE shared_chats
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT false;

-- 4. Tabel Knowledge Gaps (B2, F3: Kueri yang gagal dijawab untuk ditindaklanjuti)
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

CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_status ON knowledge_gaps (status);
CREATE INDEX IF NOT EXISTS idx_knowledge_gaps_freq ON knowledge_gaps (frequency DESC);

-- 5. Tabel Answer Feedback (B8: Umpan balik jawaban - helpful, incorrect, outdated)
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

CREATE INDEX IF NOT EXISTS idx_answer_feedback_rating ON answer_feedback (rating);

-- 6. Tabel Expert Answers (E1, E2: Jawaban terverifikasi pakar / Golden Answers)
CREATE TABLE IF NOT EXISTS expert_answers (
    id BIGSERIAL PRIMARY KEY,
    gap_id BIGINT REFERENCES knowledge_gaps(id) ON DELETE SET NULL,
    expert_id UUID REFERENCES users(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expert_answers_status ON expert_answers (status);

-- 7. Tabel Glossary Terms (B6: Glosarium dan sinonim istilah perusahaan)
CREATE TABLE IF NOT EXISTS glossary_terms (
    id BIGSERIAL PRIMARY KEY,
    term VARCHAR(100) NOT NULL UNIQUE,
    standard_term VARCHAR(100) NOT NULL,
    definition TEXT,
    division_id VARCHAR(100) DEFAULT 'General',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_glossary_terms_term ON glossary_terms (term);

-- 8. Tabel Review Reminders (C1: Pengingat dokumen kedaluwarsa)
CREATE TABLE IF NOT EXISTS review_reminders (
    id BIGSERIAL PRIMARY KEY,
    upload_batch_id UUID REFERENCES upload_batches(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    review_due_date TIMESTAMPTZ NOT NULL,
    is_notified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Tabel Model Configs (D2: Konfigurasi Multi-Tier Model & Deployment Mode)
CREATE TABLE IF NOT EXISTS model_configs (
    id BIGSERIAL PRIMARY KEY,
    deployment_mode VARCHAR(50) NOT NULL DEFAULT 'Cloud' CHECK (deployment_mode IN ('Cloud', 'On-premise', 'VPC')),
    agent_role VARCHAR(50) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    priority INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
