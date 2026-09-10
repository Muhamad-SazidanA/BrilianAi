import { getPool } from './dbClient';
import { User, Role } from '@/types/user';

let isUserTableInitialized = false;

export function _resetUserTableInitializedForTesting(): void {
  isUserTableInitialized = false;
}

/**
 * Memastikan tabel roles dan users ada di database serta memiliki data default.
 */
export async function ensureUsersAndRolesTables(): Promise<void> {
  if (isUserTableInitialized) return;

  try {
    const pool = getPool();

    // 1. Table roles
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          is_system BOOLEAN NOT NULL DEFAULT false,
          permissions JSONB NOT NULL DEFAULT '[]',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Seed default roles
    await pool.query(`
      INSERT INTO roles (id, name, description, is_system, permissions)
      VALUES
          (
              'admin',
              'Super Administrator',
              'Akses penuh ke seluruh modul sistem, dokumen, kurasi AI, manajemen pengguna, dan audit log.',
              true,
              '["documents:read", "documents:upload", "documents:toggle_active", "documents:delete", "curation:trigger", "curation:edit", "curation:delete", "chat:query", "chat:export", "users:manage", "roles:manage", "audit:read"]'::jsonb
          ),
          (
              'editor',
              'Knowledge Manager & Editor',
              'Dapat mengunggah dokumen PDF, mengelola basis pengetahuan, menjalankan dan menyunting kurasi AI, serta bertanya ke Chatbot.',
              true,
              '["documents:read", "documents:upload", "documents:toggle_active", "curation:trigger", "curation:edit", "curation:delete", "chat:query", "chat:export"]'::jsonb
          ),
          (
              'member',
              'Member / Viewer',
              'Hak akses standar untuk membaca dokumen aktif dan bertanya pada AI Chatbot RAG.',
              true,
              '["documents:read", "chat:query", "chat:export"]'::jsonb
          )
      ON CONFLICT (id) DO NOTHING;
    `);

    // 2. Table users
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(120) NOT NULL,
          email VARCHAR(150) NOT NULL UNIQUE,
          role_id VARCHAR(50) NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT DEFAULT 'member',
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          department VARCHAR(100),
          avatar_color VARCHAR(20) DEFAULT '#2563EB',
          last_login_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
      CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
    `);

    // Seed default users if empty
    const checkUsers = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(checkUsers.rows[0].count, 10) === 0) {
      await pool.query(`
        INSERT INTO users (id, name, email, role_id, status, department, avatar_color, last_login_at)
        VALUES
            ('a0000000-0000-0000-0000-000000000001', 'Muhammad Sazidan', 'admin@brilian.ai', 'admin', 'active', 'IT & Architecture', '#2563EB', now()),
            ('a0000000-0000-0000-0000-000000000002', 'Budi Pratama', 'budi.editor@brilian.ai', 'editor', 'active', 'Clinical & Research', '#10B981', now() - INTERVAL '2 hours'),
            ('a0000000-0000-0000-0000-000000000003', 'Siti Rahmawati', 'siti.member@brilian.ai', 'member', 'active', 'Medical Staff', '#8B5CF6', now() - INTERVAL '5 hours'),
            ('a0000000-0000-0000-0000-000000000004', 'Ahmad Fauzi', 'ahmad.fauzi@brilian.ai', 'member', 'active', 'Compliance & Audit', '#F59E0B', now() - INTERVAL '1 day'),
            ('a0000000-0000-0000-0000-000000000005', 'Rian Hidayat', 'rian.inactive@brilian.ai', 'member', 'inactive', 'Internship', '#6B7280', now() - INTERVAL '7 days')
        ON CONFLICT (email) DO NOTHING;
      `);
    }

    isUserTableInitialized = true;
  } catch (err) {
    console.warn('[UserStore] ensureUsersAndRolesTables warning:', err);
  }
}

/**
 * Mengambil daftar seluruh pengguna dengan filter opsional dan hitungan pertanyaan chat.
 */
export async function listUsers(options?: {
  search?: string;
  roleId?: string;
  status?: string;
}): Promise<User[]> {
  await ensureUsersAndRolesTables();
  const pool = getPool();

  let queryText = `
    SELECT 
      u.id,
      u.name,
      u.email,
      u.role_id,
      u.status,
      u.department,
      u.avatar_color,
      u.last_login_at,
      u.created_at,
      u.updated_at,
      r.name as role_name,
      r.description as role_desc,
      r.is_system as role_is_system,
      r.permissions as role_permissions,
      COALESCE(log_agg.question_count, 0) as question_count
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) as question_count
      FROM chat_audit_logs
      GROUP BY user_id
    ) log_agg ON u.id = log_agg.user_id
    WHERE 1=1
  `;

  const params: any[] = [];
  let paramIdx = 1;

  if (options?.search) {
    queryText += ` AND (u.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR u.department ILIKE $${paramIdx})`;
    params.push(`%${options.search}%`);
    paramIdx++;
  }

  if (options?.roleId && options.roleId !== 'all') {
    queryText += ` AND u.role_id = $${paramIdx}`;
    params.push(options.roleId);
    paramIdx++;
  }

  if (options?.status && options.status !== 'all') {
    queryText += ` AND u.status = $${paramIdx}`;
    params.push(options.status);
    paramIdx++;
  }

  queryText += ` ORDER BY u.created_at ASC`;

  const res = await pool.query(queryText, params);

  return res.rows.map((row) => ({
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
    question_count: parseInt(row.question_count, 10) || 0,
    role: {
      id: row.role_id,
      name: row.role_name || row.role_id,
      description: row.role_desc || '',
      is_system: row.role_is_system ?? true,
      permissions: Array.isArray(row.role_permissions) ? row.role_permissions : [],
    },
  }));
}

/**
 * Mengambil satu user berdasarkan ID.
 */
export async function getUserById(id: string): Promise<User | null> {
  await ensureUsersAndRolesTables();
  const pool = getPool();

  const res = await pool.query(
    `
    SELECT 
      u.id, u.name, u.email, u.role_id, u.status, u.department, u.avatar_color,
      u.last_login_at, u.created_at, u.updated_at,
      r.name as role_name, r.description as role_desc, r.is_system as role_is_system, r.permissions as role_permissions,
      COALESCE(log_agg.question_count, 0) as question_count
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) as question_count
      FROM chat_audit_logs
      GROUP BY user_id
    ) log_agg ON u.id = log_agg.user_id
    WHERE u.id = $1
    `,
    [id]
  );

  if (res.rows.length === 0) return null;
  const row = res.rows[0];

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
    question_count: parseInt(row.question_count, 10) || 0,
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
 * Membuat akun user baru.
 */
export async function createUser(data: {
  name: string;
  email: string;
  role_id: string;
  department?: string;
  status?: string;
  avatar_color?: string;
}): Promise<User> {
  await ensureUsersAndRolesTables();
  const pool = getPool();

  const colors = ['#2563EB', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  const res = await pool.query(
    `
    INSERT INTO users (name, email, role_id, department, status, avatar_color, last_login_at)
    VALUES ($1, $2, $3, $4, $5, $6, now())
    RETURNING *
    `,
    [
      data.name.trim(),
      data.email.trim().toLowerCase(),
      data.role_id || 'member',
      data.department?.trim() || 'General',
      data.status || 'active',
      data.avatar_color || randomColor,
    ]
  );

  const newUser = await getUserById(res.rows[0].id);
  if (!newUser) throw new Error('Gagal memuat pengguna yang baru dibuat');
  return newUser;
}

/**
 * Memperbarui data pengguna.
 */
export async function updateUser(
  id: string,
  data: Partial<Pick<User, 'name' | 'email' | 'role_id' | 'status' | 'department' | 'avatar_color'>>
): Promise<User | null> {
  await ensureUsersAndRolesTables();
  const pool = getPool();

  const fields: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIdx++}`);
    params.push(data.name.trim());
  }
  if (data.email !== undefined) {
    fields.push(`email = $${paramIdx++}`);
    params.push(data.email.trim().toLowerCase());
  }
  if (data.role_id !== undefined) {
    fields.push(`role_id = $${paramIdx++}`);
    params.push(data.role_id);
  }
  if (data.status !== undefined) {
    fields.push(`status = $${paramIdx++}`);
    params.push(data.status);
  }
  if (data.department !== undefined) {
    fields.push(`department = $${paramIdx++}`);
    params.push(data.department.trim());
  }
  if (data.avatar_color !== undefined) {
    fields.push(`avatar_color = $${paramIdx++}`);
    params.push(data.avatar_color);
  }

  if (fields.length === 0) return getUserById(id);

  fields.push(`updated_at = now()`);
  params.push(id);

  await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIdx}`,
    params
  );

  return getUserById(id);
}

/**
 * Menghapus pengguna.
 */
export async function deleteUser(id: string): Promise<boolean> {
  await ensureUsersAndRolesTables();
  const pool = getPool();

  // Cegah penghapusan admin utama
  if (id === 'a0000000-0000-0000-0000-000000000001') {
    throw new Error('Akun Super Administrator utama sistem tidak dapat dihapus');
  }

  const res = await pool.query('DELETE FROM users WHERE id = $1', [id]);
  return (res.rowCount || 0) > 0;
}

/**
 * Mengambil daftar seluruh role beserta jumlah anggota.
 */
export async function listRoles(): Promise<Role[]> {
  await ensureUsersAndRolesTables();
  const pool = getPool();

  const res = await pool.query(`
    SELECT 
      r.id,
      r.name,
      r.description,
      r.is_system,
      r.permissions,
      r.created_at,
      r.updated_at,
      COUNT(u.id) as user_count
    FROM roles r
    LEFT JOIN users u ON r.id = u.role_id
    GROUP BY r.id, r.name, r.description, r.is_system, r.permissions, r.created_at, r.updated_at
    ORDER BY r.is_system DESC, r.created_at ASC
  `);

  return res.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    is_system: row.is_system,
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    user_count: parseInt(row.user_count, 10) || 0,
  }));
}

/**
 * Mengambil role berdasarkan ID.
 */
export async function getRoleById(id: string): Promise<Role | null> {
  await ensureUsersAndRolesTables();
  const pool = getPool();

  const res = await pool.query(
    `
    SELECT 
      r.id, r.name, r.description, r.is_system, r.permissions, r.created_at, r.updated_at,
      COUNT(u.id) as user_count
    FROM roles r
    LEFT JOIN users u ON r.id = u.role_id
    WHERE r.id = $1
    GROUP BY r.id, r.name, r.description, r.is_system, r.permissions, r.created_at, r.updated_at
    `,
    [id]
  );

  if (res.rows.length === 0) return null;
  const row = res.rows[0];

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    is_system: row.is_system,
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    user_count: parseInt(row.user_count, 10) || 0,
  };
}

/**
 * Membuat role kustom baru.
 */
export async function createRole(data: {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}): Promise<Role> {
  await ensureUsersAndRolesTables();
  const pool = getPool();

  const cleanId = data.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');

  await pool.query(
    `
    INSERT INTO roles (id, name, description, is_system, permissions)
    VALUES ($1, $2, $3, false, $4::jsonb)
    `,
    [cleanId, data.name.trim(), data.description.trim(), JSON.stringify(data.permissions)]
  );

  const newRole = await getRoleById(cleanId);
  if (!newRole) throw new Error('Gagal memuat role yang baru dibuat');
  return newRole;
}

/**
 * Memperbarui hak akses atau info role.
 */
export async function updateRole(
  id: string,
  data: {
    name?: string;
    description?: string;
    permissions?: string[];
  }
): Promise<Role | null> {
  await ensureUsersAndRolesTables();
  const pool = getPool();

  const fields: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIdx++}`);
    params.push(data.name.trim());
  }
  if (data.description !== undefined) {
    fields.push(`description = $${paramIdx++}`);
    params.push(data.description.trim());
  }
  if (data.permissions !== undefined) {
    fields.push(`permissions = $${paramIdx++}::jsonb`);
    params.push(JSON.stringify(data.permissions));
  }

  if (fields.length === 0) return getRoleById(id);

  fields.push(`updated_at = now()`);
  params.push(id);

  await pool.query(
    `UPDATE roles SET ${fields.join(', ')} WHERE id = $${paramIdx}`,
    params
  );

  return getRoleById(id);
}

/**
 * Menghapus role kustom.
 */
export async function deleteRole(id: string): Promise<boolean> {
  await ensureUsersAndRolesTables();
  const pool = getPool();

  const role = await getRoleById(id);
  if (!role) return false;
  if (role.is_system) {
    throw new Error('Role bawaan sistem tidak dapat dihapus');
  }
  if ((role.user_count || 0) > 0) {
    throw new Error(`Role ini masih digunakan oleh ${role.user_count} pengguna. Alihkan pengguna terlebih dahulu.`);
  }

  const res = await pool.query('DELETE FROM roles WHERE id = $1', [id]);
  return (res.rowCount || 0) > 0;
}
