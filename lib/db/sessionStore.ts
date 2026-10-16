import crypto from 'crypto';
import { getPool } from './dbClient';
import { User } from '@/types/user';

let isSessionTableInitialized = false;

export function _resetSessionTableInitializedForTesting(): void {
  isSessionTableInitialized = false;
}

/**
 * Memastikan tabel user_sessions ada di PostgreSQL.
 */
export async function ensureSessionsTable(): Promise<void> {
  if (isSessionTableInitialized) return;

  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_token VARCHAR(255) UNIQUE NOT NULL,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          user_agent TEXT,
          ip_address VARCHAR(45),
          expires_at TIMESTAMPTZ NOT NULL,
          revoked_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions (session_token);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions (expires_at);
    `);
    isSessionTableInitialized = true;
  } catch (err) {
    console.warn('[SessionStore] ensureSessionsTable warning:', err);
  }
}

/**
 * Membuat sesi database baru dengan cryptographically secure token.
 *
 * @param userId - ID user yang login
 * @param userAgent - User agent client browser
 * @param ipAddress - IP address client
 * @param expiresInDays - Masa berlaku sesi (default 30 hari)
 * @returns sessionToken - Token 64-karakter hex unik
 */
export async function createSession(
  userId: string,
  userAgent?: string,
  ipAddress?: string,
  expiresInDays = 30
): Promise<string> {
  await ensureSessionsTable();
  const pool = getPool();

  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO user_sessions (session_token, user_id, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [sessionToken, userId, userAgent || null, ipAddress || null, expiresAt]
  );

  return sessionToken;
}

/**
 * Memvalidasi session token dan mengembalikan data User lengkap beserta Role.
 */
export async function validateSession(sessionToken: string): Promise<User | null> {
  if (!sessionToken || typeof sessionToken !== 'string' || sessionToken.length < 32) {
    return null;
  }

  await ensureSessionsTable();
  const pool = getPool();

  const query = `
    SELECT 
      u.id, u.name, u.email, u.role_id, u.status, u.department, u.avatar_color,
      u.last_login_at, u.created_at, u.updated_at,
      r.name as role_name, r.description as role_desc, r.is_system as role_is_system, r.permissions as role_permissions,
      s.id as session_id, s.expires_at, s.revoked_at
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE s.session_token = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
    LIMIT 1;
  `;

  const res = await pool.query(query, [sessionToken]);
  if (!res.rows || res.rows.length === 0) {
    return null;
  }

  const row = res.rows[0];
  if (row.status !== 'active') {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role_id: row.role_id,
    status: row.status,
    department: row.department,
    avatar_color: row.avatar_color,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    role: {
      id: row.role_id,
      name: row.role_name || row.role_id,
      description: row.role_desc || '',
      is_system: row.role_is_system ?? true,
      permissions: Array.isArray(row.role_permissions) ? row.role_permissions : [],
    },
  };
}

/**
 * Mencabut (revoke) satu sesi spesifik (misalnya saat logout).
 */
export async function revokeSession(sessionToken: string): Promise<void> {
  if (!sessionToken) return;
  await ensureSessionsTable();
  const pool = getPool();
  await pool.query(
    `UPDATE user_sessions SET revoked_at = now() WHERE session_token = $1`,
    [sessionToken]
  );
}

/**
 * Mencabut semua sesi aktif dari seorang user (misalnya saat ganti password atau suspend akun).
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  if (!userId) return;
  await ensureSessionsTable();
  const pool = getPool();
  await pool.query(
    `UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}
