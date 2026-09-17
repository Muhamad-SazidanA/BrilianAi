import { getPool } from './dbClient';
import { ChatSession, ChatMessage } from '@/types/chat';
import { generateSessionTitle } from '@lib/chat/sessionTitleHelper';

function rowToSession(row: Record<string, any>): ChatSession {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    is_pinned: row.is_pinned,
    last_shared_message_id: row.last_shared_message_id || null,
    messages: Array.isArray(row.messages) ? row.messages : [],
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
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
  const pool = getPool();
  const res = await pool.query(
    `INSERT INTO chat_sessions (user_id, title, messages) VALUES ($1, $2, $3::jsonb) RETURNING *`,
    [userId, title, JSON.stringify(messages)]
  );
  return rowToSession(res.rows[0]);
}

/**
 * Ambil satu sesi chat berdasarkan ID (hanya jika milik userId).
 */
export async function getChatSession(
  sessionId: string,
  userId: string
): Promise<ChatSession | null> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [sessionId, userId]
  );
  if (!res.rows[0]) return null;
  return rowToSession(res.rows[0]);
}

/**
 * Daftar sesi chat terbaru milik user (pinned dahulu, lalu terbaru).
 */
export async function listUserChatSessions(
  userId: string,
  limit: number = 30
): Promise<ChatSession[]> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT id, user_id, title, is_pinned, created_at, updated_at, '[]'::jsonb AS messages
     FROM chat_sessions
     WHERE user_id = $1
     ORDER BY is_pinned DESC, updated_at DESC
     LIMIT $2`,
    [userId, limit]
  );
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
  updates: UpdateChatSessionInput
): Promise<ChatSession | null> {
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
  params.push(userId);

  const res = await pool.query(
    `UPDATE chat_sessions SET ${setClauses.join(', ')}
     WHERE id = $${idx++} AND user_id = $${idx++}
     RETURNING *`,
    params
  );
  if (!res.rows[0]) return null;
  return rowToSession(res.rows[0]);
}

/**
 * Hapus sesi chat (hard delete — hanya jika milik userId).
 */
export async function deleteChatSession(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const pool = getPool();
  const res = await pool.query(
    `DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2 RETURNING id`,
    [sessionId, userId]
  );
  return (res.rowCount ?? 0) > 0;
}
