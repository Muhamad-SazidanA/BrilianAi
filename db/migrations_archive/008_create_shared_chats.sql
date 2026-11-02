-- Migration 008: shared_chats table for public conversation sharing
CREATE TABLE IF NOT EXISTS shared_chats (
    share_id VARCHAR(64) PRIMARY KEY,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'Percakapan AI',
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    views_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_chats_session_id ON shared_chats(session_id);
