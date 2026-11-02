-- 004_add_is_active_knowledge_to_upload_batches.sql
-- Tambahkan kolom is_active_knowledge ke tabel upload_batches
ALTER TABLE upload_batches 
ADD COLUMN IF NOT EXISTS is_active_knowledge BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_batches_active_knowledge 
ON upload_batches (is_active_knowledge);
