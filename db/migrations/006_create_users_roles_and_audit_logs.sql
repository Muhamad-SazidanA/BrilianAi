-- ========================================================================
-- Migration 006: Roles, Users, and Chat Audit Logs
-- ========================================================================

-- 1. Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Table: roles
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    permissions JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Default System Roles
INSERT INTO roles (id, name, description, is_system, permissions)
VALUES
    (
        'admin',
        'Super Administrator',
        'Akses penuh ke seluruh modul sistem, dokumen, kurasi AI, manajemen pengguna, dan audit log.',
        true,
        '["documents:read", "documents:upload", "documents:toggle_active", "documents:delete", "curation:trigger", "curation:edit", "curation:delete", "chat:query", "chat:export", "users:manage", "roles:manage", "audit:read"]'::jsonb
    ),
    (
        'editor',
        'Knowledge Manager & Editor',
        'Dapat mengunggah dokumen PDF, mengelola basis pengetahuan, menjalankan dan menyunting kurasi AI, serta bertanya ke Chatbot.',
        true,
        '["documents:read", "documents:upload", "documents:toggle_active", "curation:trigger", "curation:edit", "curation:delete", "chat:query", "chat:export"]'::jsonb
    ),
    (
        'member',
        'Member / Viewer',
        'Hak akses standar untuk membaca dokumen aktif dan bertanya pada AI Chatbot RAG.',
        true,
        '["documents:read", "chat:query", "chat:export"]'::jsonb
    )
ON CONFLICT (id) DO NOTHING;

-- 3. Table: users
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

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

-- Seed Initial Enterprise Users
INSERT INTO users (id, name, email, role_id, status, department, avatar_color, last_login_at)
VALUES
    (
        'a0000000-0000-0000-0000-000000000001',
        'Muhammad Sazidan',
        'admin@brilian.ai',
        'admin',
        'active',
        'IT & Architecture',
        '#2563EB',
        now()
    ),
    (
        'a0000000-0000-0000-0000-000000000002',
        'Budi Pratama',
        'budi.editor@brilian.ai',
        'editor',
        'active',
        'Clinical & Research',
        '#10B981',
        now() - INTERVAL '2 hours'
    ),
    (
        'a0000000-0000-0000-0000-000000000003',
        'Siti Rahmawati',
        'siti.member@brilian.ai',
        'member',
        'active',
        'Medical Staff',
        '#8B5CF6',
        now() - INTERVAL '5 hours'
    ),
    (
        'a0000000-0000-0000-0000-000000000004',
        'Ahmad Fauzi',
        'ahmad.fauzi@brilian.ai',
        'member',
        'active',
        'Compliance & Audit',
        '#F59E0B',
        now() - INTERVAL '1 day'
    ),
    (
        'a0000000-0000-0000-0000-000000000005',
        'Rian Hidayat',
        'rian.inactive@brilian.ai',
        'member',
        'inactive',
        'Internship',
        '#6B7280',
        now() - INTERVAL '7 days'
    )
ON CONFLICT (email) DO NOTHING;

-- 4. Table: chat_audit_logs
CREATE TABLE IF NOT EXISTS chat_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(120),
    user_email VARCHAR(150),
    user_department VARCHAR(100),
    query_text TEXT NOT NULL,
    topic VARCHAR(200),
    answer_excerpt TEXT,
    sources_used JSONB NOT NULL DEFAULT '[]',
    retrieved_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_audit_user_id ON chat_audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_audit_created_at ON chat_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_audit_topic ON chat_audit_logs (topic);
CREATE INDEX IF NOT EXISTS idx_chat_audit_session ON chat_audit_logs (session_id);
