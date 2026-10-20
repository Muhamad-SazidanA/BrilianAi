import { getPool } from './dbClient';
import type { DocumentClassification, DocumentStatus } from '@/types/document';

export type { DocumentClassification, DocumentStatus };

export interface UploadBatch {
  id: string;
  original_filename: string;
  chunk_count: number;
  page_count: number;
  uploaded_at: Date | string;
  is_active_knowledge?: boolean;
  curated_count?: number;
  processed_chunks?: number;
  owner_id?: string | null;
  division_id?: string;
  classification?: DocumentClassification;
  status?: DocumentStatus;
  version?: string;
  supersedes_id?: string | null;
  effective_date?: Date | string;
  review_due_date?: Date | string | null;
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

export interface CreateBatchOptions {
  ownerId?: string | null;
  divisionId?: string;
  classification?: DocumentClassification;
  status?: DocumentStatus;
  version?: string;
  supersedesId?: string | null;
  reviewDueDate?: Date | string | null;
}

/**
 * Creates a new upload batch record in PostgreSQL and returns its UUID.
 * Mendukung metadata siklus hidup & ABAC sesuai PRD v2.0.
 *
 * @param filename - Original filename of the uploaded PDF
 * @param pageCount - Total number of pages in the PDF
 * @param options - Optional metadata (owner, division, classification, status, version, reviewDueDate)
 * @returns Promise<string> - The generated batch UUID
 */
export async function createUploadBatch(
  filename: string,
  pageCount: number,
  options?: CreateBatchOptions
): Promise<string> {
  const pool = getPool();
  const divisionId = options?.divisionId || 'General';
  const classification = options?.classification || 'Internal';
  const rawStatus = options?.status || 'Menunggu Kurasi';
  const status = rawStatus === 'Aktif' ? 'Menunggu Kurasi' : rawStatus;
  const version = options?.version || '1.0';
  const ownerId = options?.ownerId || null;
  const supersedesId = options?.supersedesId || null;
  const reviewDueDate = options?.reviewDueDate || null;

  try {
    const sql = `
      INSERT INTO upload_batches (
        original_filename, 
        page_count, 
        is_active_knowledge,
        owner_id,
        division_id,
        classification,
        status,
        version,
        supersedes_id,
        review_due_date
      )
      VALUES ($1, $2, false, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id;
    `;
    const result = await pool.query<{ id: string }>(sql, [
      filename,
      pageCount,
      ownerId,
      divisionId,
      classification,
      status,
      version,
      supersedesId,
      reviewDueDate,
    ]);
    return result.rows[0].id;
  } catch {
    const fallbackSql = `
      INSERT INTO upload_batches (original_filename, page_count, is_active_knowledge)
      VALUES ($1, $2, false)
      RETURNING id;
    `;
    try {
      const result = await pool.query<{ id: string }>(fallbackSql, [filename, pageCount]);
      return result.rows[0].id;
    } catch {
      const basicSql = `
        INSERT INTO upload_batches (original_filename, page_count)
        VALUES ($1, $2)
        RETURNING id;
      `;
      const result = await pool.query<{ id: string }>(basicSql, [filename, pageCount]);
      return result.rows[0].id;
    }
  }
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
 * Mengembalikan metadata batch beserta total curated_count dari tabel curated_insights.
 *
 * @returns Promise<UploadBatch[]> - Array of upload batches
 */
export async function listBatches(): Promise<UploadBatch[]> {
  const pool = getPool();
  try {
    const sql = `
      SELECT 
        b.id, 
        b.original_filename, 
        b.chunk_count, 
        b.page_count, 
        b.uploaded_at, 
        (COALESCE(b.is_active_knowledge, false) AND COALESCE(ci.curated_count, 0) > 0) AS is_active_knowledge,
        b.owner_id,
        COALESCE(b.division_id, 'General') AS division_id,
        COALESCE(b.classification, 'Internal') AS classification,
        CASE 
          WHEN COALESCE(ci.curated_count, 0) = 0 THEN 'Menunggu Kurasi'
          ELSE COALESCE(b.status, 'Aktif')
        END AS status,
        COALESCE(b.version, '1.0') AS version,
        b.effective_date,
        b.review_due_date,
        COALESCE(ci.curated_count, 0)::int AS curated_count,
        COALESCE(ci.processed_chunks, 0)::int AS processed_chunks
      FROM upload_batches b
      LEFT JOIN (
        SELECT 
          upload_batch_id, 
          COUNT(*)::int AS curated_count,
          COUNT(DISTINCT source_chunk_id)::int AS processed_chunks
        FROM curated_insights
        GROUP BY upload_batch_id
      ) ci ON ci.upload_batch_id = b.id
      ORDER BY b.uploaded_at DESC;
    `;
    const result = await pool.query<UploadBatch>(sql);
    return result.rows;
  } catch {
    const fallbackSql = `
      SELECT id, original_filename, chunk_count, page_count, uploaded_at, COALESCE(is_active_knowledge, false) AS is_active_knowledge
      FROM upload_batches
      ORDER BY uploaded_at DESC;
    `;
    try {
      const result = await pool.query<UploadBatch>(fallbackSql);
      return result.rows.map((b) => ({ ...b, curated_count: 0, processed_chunks: 0 }));
    } catch {
      const basicSql = `
        SELECT id, original_filename, chunk_count, page_count, uploaded_at
        FROM upload_batches
        ORDER BY uploaded_at DESC;
      `;
      const result = await pool.query<UploadBatch>(basicSql);
      return result.rows.map((b) => ({ ...b, is_active_knowledge: false, curated_count: 0, processed_chunks: 0 }));
    }
  }
}

/**
 * Gets a single upload batch by ID beserta curated_count dan processed_chunks.
 */
export async function getBatchById(batchId: string): Promise<UploadBatch | null> {
  const pool = getPool();
  try {
    const sql = `
      SELECT 
        b.id, 
        b.original_filename, 
        b.chunk_count, 
        b.page_count, 
        b.uploaded_at, 
        (COALESCE(b.is_active_knowledge, false) AND COALESCE(ci.curated_count, 0) > 0) AS is_active_knowledge,
        b.owner_id,
        COALESCE(b.division_id, 'General') AS division_id,
        COALESCE(b.classification, 'Internal') AS classification,
        CASE 
          WHEN COALESCE(ci.curated_count, 0) = 0 THEN 'Menunggu Kurasi'
          ELSE COALESCE(b.status, 'Aktif')
        END AS status,
        COALESCE(b.version, '1.0') AS version,
        b.effective_date,
        b.review_due_date,
        COALESCE(ci.curated_count, 0)::int AS curated_count,
        COALESCE(ci.processed_chunks, 0)::int AS processed_chunks
      FROM upload_batches b
      LEFT JOIN (
        SELECT 
          upload_batch_id, 
          COUNT(*)::int AS curated_count,
          COUNT(DISTINCT source_chunk_id)::int AS processed_chunks
        FROM curated_insights
        WHERE upload_batch_id = $1
        GROUP BY upload_batch_id
      ) ci ON ci.upload_batch_id = b.id
      WHERE b.id = $1;
    `;
    const result = await pool.query<UploadBatch>(sql, [batchId]);
    return result.rows[0] || null;
  } catch {
    const fallbackSql = `
      SELECT id, original_filename, chunk_count, page_count, uploaded_at, COALESCE(is_active_knowledge, false) AS is_active_knowledge
      FROM upload_batches
      WHERE id = $1;
    `;
    try {
      const result = await pool.query<UploadBatch>(fallbackSql, [batchId]);
      return result.rows[0] ? { ...result.rows[0], curated_count: 0, processed_chunks: 0 } : null;
    } catch {
      const basicSql = `
        SELECT id, original_filename, chunk_count, page_count, uploaded_at
        FROM upload_batches
        WHERE id = $1;
      `;
      const result = await pool.query<UploadBatch>(basicSql, [batchId]);
      return result.rows[0] ? { ...result.rows[0], is_active_knowledge: false, curated_count: 0, processed_chunks: 0 } : null;
    }
  }
}

/**
 * Toggles a batch's is_active_knowledge status for Chatbot grounding.
 */
export async function toggleBatchKnowledgeBase(
  batchId: string,
  isActive: boolean
): Promise<UploadBatch> {
  const pool = getPool();
  try {
    await pool.query(
      `ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS is_active_knowledge BOOLEAN NOT NULL DEFAULT false;`
    );
  } catch (err) {
    console.warn('[VectorStore] ALTER TABLE ensure is_active_knowledge warning:', err);
  }

  // Aturan Ketat: Dokumen HANYA boleh diaktifkan jika telah memiliki minimal 1 insight terkurasi
  if (isActive) {
    const curRes = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM curated_insights WHERE upload_batch_id = $1`,
      [batchId]
    );
    if ((curRes.rows[0]?.count || 0) === 0) {
      throw new Error(
        'Dokumen belum memiliki insight terkurasi. Lakukan kurasi dokumen terlebih dahulu sebelum mengaktifkannya sebagai basis pengetahuan AI.'
      );
    }
  }

  const sql = `
    UPDATE upload_batches
    SET is_active_knowledge = $1, status = $2
    WHERE id = $3
    RETURNING id, original_filename, chunk_count, page_count, uploaded_at, is_active_knowledge, status;
  `;
  const nextStatus = isActive ? 'Aktif' : 'Standby';
  const result = await pool.query<UploadBatch>(sql, [isActive, nextStatus, batchId]);
  if (result.rowCount === 0) {
    throw new Error(`Upload batch with ID ${batchId} not found.`);
  }
  return result.rows[0];
}

/**
 * Updates batch metadata (status, classification, division_id, version, review_due_date).
 */
export async function updateBatchMetadata(
  batchId: string,
  metadata: {
    status?: DocumentStatus;
    classification?: DocumentClassification;
    divisionId?: string;
    version?: string;
    reviewDueDate?: Date | string | null;
  }
): Promise<UploadBatch> {
  const pool = getPool();
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (metadata.status) {
    if (metadata.status === 'Aktif') {
      const curRes = await pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM curated_insights WHERE upload_batch_id = $1`,
        [batchId]
      );
      if ((curRes.rows[0]?.count || 0) === 0) {
        throw new Error(
          'Dokumen belum memiliki insight terkurasi. Silakan lakukan kurasi dokumen terlebih dahulu sebelum menyetel status Aktif.'
        );
      }
    }
    fields.push(`status = $${idx++}`);
    values.push(metadata.status);
    // Jika status diset bukan 'Aktif', otomatis is_active_knowledge = false
    if (metadata.status !== 'Aktif') {
      fields.push(`is_active_knowledge = false`);
    } else {
      fields.push(`is_active_knowledge = true`);
    }
  }
  if (metadata.classification) {
    fields.push(`classification = $${idx++}`);
    values.push(metadata.classification);
  }
  if (metadata.divisionId) {
    fields.push(`division_id = $${idx++}`);
    values.push(metadata.divisionId);
  }
  if (metadata.version) {
    fields.push(`version = $${idx++}`);
    values.push(metadata.version);
  }
  if (metadata.reviewDueDate !== undefined) {
    fields.push(`review_due_date = $${idx++}`);
    values.push(metadata.reviewDueDate);
  }

  if (fields.length === 0) {
    const existing = await getBatchById(batchId);
    if (!existing) throw new Error(`Batch with ID ${batchId} not found.`);
    return existing;
  }

  values.push(batchId);
  const sql = `
    UPDATE upload_batches
    SET ${fields.join(', ')}
    WHERE id = $${idx}
    RETURNING id, original_filename, chunk_count, page_count, uploaded_at, is_active_knowledge,
              owner_id, division_id, classification, status, version, effective_date, review_due_date;
  `;
  const result = await pool.query<UploadBatch>(sql, values);
  if (result.rowCount === 0) {
    throw new Error(`Upload batch with ID ${batchId} not found.`);
  }
  return result.rows[0];
}

/**
 * Mengaktifkan atau menonaktifkan seluruh dokumen yang memiliki chunk sebagai basis pengetahuan AI Chatbot.
 */
export async function activateAllBatches(active: boolean = true): Promise<number> {
  const pool = getPool();
  try {
    const sql = active
      ? `
        UPDATE upload_batches
        SET is_active_knowledge = true, status = 'Aktif'
        WHERE chunk_count > 0
          AND EXISTS (SELECT 1 FROM curated_insights ci WHERE ci.upload_batch_id = upload_batches.id);
      `
      : `
        UPDATE upload_batches
        SET is_active_knowledge = false, status = 'Standby';
      `;
    const res = await pool.query(sql);
    return res.rowCount || 0;
  } catch (err) {
    console.error('[VectorStore] Error activateAllBatches:', err);
    throw err;
  }
}

/**
 * Deletes an upload batch by ID.
 * Cascades to document_chunks and curated_insights automatically.
 */
export async function deleteUploadBatch(batchId: string): Promise<boolean> {
  const pool = getPool();
  const sql = `DELETE FROM upload_batches WHERE id = $1;`;
  const result = await pool.query(sql, [batchId]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Updates the original filename of an upload batch.
 */
export async function updateUploadBatchFilename(
  batchId: string,
  newFilename: string
): Promise<UploadBatch> {
  const pool = getPool();
  const sql = `
    UPDATE upload_batches
    SET original_filename = $1
    WHERE id = $2
    RETURNING id, original_filename, chunk_count, page_count, uploaded_at;
  `;
  const result = await pool.query<UploadBatch>(sql, [newFilename, batchId]);
  if (result.rowCount === 0) {
    throw new Error(`Upload batch with ID ${batchId} not found.`);
  }
  return result.rows[0];
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
  classification?: string;
  version?: string;
}

export interface SearchOptions {
  batchId?: string;
  limit?: number;
  minSimilarity?: number;
  onlyActiveKnowledge?: boolean;
  textQuery?: string;
  // PRD v2.0 ABAC & Lifecycle
  divisionId?: string;
  allowedClassifications?: DocumentClassification[];
  onlyActiveStatus?: boolean;
  grantedBatchIds?: string[];
}

/**
 * Extracts meaningful keyword tokens from a natural language search query.
 */
export function extractKeywords(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const clean = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  const tokens = clean.split(/\s+/).filter((t) => t.length >= 3);

  const stopWords = new Set([
    'apa', 'itu', 'arti', 'definisi', 'pengertian', 'maksud', 'dari', 'yang', 'di',
    'ke', 'dan', 'atau', 'ini', 'itu', 'adalah', 'yaitu', 'sebutkan', 'jelaskan',
    'tentang', 'mengenai', 'bagaimana', 'kenapa', 'mengapa', 'siapa', 'dimana',
    'kapan', 'apakah', 'dalam', 'untuk', 'pada', 'dengan', 'oleh', 'atas', 'bisa',
    'dapat', 'tolong', 'mohon', 'buat', 'buatkan', 'kasih', 'tampilkan', 'secara',
    'singkat', 'padat', 'jelas', 'detail', 'lengkap', 'list', 'poin', 'paragraf'
  ]);

  const filtered = tokens.filter((t) => !stopWords.has(t));
  return filtered.length > 0 ? filtered : tokens;
}

/**
 * Calculates cosine similarity between two numeric vectors in memory.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Enterprise Helper: Parameterizes ABAC and lifecycle filter clauses with typed bind values.
 * Completely eliminates SQL injection risk and enables Postgres query execution plan caching.
 */
function appendAbacClause(
  ctx: { params: any[] },
  options?: SearchOptions
): string {
  const statusCondition = options?.onlyActiveStatus !== false
    ? "AND (b.status IS NULL OR b.status = 'Aktif')"
    : '';

  let divisionCondition = '';
  if (options?.divisionId && options.divisionId !== 'all') {
    ctx.params.push(options.divisionId);
    divisionCondition = `AND (b.division_id IS NULL OR b.division_id = 'General' OR b.division_id = $${ctx.params.length})`;
  }

  let classificationCondition = '';
  if (options?.allowedClassifications && options.allowedClassifications.length > 0) {
    ctx.params.push(options.allowedClassifications);
    classificationCondition = `AND (b.classification IS NULL OR b.classification = ANY($${ctx.params.length}::text[]))`;
  }

  let explicitGrantCondition = '';
  if (options?.grantedBatchIds && options.grantedBatchIds.length > 0) {
    ctx.params.push(options.grantedBatchIds);
    explicitGrantCondition = `OR b.id = ANY($${ctx.params.length}::uuid[])`;
  }

  return `${statusCondition} AND ((1=1 ${divisionCondition} ${classificationCondition}) ${explicitGrantCondition})`;
}

/**
 * Searches for the most relevant document chunks based on Hybrid Search (pgvector cosine distance + keyword match).
 *
 * @param queryEmbedding - 1024-dimensional embedding vector of the search query
 * @param options - Optional filters (batchId, limit, minSimilarity, onlyActiveKnowledge, textQuery)
 * @returns Promise<SimilarChunkResult[]> - Top matched chunks sorted by similarity desc
 */
export async function searchSimilarChunks(
  queryEmbedding: number[],
  options?: SearchOptions
): Promise<SimilarChunkResult[]> {
  if ((!queryEmbedding || queryEmbedding.length === 0) && !options?.textQuery) {
    return [];
  }

  const pool = getPool();
  const limit = options?.limit ?? 5;
  const batchId = options?.batchId || null;
  const activeCondition = options?.onlyActiveKnowledge
    ? "AND COALESCE(b.is_active_knowledge, false) = true AND (b.status IS NULL OR b.status = 'Aktif') AND EXISTS (SELECT 1 FROM curated_insights ci WHERE ci.upload_batch_id = b.id)"
    : '';

  const results: SimilarChunkResult[] = [];
  const seenIds = new Set<string | number>();

  // 1. Dense Vector Search (if queryEmbedding provided)
  if (queryEmbedding && queryEmbedding.length > 0) {
    try {
      const vectorString = `[${queryEmbedding.join(',')}]`;
      const ctx = { params: [vectorString, batchId, limit] };
      const abacFilter = appendAbacClause(ctx, options);

      const sql = `
        SELECT
          c.id,
          c.upload_batch_id AS "uploadBatchId",
          b.original_filename AS "originalFilename",
          c.chunk_index AS "chunkIndex",
          c.content,
          c.source_page_start AS "sourcePageStart",
          c.source_page_end AS "sourcePageEnd",
          COALESCE(b.classification, 'Internal') AS classification,
          COALESCE(b.version, '1.0') AS version,
          (1 - (c.embedding <=> $1::vector)) AS similarity
        FROM document_chunks c
        JOIN upload_batches b ON b.id = c.upload_batch_id
        WHERE ($2::uuid IS NULL OR c.upload_batch_id = $2)
          ${activeCondition}
          ${abacFilter}
        ORDER BY c.embedding <=> $1::vector ASC
        LIMIT $3;
      `;

      const result = await pool.query<SimilarChunkResult>(sql, ctx.params);
      const minSim = options?.minSimilarity !== undefined ? options.minSimilarity : 0.20;

      for (const row of (result?.rows || [])) {
        const rawSim = typeof row.similarity === 'number' ? row.similarity : parseFloat(String(row.similarity));
        const sim = isNaN(rawSim) ? 0 : rawSim;
        if (sim >= minSim) {
          row.similarity = sim;
          results.push(row);
          seenIds.add(row.id);
        }
      }

      // Hybrid Re-ranking: Boost skor jika potongan teks / nama file memuat keyword pertanyaan
      if (options?.textQuery && results.length > 0) {
        const keywords = extractKeywords(options.textQuery);
        if (keywords.length > 0) {
          for (const row of results) {
            let boost = 0;
            const fnLower = (row.originalFilename || '').toLowerCase();
            const contentLower = (row.content || '').toLowerCase();

            // Boost jika nama file memuat keyword (contoh: "fisioterapi")
            for (const kw of keywords) {
              if (fnLower.includes(kw.toLowerCase())) {
                boost += 0.30;
                break;
              }
            }

            // Boost jika isi teks memuat keyword
            let matchCount = 0;
            for (const kw of keywords) {
              if (contentLower.includes(kw.toLowerCase())) {
                matchCount++;
              }
            }
            if (matchCount > 0) {
              boost += Math.min(0.20, matchCount * 0.08);
            }

            if (boost > 0) {
              row.similarity = Math.min(0.9999, row.similarity + boost);
            }
          }

          results.sort((a, b) => b.similarity - a.similarity);
        }
      }
    } catch (err: any) {
      const isMissingOperator =
        err?.code === '42883' || (typeof err?.message === 'string' && err.message.includes('operator does not exist'));

      if (isMissingOperator) {
        // Fallback: pgvector C-extension is not installed in local PostgreSQL instance.
        // Perform fast in-memory cosine similarity calculation from stored embedding vectors.
        try {
          const fbCtx = { params: [batchId] };
          const fbAbacFilter = appendAbacClause(fbCtx, options);
          const fallbackSql = `
            SELECT
              c.id,
              c.upload_batch_id AS "uploadBatchId",
              b.original_filename AS "originalFilename",
              c.chunk_index AS "chunkIndex",
              c.content,
              c.source_page_start AS "sourcePageStart",
              c.source_page_end AS "sourcePageEnd",
              COALESCE(b.classification, 'Internal') AS classification,
              COALESCE(b.version, '1.0') AS version,
              c.embedding
            FROM document_chunks c
            JOIN upload_batches b ON b.id = c.upload_batch_id
            WHERE ($1::uuid IS NULL OR c.upload_batch_id = $1)
              ${activeCondition}
              ${fbAbacFilter}
              AND c.embedding IS NOT NULL
            LIMIT 250;
          `;
          const fallbackRes = await pool.query(fallbackSql, fbCtx.params);
          const minSim = options?.minSimilarity !== undefined ? options.minSimilarity : 0.20;

          for (const row of fallbackRes.rows) {
            if (row.embedding) {
              try {
                let parsed: number[] | null = null;
                if (Array.isArray(row.embedding)) {
                  parsed = row.embedding;
                } else if (typeof row.embedding === 'string') {
                  const trimmed = row.embedding.trim();
                  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    parsed = JSON.parse(trimmed);
                  }
                }
                if (parsed && parsed.length === queryEmbedding.length) {
                  const sim = cosineSimilarity(queryEmbedding, parsed);
                  if (sim >= minSim) {
                    results.push({
                      id: row.id,
                      uploadBatchId: row.uploadBatchId,
                      originalFilename: row.originalFilename,
                      chunkIndex: row.chunkIndex,
                      content: row.content,
                      sourcePageStart: row.sourcePageStart,
                      sourcePageEnd: row.sourcePageEnd,
                      classification: row.classification,
                      version: row.version,
                      similarity: sim,
                    });
                    seenIds.add(row.id);
                  }
                }
              } catch {
                // skip unparseable
              }
            }
          }
          results.sort((a, b) => b.similarity - a.similarity);
          if (results.length > limit) {
            results.splice(limit);
          }
        } catch {
          // quiet fallback
        }
      } else {
        console.warn('[VectorStore] searchSimilarChunks vector search warning:', err?.message || err);
      }
    }
  }

  // 2. Sparse / Keyword Search (Hybrid Fallback / Augmentation)
  if (options?.textQuery && results.length < limit) {
    try {
      const keywords = extractKeywords(options.textQuery);
      if (keywords.length > 0) {
        const keywordLikes = keywords.map((kw) => `%${kw}%`);
        const orClauses = keywordLikes.map((_, i) => `c.content ILIKE $${i + 3}`).join(' OR ');
        const remainingLimit = limit - results.length;

        const kwCtx = { params: [batchId, remainingLimit, ...keywordLikes] };
        const kwAbacFilter = appendAbacClause(kwCtx, options);

        const kwSql = `
          SELECT
            c.id,
            c.upload_batch_id AS "uploadBatchId",
            b.original_filename AS "originalFilename",
            c.chunk_index AS "chunkIndex",
            c.content,
            c.source_page_start AS "sourcePageStart",
            c.source_page_end AS "sourcePageEnd",
            COALESCE(b.classification, 'Internal') AS classification,
            COALESCE(b.version, '1.0') AS version,
            0.88 AS similarity
          FROM document_chunks c
          JOIN upload_batches b ON b.id = c.upload_batch_id
          WHERE ($1::uuid IS NULL OR c.upload_batch_id = $1)
            ${activeCondition}
            ${kwAbacFilter}
            AND (${orClauses})
          ORDER BY c.chunk_index ASC
          LIMIT $2;
        `;

        const kwRes = await pool.query<SimilarChunkResult>(kwSql, kwCtx.params);
        for (const row of (kwRes?.rows || [])) {
          if (!seenIds.has(row.id)) {
            row.similarity = Number(row.similarity) || 0.88;
            results.push(row);
            seenIds.add(row.id);
          }
        }
      }
    } catch (err) {
      console.warn('[VectorStore] searchSimilarChunks keyword search warning:', err);
    }
  }

  // 3. Exact Query Fallback: If still 0 results and textQuery is provided
  if (results.length === 0 && options?.textQuery) {
    const cleanQ = options.textQuery.replace(/[^\w\s]/g, '').trim();
    if (cleanQ.length >= 3 && cleanQ.length <= 60) {
      try {
        const exCtx = { params: [batchId, limit, `%${cleanQ}%`] };
        const exAbacFilter = appendAbacClause(exCtx, options);

        const fallbackSql = `
          SELECT
            c.id,
            c.upload_batch_id AS "uploadBatchId",
            b.original_filename AS "originalFilename",
            c.chunk_index AS "chunkIndex",
            c.content,
            c.source_page_start AS "sourcePageStart",
            c.source_page_end AS "sourcePageEnd",
            COALESCE(b.classification, 'Internal') AS classification,
            COALESCE(b.version, '1.0') AS version,
            0.80 AS similarity
          FROM document_chunks c
          JOIN upload_batches b ON b.id = c.upload_batch_id
          WHERE ($1::uuid IS NULL OR c.upload_batch_id = $1)
            ${activeCondition}
            ${exAbacFilter}
            AND c.content ILIKE $3
          ORDER BY c.chunk_index ASC
          LIMIT $2;
        `;
        const fbRes = await pool.query<SimilarChunkResult>(fallbackSql, exCtx.params);
        for (const row of (fbRes?.rows || [])) {
          if (!seenIds.has(row.id)) {
            row.similarity = Number(row.similarity) || 0.80;
            results.push(row);
            seenIds.add(row.id);
          }
        }
      } catch (err) {
        console.warn('[VectorStore] searchSimilarChunks fallback warning:', err);
      }
    }
  }

  return results;
}

export interface SimilarCuratedResult {
  id: number | string;
  uploadBatchId: string;
  originalFilename: string;
  title: string;
  content: string;
  importance: string;
  category: string;
  tags: string[];
  sourcePages: string;
  similarity: number;
}

/**
 * Searches for relevant curated insights based on cosine distance of embeddings and keyword matches.
 */
export async function searchSimilarCuratedInsights(
  queryEmbedding: number[],
  options?: SearchOptions
): Promise<SimilarCuratedResult[]> {
  if ((!queryEmbedding || queryEmbedding.length === 0) && !options?.textQuery) {
    return [];
  }

  const pool = getPool();
  const limit = options?.limit ?? 5;
  const batchId = options?.batchId || null;
  const activeCondition = options?.onlyActiveKnowledge
    ? "AND COALESCE(b.is_active_knowledge, false) = true AND (b.status IS NULL OR b.status = 'Aktif')"
    : '';

  const results: SimilarCuratedResult[] = [];
  const seenIds = new Set<string | number>();

  // 1. Vector Search (if queryEmbedding provided)
  if (queryEmbedding && queryEmbedding.length > 0) {
    try {
      const vectorString = `[${queryEmbedding.join(',')}]`;
      const ctx = { params: [vectorString, batchId, limit] };
      const abacFilter = appendAbacClause(ctx, options);

      const sql = `
        SELECT
          ci.id,
          ci.upload_batch_id AS "uploadBatchId",
          b.original_filename AS "originalFilename",
          ci.title,
          ci.content,
          ci.importance,
          ci.category,
          ci.tags,
          ci.source_pages AS "sourcePages",
          (1 - (ci.embedding <=> $1::vector)) AS similarity
        FROM curated_insights ci
        JOIN upload_batches b ON b.id = ci.upload_batch_id
        WHERE ($2::uuid IS NULL OR ci.upload_batch_id = $2)
          ${activeCondition}
          ${abacFilter}
          AND ci.embedding IS NOT NULL
        ORDER BY ci.embedding <=> $1::vector ASC
        LIMIT $3;
      `;

      const result = await pool.query<SimilarCuratedResult>(sql, ctx.params);
      const minSim = options?.minSimilarity !== undefined ? options.minSimilarity : 0.20;

      for (const row of (result?.rows || [])) {
        const rawSim = typeof row.similarity === 'number' ? row.similarity : parseFloat(String(row.similarity));
        const sim = isNaN(rawSim) ? 0 : rawSim;
        if (sim >= minSim) {
          row.similarity = sim;
          results.push(row);
          seenIds.add(row.id);
        }
      }

      // Hybrid Re-ranking: Boost skor jika judul / konten / nama file memuat keyword pertanyaan
      if (options?.textQuery && results.length > 0) {
        const keywords = extractKeywords(options.textQuery);
        if (keywords.length > 0) {
          for (const row of results) {
            let boost = 0;
            const fnLower = (row.originalFilename || '').toLowerCase();
            const titleLower = (row.title || '').toLowerCase();
            const contentLower = (row.content || '').toLowerCase();

            for (const kw of keywords) {
              if (fnLower.includes(kw.toLowerCase()) || titleLower.includes(kw.toLowerCase())) {
                boost += 0.30;
                break;
              }
            }

            let matchCount = 0;
            for (const kw of keywords) {
              if (contentLower.includes(kw.toLowerCase())) {
                matchCount++;
              }
            }
            if (matchCount > 0) {
              boost += Math.min(0.20, matchCount * 0.08);
            }

            if (boost > 0) {
              row.similarity = Math.min(0.9999, row.similarity + boost);
            }
          }

          results.sort((a, b) => b.similarity - a.similarity);
        }
      }
    } catch (err: any) {
      const isMissingOperator =
        err?.code === '42883' || (typeof err?.message === 'string' && err.message.includes('operator does not exist'));

      if (isMissingOperator) {
        try {
          const fbCtx = { params: [batchId] };
          const fbAbacFilter = appendAbacClause(fbCtx, options);

          const fallbackSql = `
            SELECT
              ci.id,
              ci.upload_batch_id AS "uploadBatchId",
              b.original_filename AS "originalFilename",
              ci.title,
              ci.content,
              ci.importance,
              ci.category,
              ci.tags,
              ci.source_pages AS "sourcePages",
              ci.embedding
            FROM curated_insights ci
            JOIN upload_batches b ON b.id = ci.upload_batch_id
            WHERE ($1::uuid IS NULL OR ci.upload_batch_id = $1)
              ${activeCondition}
              ${fbAbacFilter}
              AND ci.embedding IS NOT NULL
            LIMIT 150;
          `;
          const res = await pool.query(fallbackSql, fbCtx.params);
          const minSim = options?.minSimilarity !== undefined ? options.minSimilarity : 0.20;

          for (const row of res.rows) {
            if (row.embedding) {
              try {
                let parsed: number[] | null = null;
                if (Array.isArray(row.embedding)) {
                  parsed = row.embedding;
                } else if (typeof row.embedding === 'string') {
                  const trimmed = row.embedding.trim();
                  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    parsed = JSON.parse(trimmed);
                  }
                }
                if (parsed && parsed.length === queryEmbedding.length) {
                  const sim = cosineSimilarity(queryEmbedding, parsed);
                  if (sim >= minSim) {
                    results.push({
                      id: row.id,
                      uploadBatchId: row.uploadBatchId,
                      originalFilename: row.originalFilename,
                      title: row.title,
                      content: row.content,
                      importance: row.importance,
                      category: row.category,
                      tags: row.tags,
                      sourcePages: row.sourcePages,
                      similarity: sim,
                    });
                    seenIds.add(row.id);
                  }
                }
              } catch {
                // skip unparseable
              }
            }
          }
          results.sort((a, b) => b.similarity - a.similarity);
          if (results.length > limit) {
            results.splice(limit);
          }
        } catch {
          // quiet fallback
        }
      } else {
        console.warn('[VectorStore] searchSimilarCuratedInsights vector warning:', err?.message || err);
      }
    }
  }

  // 2. Keyword Search on Curated Insights (searches title, content, category)
  if (options?.textQuery && results.length < limit) {
    try {
      const keywords = extractKeywords(options.textQuery);
      if (keywords.length > 0) {
        const keywordLikes = keywords.map((kw) => `%${kw}%`);
        const remainingLimit = limit - results.length;
        const kwCtx = { params: [batchId, remainingLimit] };
        const kwAbacFilter = appendAbacClause(kwCtx, options);
        const orClauses = keywordLikes
          .map((kw) => {
            kwCtx.params.push(kw);
            const pIdx = kwCtx.params.length;
            return `(ci.title ILIKE $${pIdx} OR ci.content ILIKE $${pIdx} OR ci.category ILIKE $${pIdx})`;
          })
          .join(' OR ');

        const kwSql = `
          SELECT
            ci.id,
            ci.upload_batch_id AS "uploadBatchId",
            b.original_filename AS "originalFilename",
            ci.title,
            ci.content,
            ci.importance,
            ci.category,
            ci.tags,
            ci.source_pages AS "sourcePages",
            0.92 AS similarity
          FROM curated_insights ci
          JOIN upload_batches b ON b.id = ci.upload_batch_id
          WHERE ($1::uuid IS NULL OR ci.upload_batch_id = $1)
            ${activeCondition}
            ${kwAbacFilter}
            AND (${orClauses})
          ORDER BY
            CASE ci.importance
              WHEN 'high' THEN 1
              WHEN 'medium' THEN 2
              WHEN 'low' THEN 3
              ELSE 4
            END ASC,
            ci.id ASC
          LIMIT $2;
        `;

        const kwRes = await pool.query<SimilarCuratedResult>(kwSql, kwCtx.params);
        for (const row of (kwRes?.rows || [])) {
          if (!seenIds.has(row.id)) {
            row.similarity = Number(row.similarity) || 0.92;
            results.push(row);
            seenIds.add(row.id);
          }
        }
      }
    } catch (err) {
      console.warn('[VectorStore] searchSimilarCuratedInsights keyword warning:', err);
    }
  }

  return results;
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
 * If an insight with the same (upload_batch_id, source_chunk_id) already exists,
 * it updates the existing record instead of creating a duplicate.
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

      // Upsert check: prevent race condition duplicates for the same source chunk
      if (sourceChunkId !== null && sourceChunkId !== undefined) {
        const existing = await client.query<CuratedInsight>(
          `SELECT id FROM curated_insights WHERE upload_batch_id = $1 AND source_chunk_id = $2 ORDER BY id DESC LIMIT 1`,
          [batchId, sourceChunkId]
        );
        if (existing.rows.length > 0) {
          const updateSql = `
            UPDATE curated_insights
            SET title = $1, content = $2, importance = $3, category = $4, tags = $5, source_pages = $6, embedding = COALESCE($7::vector, embedding)
            WHERE id = $8
            RETURNING *;
          `;
          const updatedRes = await client.query<CuratedInsight>(updateSql, [
            item.title,
            item.content,
            importance,
            category,
            tags,
            sourcePages,
            embedding,
            existing.rows[0].id,
          ]);
          inserted.push(updatedRes.rows[0]);
          continue;
        }
      }

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
 * Deduplicates curated_insights in database by removing duplicate rows
 * keeping newest records while ensuring exact duplicate content is removed.
 */
export async function deduplicateCuratedInsights(batchId?: string): Promise<number> {
  const pool = getPool();
  try {
    const sql = `
      DELETE FROM curated_insights
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY upload_batch_id, source_chunk_id, LOWER(TRIM(title)), MD5(TRIM(content))
            ORDER BY id DESC
          ) as rnum
          FROM curated_insights
          WHERE 1 = 1
            ${batchId ? 'AND upload_batch_id = $1' : ''}
        ) t
        WHERE t.rnum > 1
      );
    `;
    const res = await pool.query(sql, batchId ? [batchId] : []);
    return res.rowCount || 0;
  } catch (err) {
    console.warn('[VectorStore] deduplicateCuratedInsights warning:', err);
    return 0;
  }
}

/**
 * Lists all curated insights for a specific batch ID, ordered by importance and created_at.
 * Guarantees that exact identical duplicate insights are filtered out.
 */
export async function listCuratedInsights(batchId: string): Promise<CuratedInsight[]> {
  const pool = getPool();
  const sql = `
    WITH ranked_insights AS (
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
        created_at,
        ROW_NUMBER() OVER (
          PARTITION BY upload_batch_id, LOWER(TRIM(title)), MD5(TRIM(content))
          ORDER BY id DESC
        ) as rn
      FROM curated_insights
      WHERE upload_batch_id = $1
    )
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
    FROM ranked_insights
    WHERE rn = 1
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

/**
 * Creates a manual curated insight for a batch and returns the created insight.
 */
export async function createManualCuratedInsight(
  batchId: string,
  insight: {
    title: string;
    content: string;
    importance?: string;
    category?: string;
    tags?: string[];
    sourcePages?: string;
    embedding?: number[];
  }
): Promise<CuratedInsight> {
  const pool = getPool();
  const importance = insight.importance || 'medium';
  const category = insight.category || 'track1_financial';
  const tags = insight.tags || [];
  const sourcePages = insight.sourcePages || '';
  const embedding = insight.embedding ? `[${insight.embedding.join(',')}]` : null;

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
    VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8::vector)
    RETURNING *;
  `;

  const res = await pool.query<CuratedInsight>(sql, [
    batchId,
    insight.title,
    insight.content,
    importance,
    category,
    tags,
    sourcePages,
    embedding,
  ]);
  return res.rows[0];
}

/**
 * Deletes a curated insight by ID.
 * If deleting this insight causes the document's total curated insight count to reach 0,
 * the document is automatically deactivated (is_active_knowledge = false, status = 'Menunggu Kurasi')
 * to strictly enforce that documents with 0 insights cannot be active for AI grounding.
 */
export async function deleteCuratedInsight(
  insightId: number | string
): Promise<{ deleted: boolean; batchId: string; remainingCount: number; wasDeactivated: boolean }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const delRes = await client.query<{ upload_batch_id: string }>(
      `DELETE FROM curated_insights WHERE id = $1 RETURNING upload_batch_id;`,
      [insightId]
    );

    if ((delRes.rowCount ?? 0) === 0) {
      await client.query('ROLLBACK');
      return { deleted: false, batchId: '', remainingCount: 0, wasDeactivated: false };
    }

    const batchId = delRes.rows[0].upload_batch_id;

    // Hitung sisa insight untuk batch ini
    const countRes = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM curated_insights WHERE upload_batch_id = $1;`,
      [batchId]
    );
    const remainingCount = countRes?.rows?.[0]?.count ?? 0;
    let wasDeactivated = false;

    // Aturan Otomatis: Jika insight tersisa 0, dokumen WAJIB nonaktif dan status kembali 'Menunggu Kurasi'
    if (remainingCount === 0) {
      await client.query(
        `UPDATE upload_batches
         SET is_active_knowledge = false, status = 'Menunggu Kurasi'
         WHERE id = $1;`,
        [batchId]
      );
      wasDeactivated = true;
    }

    await client.query('COMMIT');
    return { deleted: true, batchId, remainingCount, wasDeactivated };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}


