import { getPool } from './dbClient';
import { DashboardData, DashboardRecord } from '@/types/dashboard';
import { generateNanoId } from '@lib/utils/nanoid';

/**
 * Ensure the ai_dashboards table exists in database.
 */
async function ensureTableExists() {
  const pool = getPool();
  await pool.query(`
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
  `);
}

/**
 * Save a new AI dashboard snapshot to database with NanoID.
 */
export async function saveDashboard(params: {
  messageId: string;
  sessionId?: string | null;
  userId?: string | null;
  title: string;
  data: DashboardData;
  maxRetries?: number;
}): Promise<DashboardRecord> {
  await ensureTableExists();
  const pool = getPool();

  const { messageId, sessionId, userId, title, data, maxRetries = 5 } = params;

  let attempts = 0;
  let savedRecord: DashboardRecord | null = null;

  while (attempts < maxRetries) {
    const dashboardId = generateNanoId(11);
    try {
      const result = await pool.query<DashboardRecord>(
        `INSERT INTO ai_dashboards (dashboard_id, message_id, session_id, user_id, title, data)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [dashboardId, messageId, sessionId || null, userId || null, title, JSON.stringify(data)]
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
