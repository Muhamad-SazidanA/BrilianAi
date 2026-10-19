import { getPool } from './dbClient';
import { ChatSession, ChatMessage } from '@/types/chat';
import { generateSessionTitle } from '@lib/chat/sessionTitleHelper';
import { ensureCompleteDatabaseSchema } from './autoMigration';

function rowToSession(row: Record<string, any>): ChatSession {
  let parsedMessages: ChatMessage[] = [];
  if (Array.isArray(row.messages)) {
    parsedMessages = row.messages;
  } else if (typeof row.messages === 'string') {
    try {
      const parsed = JSON.parse(row.messages);
      parsedMessages = Array.isArray(parsed) ? parsed : [];
    } catch {
      parsedMessages = [];
    }
  }

  return {
    id: String(row.id),
    user_id: row.user_id ? String(row.user_id) : '',
    title: row.title || 'Percakapan Tanpa Judul',
    is_pinned: Boolean(row.is_pinned),
    last_shared_message_id: row.last_shared_message_id || null,
    messages: parsedMessages,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at || new Date().toISOString()),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : (row.updated_at || new Date().toISOString()),
  };
}

/**
 * Buat sesi chat baru untuk user.
 */
export async function createChatSession(
  userId: string,
  messages: ChatMessage[],
  title: string = generateSessionTitle(messages.find((message) => message.sender === 'user')?.text || 'Chat Baru')
): Promise<ChatSession> {
  await ensureCompleteDatabaseSchema().catch(() => {});
  const pool = getPool();
  const res = await pool.query(
    `INSERT INTO chat_sessions (user_id, title, messages) VALUES ($1, $2, $3::jsonb) RETURNING *`,
    [userId, title, JSON.stringify(messages)]
  );
  return rowToSession(res.rows[0]);
}

/**
 * Ambil satu sesi chat berdasarkan ID (hanya jika milik userId atau user adalah admin).
 */
export async function getChatSession(
  sessionId: string,
  userId?: string,
  isAdmin: boolean = false
): Promise<ChatSession | null> {
  await ensureCompleteDatabaseSchema().catch(() => {});
  const pool = getPool();

  let res;
  if (isAdmin || !userId) {
    res = await pool.query(
      `SELECT * FROM chat_sessions WHERE id = $1 LIMIT 1`,
      [sessionId]
    );
  } else {
    res = await pool.query(
      `SELECT * FROM chat_sessions WHERE id = $1 AND (user_id = $2 OR user_id IS NULL) LIMIT 1`,
      [sessionId, userId]
    );
  }
  if (!res.rows[0]) return null;
  return rowToSession(res.rows[0]);
}

/**
 * Daftar sesi chat terbaru milik user (pinned dahulu, lalu terbaru).
 * Jika isAdmin = true, dapat mengambil semua sesi atau filter per user.
 */
export async function listUserChatSessions(
  userId: string,
  limit: number = 30,
  isAdmin: boolean = false
): Promise<ChatSession[]> {
  await ensureCompleteDatabaseSchema().catch(() => {});
  const pool = getPool();

  let res;
  if (isAdmin) {
    res = await pool.query(
      `SELECT id, user_id, title, is_pinned, created_at, updated_at, '[]'::jsonb AS messages
       FROM chat_sessions
       WHERE user_id = $1 OR user_id IS NULL
       ORDER BY is_pinned DESC, updated_at DESC
       LIMIT $2`,
      [userId, limit]
    );
  } else {
    res = await pool.query(
      `SELECT id, user_id, title, is_pinned, created_at, updated_at, '[]'::jsonb AS messages
       FROM chat_sessions
       WHERE user_id = $1
       ORDER BY is_pinned DESC, updated_at DESC
       LIMIT $2`,
      [userId, limit]
    );
  }
  return res.rows.map(rowToSession);
}

export interface UpdateChatSessionInput {
  title?: string;
  messages?: ChatMessage[];
  is_pinned?: boolean;
}

/**
 * Update sesi chat (title, messages, atau pin status).
 */
export async function updateChatSession(
  sessionId: string,
  userId: string,
  updates: UpdateChatSessionInput,
  isAdmin: boolean = false
): Promise<ChatSession | null> {
  await ensureCompleteDatabaseSchema().catch(() => {});
  const pool = getPool();

  const setClauses: string[] = ['updated_at = now()'];
  const params: any[] = [];
  let idx = 1;

  if (updates.title !== undefined) {
    setClauses.push(`title = $${idx++}`);
    params.push(updates.title.slice(0, 200));
  }
  if (updates.messages !== undefined) {
    setClauses.push(`messages = $${idx++}::jsonb`);
    params.push(JSON.stringify(updates.messages));
  }
  if (updates.is_pinned !== undefined) {
    setClauses.push(`is_pinned = $${idx++}`);
    params.push(updates.is_pinned);
  }

  params.push(sessionId);
  let whereClause = `WHERE id = $${idx++}`;
  if (!isAdmin) {
    params.push(userId);
    whereClause += ` AND (user_id = $${idx++} OR user_id IS NULL)`;
  }

  const res = await pool.query(
    `UPDATE chat_sessions SET ${setClauses.join(', ')}
     ${whereClause}
     RETURNING *`,
    params
  );
  if (!res.rows[0]) return null;
  return rowToSession(res.rows[0]);
}

/**
 * Hapus sesi chat (hard delete — jika milik userId atau admin).
 */
export async function deleteChatSession(
  sessionId: string,
  userId: string,
  isAdmin: boolean = false
): Promise<boolean> {
  await ensureCompleteDatabaseSchema().catch(() => {});
  const pool = getPool();
  let res;
  if (isAdmin) {
    res = await pool.query(
      `DELETE FROM chat_sessions WHERE id = $1 RETURNING id`,
      [sessionId]
    );
  } else {
    res = await pool.query(
      `DELETE FROM chat_sessions WHERE id = $1 AND (user_id = $2 OR user_id IS NULL) RETURNING id`,
      [sessionId, userId]
    );
  }
  return (res.rowCount ?? 0) > 0;
}

