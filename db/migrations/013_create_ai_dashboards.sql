-- Migration: 013_create_ai_dashboards.sql
-- Create ai_dashboards table for storing AI interactive dashboard snapshots

CREATE TABLE IF NOT EXISTS ai_dashboards (
    dashboard_id VARCHAR(64) PRIMARY KEY,
    message_id VARCHAR(255) NOT NULL,
    session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'Dashboard AI',
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    views_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_dashboards_message_id ON ai_dashboards(message_id);
CREATE INDEX IF NOT EXISTS idx_ai_dashboards_user_id ON ai_dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_dashboards_created_at ON ai_dashboards(created_at DESC);
