-- Migration 009: Add last_shared_message_id to chat_sessions
ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS last_shared_message_id VARCHAR(64);
