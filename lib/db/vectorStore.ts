import { getPool } from './dbClient';

export interface UploadBatch {
  id: string;
  original_filename: string;
  chunk_count: number;
  page_count: number;
  uploaded_at: Date | string;
}

export interface ChunkInput {
  content: string;
  sourcePageStart: number;
  sourcePageEnd: number;
  embedding: number[];
}

export interface DocumentChunk {
  id: number | string;
  upload_batch_id: string;
  chunk_index: number;
  content: string;
  source_page_start: number;
  source_page_end: number;
  embedding: string | number[];
  created_at: Date | string;
}

// Alias Chunk for flexibility
export type Chunk = DocumentChunk;

/**
 * Creates a new upload batch record in PostgreSQL and returns its UUID.
 *
 * @param filename - Original filename of the uploaded PDF
 * @param pageCount - Total number of pages in the PDF
 * @returns Promise<string> - The generated batch UUID
 */
export async function createUploadBatch(
  filename: string,
  pageCount: number
): Promise<string> {
  const pool = getPool();
  const sql = `
    INSERT INTO upload_batches (original_filename, page_count)
    VALUES ($1, $2)
    RETURNING id;
  `;
  const result = await pool.query<{ id: string }>(sql, [filename, pageCount]);
  return result.rows[0].id;
}

/**
 * Inserts document chunks in a single multi-row batch query with pgvector embedding,
 * and updates the upload_batches chunk_count within a transaction.
 *
 * @param batchId - UUID of the upload batch
 * @param chunks - Array of chunk objects with content, page range, and embedding vector
 */
export async function insertChunks(
  batchId: string,
  chunks: ChunkInput[]
): Promise<void> {
  if (!chunks || chunks.length === 0) {
    const pool = getPool();
    await pool.query('UPDATE upload_batches SET chunk_count = 0 WHERE id = $1', [batchId]);
    return;
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Build multi-row INSERT statement
    // Columns: upload_batch_id, chunk_index, content, source_page_start, source_page_end, embedding
    const values: any[] = [];
    const rowPlaceholders: string[] = [];

    chunks.forEach((chunk, index) => {
      const offset = index * 6;
      // Convert number[] vector into pgvector string format: '[0.1, 0.2, ...]'
      const vectorString = `[${chunk.embedding.join(',')}]`;

      rowPlaceholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}::vector)`
      );

      values.push(
        batchId,
        index,
        chunk.content,
        chunk.sourcePageStart,
        chunk.sourcePageEnd,
        vectorString
      );
    });

    const insertSql = `
      INSERT INTO document_chunks (
        upload_batch_id,
        chunk_index,
        content,
        source_page_start,
        source_page_end,
        embedding
      )
      VALUES ${rowPlaceholders.join(',\n      ')};
    `;

    await client.query(insertSql, values);

    // Update chunk_count on parent upload_batch
    await client.query(
      'UPDATE upload_batches SET chunk_count = $1 WHERE id = $2',
      [chunks.length, batchId]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Lists all upload batches ordered by latest uploaded_at first.
 *
 * @returns Promise<UploadBatch[]> - Array of upload batches
 */
export async function listBatches(): Promise<UploadBatch[]> {
  const pool = getPool();
  const sql = `
    SELECT id, original_filename, chunk_count, page_count, uploaded_at
    FROM upload_batches
    ORDER BY uploaded_at DESC;
  `;
  const result = await pool.query<UploadBatch>(sql);
  return result.rows;
}

/**
 * Lists all document chunks for a specific batch ID, ordered by chunk_index ascending.
 *
 * @param batchId - UUID of the upload batch
 * @returns Promise<DocumentChunk[]> - Array of document chunks
 */
export async function listChunks(batchId: string): Promise<DocumentChunk[]> {
  const pool = getPool();
  const sql = `
    SELECT
      id,
      upload_batch_id,
      chunk_index,
      content,
      source_page_start,
      source_page_end,
      embedding,
      created_at
    FROM document_chunks
    WHERE upload_batch_id = $1
    ORDER BY chunk_index ASC;
  `;
  const result = await pool.query<DocumentChunk>(sql, [batchId]);
  return result.rows;
}

export interface SimilarChunkResult {
  id: number | string;
  uploadBatchId: string;
  originalFilename: string;
  chunkIndex: number;
  content: string;
  sourcePageStart: number;
  sourcePageEnd: number;
  similarity: number;
}

export interface SearchOptions {
  batchId?: string;
  limit?: number;
  minSimilarity?: number;
}

/**
 * Searches for the most relevant document chunks based on cosine distance of embeddings.
 *
 * @param queryEmbedding - 1024-dimensional embedding vector of the search query
 * @param options - Optional filters (batchId, limit, minSimilarity)
 * @returns Promise<SimilarChunkResult[]> - Top matched chunks sorted by similarity desc
 */
export async function searchSimilarChunks(
  queryEmbedding: number[],
  options?: SearchOptions
): Promise<SimilarChunkResult[]> {
  if (!queryEmbedding || queryEmbedding.length === 0) {
    return [];
  }

  const pool = getPool();
  const limit = options?.limit ?? 5;
  const batchId = options?.batchId || null;
  const vectorString = `[${queryEmbedding.join(',')}]`;

  const sql = `
    SELECT
      c.id,
      c.upload_batch_id AS "uploadBatchId",
      b.original_filename AS "originalFilename",
      c.chunk_index AS "chunkIndex",
      c.content,
      c.source_page_start AS "sourcePageStart",
      c.source_page_end AS "sourcePageEnd",
      (1 - (c.embedding <=> $1::vector)) AS similarity
    FROM document_chunks c
    JOIN upload_batches b ON b.id = c.upload_batch_id
    WHERE ($2::uuid IS NULL OR c.upload_batch_id = $2)
    ORDER BY c.embedding <=> $1::vector ASC
    LIMIT $3;
  `;

  const result = await pool.query<SimilarChunkResult>(sql, [vectorString, batchId, limit]);
  
  if (options?.minSimilarity !== undefined) {
    return result.rows.filter((row) => row.similarity >= (options.minSimilarity ?? 0));
  }

  return result.rows;
}

export interface CuratedInsightInput {
  title: string;
  content: string;
  importance?: 'high' | 'medium' | 'low';
  category?: string;
  tags?: string[];
  sourcePages?: string;
  sourceChunkId?: number | string | null;
  embedding?: number[];
}

export interface CuratedInsight {
  id: number | string;
  upload_batch_id: string;
  title: string;
  content: string;
  importance: 'high' | 'medium' | 'low';
  category: string;
  tags: string[];
  source_pages: string;
  source_chunk_id: number | string | null;
  embedding?: string | number[];
  created_at: Date | string;
}

/**
 * Inserts one or more curated insights for a batch into curated_insights table.
 */
export async function insertCuratedInsights(
  batchId: string,
  insights: CuratedInsightInput[]
): Promise<CuratedInsight[]> {
  if (!insights || insights.length === 0) {
    return [];
  }

  const pool = getPool();
  const client = await pool.connect();
  const inserted: CuratedInsight[] = [];

  try {
    await client.query('BEGIN');

    for (const item of insights) {
      const importance = item.importance || 'medium';
      const category = item.category || 'track1_financial';
      const tags = item.tags || [];
      const sourcePages = item.sourcePages || '';
      const sourceChunkId = item.sourceChunkId || null;
      const embedding = item.embedding ? `[${item.embedding.join(',')}]` : null;

      const sql = `
        INSERT INTO curated_insights (
          upload_batch_id,
          title,
          content,
          importance,
          category,
          tags,
          source_pages,
          source_chunk_id,
          embedding
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)
        RETURNING *;
      `;

      const res = await client.query<CuratedInsight>(sql, [
        batchId,
        item.title,
        item.content,
        importance,
        category,
        tags,
        sourcePages,
        sourceChunkId,
        embedding,
      ]);
      inserted.push(res.rows[0]);
    }

    await client.query('COMMIT');
    return inserted;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Lists all curated insights for a specific batch ID, ordered by importance and created_at.
 */
export async function listCuratedInsights(batchId: string): Promise<CuratedInsight[]> {
  const pool = getPool();
  const sql = `
    SELECT
      id,
      upload_batch_id,
      title,
      content,
      importance,
      category,
      tags,
      source_pages,
      source_chunk_id,
      created_at
    FROM curated_insights
    WHERE upload_batch_id = $1
    ORDER BY
      CASE importance
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
        ELSE 4
      END ASC,
      id ASC;
  `;
  const result = await pool.query<CuratedInsight>(sql, [batchId]);
  return result.rows;
}

/**
 * Updates a curated insight by ID (title, content, importance, category, tags, embedding).
 * Note: Raw chunks remain read-only; only curated insights are editable.
 */
export async function updateCuratedInsight(
  id: number | string,
  data: Partial<Pick<CuratedInsightInput, 'title' | 'content' | 'importance' | 'category' | 'tags' | 'embedding'>>
): Promise<CuratedInsight> {
  const pool = getPool();
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(data.title);
  }
  if (data.content !== undefined) {
    updates.push(`content = $${paramIndex++}`);
    values.push(data.content);
  }
  if (data.importance !== undefined) {
    updates.push(`importance = $${paramIndex++}`);
    values.push(data.importance);
  }
  if (data.category !== undefined) {
    updates.push(`category = $${paramIndex++}`);
    values.push(data.category);
  }
  if (data.tags !== undefined) {
    updates.push(`tags = $${paramIndex++}`);
    values.push(data.tags);
  }
  if (data.embedding !== undefined) {
    updates.push(`embedding = $${paramIndex++}::vector`);
    values.push(`[${data.embedding.join(',')}]`);
  }

  if (updates.length === 0) {
    const res = await pool.query<CuratedInsight>('SELECT * FROM curated_insights WHERE id = $1', [id]);
    if (res.rowCount === 0) throw new Error(`Curated insight with ID ${id} not found.`);
    return res.rows[0];
  }

  values.push(id);
  const sql = `
    UPDATE curated_insights
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *;
  `;

  const result = await pool.query<CuratedInsight>(sql, values);
  if (result.rowCount === 0) {
    throw new Error(`Curated insight with ID ${id} not found.`);
  }
  return result.rows[0];
}

