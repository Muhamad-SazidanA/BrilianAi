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
