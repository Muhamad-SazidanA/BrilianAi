import { getPool } from './dbClient';

export interface KnowledgeGap {
  id: number | string;
  query_text: string;
  user_id?: string | null;
  division_id?: string;
  frequency: number;
  status: 'open' | 'in_progress' | 'resolved' | 'ignored';
  resolved_by?: string | null;
  resolution_note?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface AnswerFeedback {
  id: number | string;
  session_id?: string | null;
  user_id?: string | null;
  query_text: string;
  answer_text: string;
  rating: 'helpful' | 'incorrect' | 'outdated';
  feedback_text?: string | null;
  created_at: Date | string;
}

/**
 * Mencatat pertanyaan yang gagal dijawab oleh AI (B2, F3) ke tabel knowledge_gaps.
 * Jika pertanyaan serupa sudah tercatat dan masih 'open', frekuensi diincrement.
 */
export async function logKnowledgeGap(
  queryText: string,
  options?: { userId?: string; divisionId?: string }
): Promise<void> {
  const cleanQuery = (queryText || '').trim();
  if (!cleanQuery) return;

  const pool = getPool();
  try {
    const existing = await pool.query(
      `SELECT id, frequency FROM knowledge_gaps 
       WHERE LOWER(TRIM(query_text)) = LOWER(TRIM($1)) AND status = 'open' 
       LIMIT 1`,
      [cleanQuery]
    );

    if (existing?.rows && existing.rows.length > 0) {
      await pool.query(
        `UPDATE knowledge_gaps 
         SET frequency = frequency + 1, updated_at = now() 
         WHERE id = $1`,
        [existing.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO knowledge_gaps (query_text, user_id, division_id, frequency, status)
         VALUES ($1, $2, $3, 1, 'open')`,
        [cleanQuery, options?.userId || null, options?.divisionId || 'General']
      );
    }
  } catch (err) {
    console.warn('[KnowledgeGapStore] Failed to log knowledge gap:', err);
  }
}

/**
 * Mengambil daftar kesenjangan pengetahuan yang belum terisi (F3).
 */
export async function listKnowledgeGaps(options?: {
  status?: string;
  limit?: number;
}): Promise<KnowledgeGap[]> {
  const pool = getPool();
  const status = options?.status || 'open';
  const limit = options?.limit ?? 50;

  try {
    const res = await pool.query<KnowledgeGap>(
      `SELECT id, query_text, user_id, division_id, frequency, status, resolved_by, resolution_note, created_at, updated_at
       FROM knowledge_gaps
       WHERE ($1 = 'all' OR status = $1)
       ORDER BY frequency DESC, updated_at DESC
       LIMIT $2`,
      [status, limit]
    );
    return res.rows;
  } catch (err) {
    console.warn('[KnowledgeGapStore] listKnowledgeGaps error:', err);
    return [];
  }
}

/**
 * Menyimpan umpan balik pengguna atas jawaban AI (B8).
 */
export async function saveAnswerFeedback(params: {
  sessionId?: string;
  userId?: string;
  queryText: string;
  answerText: string;
  rating: 'helpful' | 'incorrect' | 'outdated';
  feedbackText?: string;
}): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(
      `INSERT INTO answer_feedback (session_id, user_id, query_text, answer_text, rating, feedback_text)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        params.sessionId || null,
        params.userId || null,
        params.queryText,
        params.answerText,
        params.rating,
        params.feedbackText || null,
      ]
    );
  } catch (err) {
    console.warn('[KnowledgeGapStore] saveAnswerFeedback error:', err);
  }
}

/**
 * Memperbarui status kesenjangan pengetahuan (resolve / ignore / in_progress).
 */
export async function resolveKnowledgeGap(params: {
  id: number | string;
  status: 'resolved' | 'ignored' | 'in_progress' | 'open';
  resolvedBy?: string;
  resolutionNote?: string;
}): Promise<boolean> {
  const pool = getPool();
  try {
    const res = await pool.query(
      `UPDATE knowledge_gaps
       SET status = $1, resolved_by = $2, resolution_note = $3, updated_at = now()
       WHERE id = $4`,
      [params.status, params.resolvedBy || null, params.resolutionNote || null, params.id]
    );
    return (res.rowCount ?? 0) > 0;
  } catch (err) {
    console.warn('[KnowledgeGapStore] resolveKnowledgeGap error:', err);
    return false;
  }
}

/**
 * Mengambil ringkasan statistik kesenjangan pengetahuan.
 */
export async function getKnowledgeGapStats(): Promise<{
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
}> {
  const pool = getPool();
  try {
    const res = await pool.query(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN status = 'open' THEN 1 END)::int as open,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END)::int as in_progress,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END)::int as resolved
      FROM knowledge_gaps
    `);
    const row = res.rows[0];
    return {
      total: row?.total || 0,
      open: row?.open || 0,
      inProgress: row?.in_progress || 0,
      resolved: row?.resolved || 0,
    };
  } catch (err) {
    console.warn('[KnowledgeGapStore] getKnowledgeGapStats error:', err);
    return { total: 0, open: 0, inProgress: 0, resolved: 0 };
  }
}

