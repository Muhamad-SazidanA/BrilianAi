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

CREATE INDEX IF NOT EXISTS idx_chat_cache_key ON chat_response_cache (cache_key);
