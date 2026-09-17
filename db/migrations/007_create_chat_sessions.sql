-- Migration 007: chat session persistence.
--
-- One chat session owns its complete conversation in messages JSONB.
-- A separate chat_messages table is intentionally not created because
-- the application reads and writes a session as one conversation.
-- Sessions are inserted by POST /api/chat-sessions only after the first
-- user message is submitted; opening /chat remains database-write free.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL DEFAULT 'Chat Baru',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated
    ON chat_sessions (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_pinned
    ON chat_sessions (user_id, is_pinned DESC, updated_at DESC);
