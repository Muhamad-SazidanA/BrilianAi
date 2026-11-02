-- ========================================================================
-- Migration 003: AI Multi-Agent Chat, Dashboards, Audit Logs & Analytics
-- ========================================================================

-- 1. Tabel: chat_sessions (Sesi Percakapan Interaktif Multi-Turn)
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL DEFAULT 'Chat Baru',
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_shared_message_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated ON chat_sessions (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_pinned ON chat_sessions (user_id, is_pinned DESC, updated_at DESC);

-- 2. Tabel: shared_chats (Tautan Berbagi Percakapan Publik / Eksternal)
CREATE TABLE IF NOT EXISTS shared_chats (
    share_id VARCHAR(64) PRIMARY KEY,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'Percakapan AI',
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    views_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_chats_session_id ON shared_chats(session_id);

-- 3. Tabel: ai_dashboards (Snapshot Visualisasi Dashboard Interaktif per Turn Pertanyaan)
CREATE TABLE IF NOT EXISTS ai_dashboards (
    dashboard_id VARCHAR(64) PRIMARY KEY,
    message_id VARCHAR(255) NOT NULL,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
    turn_index INTEGER,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'Dashboard AI',
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    views_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_dashboards_message_id ON ai_dashboards(message_id);
CREATE INDEX IF NOT EXISTS idx_ai_dashboards_user_id ON ai_dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_dashboards_session_turn ON ai_dashboards(session_id, turn_index);
CREATE INDEX IF NOT EXISTS idx_ai_dashboards_created_at ON ai_dashboards(created_at DESC);

-- 4. Tabel: chat_audit_logs (Log Kueri Obrolan Spesifik & Ekstraksi Topik)
CREATE TABLE IF NOT EXISTS chat_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(100),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(120),
    user_email VARCHAR(150),
    user_role VARCHAR(50),
    user_department VARCHAR(100),
    query_text TEXT,
    query TEXT,
    topic VARCHAR(200),
    answer_excerpt TEXT,
    answer TEXT,
    sources_used JSONB NOT NULL DEFAULT '[]'::jsonb,
    sources_count INT DEFAULT 0,
    retrieved_count INT NOT NULL DEFAULT 0,
    latency_ms INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_audit_user_id ON chat_audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_audit_created_at ON chat_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_audit_topic ON chat_audit_logs (topic);
CREATE INDEX IF NOT EXISTS idx_chat_audit_session ON chat_audit_logs (session_id);

-- 5. Tabel: audit_logs (Unified Enterprise Audit Trail: Auth, Dokumen, Role, Dashboard, dsb)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_category VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
    action VARCHAR(100) NOT NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(150),
    actor_email VARCHAR(150),
    actor_department VARCHAR(100),
    actor_ip VARCHAR(50),
    resource_type VARCHAR(50),
    resource_id VARCHAR(150),
    resource_name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_logs (event_category);
CREATE INDEX IF NOT EXISTS idx_audit_actor_id ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_status ON audit_logs (status);

-- 6. Tabel: chat_response_cache (Semantic & Exact Query Cache)
CREATE TABLE IF NOT EXISTS chat_response_cache (
    cache_key TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    answer TEXT NOT NULL,
    sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    allow_public_knowledge BOOLEAN NOT NULL DEFAULT false,
    retrieved_count INT NOT NULL DEFAULT 0,
    access_group_id VARCHAR(100) NOT NULL DEFAULT 'all',
    corpus_version VARCHAR(50) NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_cache_key ON chat_response_cache (cache_key);
CREATE INDEX IF NOT EXISTS idx_chat_cache_access_group ON chat_response_cache (access_group_id);

-- 7. Tabel: knowledge_gaps (Pertanyaan yang Belum Terjawab / Belum Ada Dokumennya)
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

-- 8. Tabel: answer_feedback (Umpan Balik Pengguna: helpful, incorrect, outdated)
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

-- 9. Tabel: expert_answers (Jawaban Pakar Terverifikasi / Golden Answers)
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

-- 10. Tabel: glossary_terms (Glosarium Istilah & Terminologi Internal)
CREATE TABLE IF NOT EXISTS glossary_terms (
    id BIGSERIAL PRIMARY KEY,
    term VARCHAR(100) NOT NULL UNIQUE,
    standard_term VARCHAR(100) NOT NULL,
    definition TEXT,
    division_id VARCHAR(100) DEFAULT 'General',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_glossary_terms_term ON glossary_terms (term);

-- 11. Tabel: model_configs (Konfigurasi Multi-Tier Model & Deployment Mode)
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
