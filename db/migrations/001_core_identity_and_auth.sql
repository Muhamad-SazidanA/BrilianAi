-- ========================================================================
-- Migration 001: Core Identity, Access Control (RBAC) & Sessions
-- ========================================================================

-- 1. Pastikan ekstensi kriptografi aktif
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabel: roles
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    allowed_classifications JSONB NOT NULL DEFAULT '["Publik", "Internal"]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Default System Roles
INSERT INTO roles (id, name, description, is_system, permissions, allowed_classifications)
VALUES
    (
        'admin',
        'Super Administrator',
        'Akses penuh ke seluruh modul sistem, dokumen, kurasi AI, manajemen pengguna, dan audit log.',
        true,
        '["dashboard:admin", "dashboard:documents", "dashboard:personal", "documents:read", "documents:upload", "documents:toggle_active", "documents:delete", "curation:trigger", "curation:edit", "curation:delete", "chat:query", "chat:export", "users:manage", "roles:manage", "audit:read"]'::jsonb,
        '["Publik", "Internal", "Rahasia", "Sangat Rahasia"]'::jsonb
    ),
    (
        'editor',
        'Knowledge Manager & Editor',
        'Dapat mengunggah dokumen PDF, mengelola basis pengetahuan, menjalankan dan menyunting kurasi AI, serta bertanya ke Chatbot.',
        true,
        '["dashboard:documents", "dashboard:personal", "documents:read", "documents:upload", "documents:toggle_active", "curation:trigger", "curation:edit", "curation:delete", "chat:query", "chat:export"]'::jsonb,
        '["Publik", "Internal", "Rahasia"]'::jsonb
    ),
    (
        'member',
        'Member / Viewer',
        'Hak akses standar untuk membaca dokumen aktif dan bertanya pada AI Chatbot RAG.',
        true,
        '["dashboard:personal", "documents:read", "chat:query", "chat:export"]'::jsonb,
        '["Publik", "Internal"]'::jsonb
    ),
    (
        'chat_only',
        'Chatbot Specialist',
        'Hak akses khusus percakapan: hanya dapat bertanya dan berdiskusi dengan AI Chatbot RAG.',
        false,
        '["chat:query", "chat:export"]'::jsonb,
        '["Publik", "Internal"]'::jsonb
    ),
    (
        'knowledge_only',
        'Knowledge Viewer',
        'Hak akses khusus pembaca: hanya dapat membuka dan mempelajari repositori dokumen pengetahuan.',
        false,
        '["documents:read"]'::jsonb,
        '["Publik", "Internal"]'::jsonb
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    permissions = EXCLUDED.permissions,
    allowed_classifications = EXCLUDED.allowed_classifications;

-- 3. Tabel: users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT,
    role_id VARCHAR(50) NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT DEFAULT 'member',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    department VARCHAR(100),
    avatar_color VARCHAR(20) DEFAULT '#2563EB',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

-- Seed Initial Super Admin User (ID statis a0000000-0000-0000-0000-000000000001)
INSERT INTO users (id, name, email, role_id, status, department, avatar_color, last_login_at)
VALUES
    (
        'a0000000-0000-0000-0000-000000000001',
        'Super Admin',
        'superadmin@brilian.ai',
        'admin',
        'active',
        'System Administration',
        '#2563EB',
        now()
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role_id = EXCLUDED.role_id,
    status = 'active';

-- 4. Tabel: user_sessions (Enterprise Stateful Session Store)
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
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions (expires_at);
