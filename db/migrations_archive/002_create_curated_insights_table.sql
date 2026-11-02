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
