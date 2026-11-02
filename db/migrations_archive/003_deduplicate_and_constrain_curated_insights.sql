-- 003_deduplicate_and_constrain_curated_insights.sql
-- 1. Bersihkan baris duplikat yang sudah tersimpan di curated_insights
DELETE FROM curated_insights
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY upload_batch_id, source_chunk_id 
            ORDER BY id DESC
        ) as rnum
        FROM curated_insights
        WHERE source_chunk_id IS NOT NULL
    ) t
    WHERE t.rnum > 1
);

-- 2. Buat partial unique index agar pasangan (upload_batch_id, source_chunk_id) tidak pernah bisa duplikat lagi
CREATE UNIQUE INDEX IF NOT EXISTS idx_curated_unique_chunk 
ON curated_insights (upload_batch_id, source_chunk_id) 
WHERE source_chunk_id IS NOT NULL;
