import { getPool } from './dbClient';

export interface DocumentGrantRecord {
  id: string | number;
  upload_batch_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_department: string;
  user_role_id: string;
  access_level: 'viewer' | 'editor';
  granted_by?: string | null;
  granted_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Grants or updates document access for a specific user.
 */
export async function grantDocumentAccess(
  batchId: string,
  userId: string,
  accessLevel: 'viewer' | 'editor' = 'viewer',
  grantedBy?: string | null
): Promise<void> {
  const pool = getPool();
  const query = `
    INSERT INTO document_access_grants (upload_batch_id, user_id, access_level, granted_by, updated_at)
    VALUES ($1, $2, $3, $4, now())
    ON CONFLICT (upload_batch_id, user_id) 
    DO UPDATE SET access_level = EXCLUDED.access_level, granted_by = EXCLUDED.granted_by, updated_at = now();
  `;
  await pool.query(query, [batchId, userId, accessLevel, grantedBy || null]);
}

/**
 * Revokes document access for a specific user.
 */
export async function revokeDocumentAccess(batchId: string, userId: string): Promise<boolean> {
  const pool = getPool();
  const res = await pool.query(
    'DELETE FROM document_access_grants WHERE upload_batch_id = $1 AND user_id = $2',
    [batchId, userId]
  );
  return (res.rowCount || 0) > 0;
}

/**
 * Lists all active user grants for a specific document batch.
 */
export async function listDocumentGrants(batchId: string): Promise<DocumentGrantRecord[]> {
  const pool = getPool();
  try {
    const query = `
      SELECT 
        g.id,
        g.upload_batch_id,
        g.user_id,
        u.name AS user_name,
        u.email AS user_email,
        COALESCE(u.department, 'General') AS user_department,
        u.role_id AS user_role_id,
        g.access_level,
        g.granted_by,
        gb.name AS granted_by_name,
        g.created_at,
        g.updated_at
      FROM document_access_grants g
      JOIN users u ON u.id = g.user_id
      LEFT JOIN users gb ON gb.id = g.granted_by
      WHERE g.upload_batch_id = $1
      ORDER BY g.created_at ASC;
    `;
    const res = await pool.query(query, [batchId]);
    return res.rows.map((row) => ({
      ...row,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    }));
  } catch (err) {
    console.warn('[DocumentGrantStore] listDocumentGrants error:', err);
    return [];
  }
}

/**
 * Retrieves grant info for a single user on a specific document.
 */
export async function getUserDocumentGrant(
  batchId: string,
  userId: string
): Promise<{ access_level: 'viewer' | 'editor' } | null> {
  const pool = getPool();
  try {
    const query = `
      SELECT access_level
      FROM document_access_grants
      WHERE upload_batch_id = $1 AND user_id = $2
      LIMIT 1;
    `;
    const res = await pool.query(query, [batchId, userId]);
    return res.rows[0] || null;
  } catch {
    return null;
  }
}

/**
 * Returns all upload batch IDs that have been explicitly granted to this user.
 */
export async function listUserGrantedBatchIds(userId: string): Promise<string[]> {
  const pool = getPool();
  try {
    const query = `
      SELECT upload_batch_id
      FROM document_access_grants
      WHERE user_id = $1;
    `;
    const res = await pool.query(query, [userId]);
    return res.rows.map((r) => r.upload_batch_id);
  } catch (err) {
    console.warn('[DocumentGrantStore] listUserGrantedBatchIds error:', err);
    return [];
  }
}

/**
 * Bulk grants user permissions (useful during upload pipeline).
 */
export async function bulkGrantDocumentAccess(
  batchId: string,
  grants: Array<{ userId: string; accessLevel: 'viewer' | 'editor' }>,
  grantedBy?: string | null
): Promise<void> {
  if (!grants || grants.length === 0) return;
  for (const item of grants) {
    await grantDocumentAccess(batchId, item.userId, item.accessLevel, grantedBy);
  }
}
