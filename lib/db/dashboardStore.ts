import { getPool } from './dbClient';
import { DashboardData, DashboardRecord } from '@/types/dashboard';
import { generateNanoId } from '@lib/utils/nanoid';

let isDashboardTableInitialized = false;

export function _resetDashboardTableInitializedForTesting(): void {
  isDashboardTableInitialized = false;
}

/**
 * Ensure the ai_dashboards table exists in database (runs at most once per process).
 */
async function ensureTableExists() {
  if (isDashboardTableInitialized) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_dashboards (
        dashboard_id VARCHAR(64) PRIMARY KEY,
        message_id VARCHAR(255) NOT NULL,
        session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
        turn_index INTEGER,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL DEFAULT 'Dashboard AI',
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        views_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      ALTER TABLE ai_dashboards ADD COLUMN IF NOT EXISTS turn_index INTEGER;
      CREATE INDEX IF NOT EXISTS idx_ai_dashboards_message_id ON ai_dashboards(message_id);
      CREATE INDEX IF NOT EXISTS idx_ai_dashboards_user_id ON ai_dashboards(user_id);
      CREATE INDEX IF NOT EXISTS idx_ai_dashboards_session_turn ON ai_dashboards(session_id, turn_index);
    `);
    isDashboardTableInitialized = true;
  } catch {
    isDashboardTableInitialized = true;
  }
}

/**
 * Save a new AI dashboard snapshot to database with NanoID.
 */
export async function saveDashboard(params: {
  messageId: string;
  sessionId?: string | null;
  turnIndex?: number | null;
  userId?: string | null;
  title: string;
  data: DashboardData;
  maxRetries?: number;
}): Promise<DashboardRecord> {
  await ensureTableExists();
  const pool = getPool();

  const { messageId, sessionId, turnIndex, userId, title, data, maxRetries = 5 } = params;

  let attempts = 0;
  let savedRecord: DashboardRecord | null = null;

  while (attempts < maxRetries) {
    const dashboardId = generateNanoId(11);
    try {
      const result = await pool.query<DashboardRecord>(
        `INSERT INTO ai_dashboards (dashboard_id, message_id, session_id, turn_index, user_id, title, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [dashboardId, messageId, sessionId || null, turnIndex || null, userId || null, title, JSON.stringify(data)]
      );
      savedRecord = result.rows[0];
      break;
    } catch (err: any) {
      if (err?.code === '23505') {
        // NanoID collision — retry
        attempts++;
        continue;
      }
      throw err;
    }
  }

  if (!savedRecord) {
    throw new Error('Gagal menyimpan dashboard setelah beberapa percobaan.');
  }

  return savedRecord;
}

/**
 * Get dashboard by session ID and turn index (1-indexed).
 */
export async function getDashboardBySessionAndTurn(
  sessionId: string,
  turnIndex: number
): Promise<DashboardRecord | null> {
  await ensureTableExists();
  const pool = getPool();

  // 1. Direct query by (session_id, turn_index)
  const result = await pool.query<DashboardRecord>(
    `SELECT * FROM ai_dashboards WHERE session_id = $1 AND turn_index = $2 ORDER BY created_at DESC LIMIT 1`,
    [sessionId, turnIndex]
  );

  if (result.rows[0]) {
    await pool.query(
      `UPDATE ai_dashboards SET views_count = views_count + 1, updated_at = now() WHERE dashboard_id = $1`,
      [result.rows[0].dashboard_id]
    );
    return result.rows[0];
  }

  // 2. Fallback: map turnIndex from chat_sessions messages
  try {
    const sessionRes = await pool.query<{ messages: any[] }>(
      `SELECT messages FROM chat_sessions WHERE id = $1 LIMIT 1`,
      [sessionId]
    );
    if (sessionRes.rows[0]?.messages && Array.isArray(sessionRes.rows[0].messages)) {
      const msgs = sessionRes.rows[0].messages;
      let userCount = 0;
      let targetAssistantId: string | null = null;
      for (let i = 0; i < msgs.length; i++) {
        if (msgs[i].sender === 'user') {
          userCount++;
          if (userCount === turnIndex) {
            for (let j = i + 1; j < msgs.length; j++) {
              if (msgs[j].sender === 'assistant' || msgs[j].sender === 'ai') {
                targetAssistantId = msgs[j].id;
                break;
              }
              if (msgs[j].sender === 'user') break;
            }
            break;
          }
        }
      }

      if (targetAssistantId) {
        const fallbackRes = await pool.query<DashboardRecord>(
          `SELECT * FROM ai_dashboards WHERE message_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [targetAssistantId]
        );
        if (fallbackRes.rows[0]) {
          await pool.query(
            `UPDATE ai_dashboards SET turn_index = $1, session_id = $2, views_count = views_count + 1, updated_at = now() WHERE dashboard_id = $3`,
            [turnIndex, sessionId, fallbackRes.rows[0].dashboard_id]
          );
          fallbackRes.rows[0].turn_index = turnIndex;
          fallbackRes.rows[0].session_id = sessionId;
          return fallbackRes.rows[0];
        }
      }
    }
  } catch (err) {
    console.warn('[dashboardStore] Fallback session turn mapping warn:', err);
  }

  return null;
}

/**
 * Get dashboard by ID (public access).
 */
export async function getDashboardById(dashboardId: string): Promise<DashboardRecord | null> {
  await ensureTableExists();
  const pool = getPool();

  // Increment view count
  await pool.query(
    `UPDATE ai_dashboards SET views_count = views_count + 1, updated_at = now() WHERE dashboard_id = $1`,
    [dashboardId]
  );

  const result = await pool.query<DashboardRecord>(
    `SELECT * FROM ai_dashboards WHERE dashboard_id = $1`,
    [dashboardId]
  );

  return result.rows[0] || null;
}

/**
 * Get all dashboards for a specific user.
 */
export async function getUserDashboards(userId: string): Promise<DashboardRecord[]> {
  await ensureTableExists();
  const pool = getPool();

  const result = await pool.query<DashboardRecord>(
    `SELECT dashboard_id, message_id, session_id, user_id, title, views_count, created_at, updated_at
     FROM ai_dashboards
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  );

  return result.rows;
}

/**
 * Update existing dashboard data (e.g. after interactive AI widget morphing or editing).
 */
export async function updateDashboardData(
  dashboardId: string,
  data: DashboardData,
  title?: string
): Promise<DashboardRecord | null> {
  await ensureTableExists();
  const pool = getPool();

  const finalTitle = title || data.title;
  const result = await pool.query<DashboardRecord>(
    `UPDATE ai_dashboards
     SET data = $2,
         title = COALESCE($3, title),
         updated_at = now()
     WHERE dashboard_id = $1
     RETURNING *`,
    [dashboardId, JSON.stringify(data), finalTitle]
  );

  return result.rows[0] || null;
}

/**
 * Get latest dashboard by message ID.
 */
export async function getDashboardByMessageId(messageId: string): Promise<DashboardRecord | null> {
  await ensureTableExists();
  const pool = getPool();

  const result = await pool.query<DashboardRecord>(
    `SELECT * FROM ai_dashboards WHERE message_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [messageId]
  );

  return result.rows[0] || null;
}


export const ALLOWED_WIDGET_TYPES: Set<string> = new Set([
  'stat_card',
  'bar_chart',
  'line_chart',
  'pie_chart',
  'area_chart',
  'list',
  'table',
  'timeline',
  'comparison',
  'text_summary',
]);

export const MAX_WIDGETS = 50;

/**
 * Validates dashboard data and widgets against whitelist and constraints.
 */
export function validateDashboardPayload(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object' || !Array.isArray(data.widgets)) {
    return { valid: false, error: 'Data dashboard tidak valid atau widgets wajib berupa array.' };
  }

  if (data.widgets.length > MAX_WIDGETS) {
    return { valid: false, error: `Jumlah widget melebihi batas aman (maksimal ${MAX_WIDGETS} widget).` };
  }

  for (const w of data.widgets) {
    if (!w || typeof w !== 'object' || !ALLOWED_WIDGET_TYPES.has((w as any)?.type)) {
      return { valid: false, error: `Tipe widget "${(w as any)?.type || 'unknown'}" tidak valid atau tidak diizinkan.` };
    }
  }

  return { valid: true };
}

