const { Client } = require('pg');
require('dotenv').config();

const DEMO_USERS = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Super Admin',
    email: 'superadmin@brilian.ai',
    roleId: 'admin',
    department: 'System Administration',
    avatarColor: '#2563EB',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    name: 'Budi Editor',
    email: 'editor@brilian.ai',
    roleId: 'editor',
    department: 'Editorial & Knowledge',
    avatarColor: '#0891B2',
  },
  {
    id: 'c0000000-0000-0000-0000-000000000003',
    name: 'Siti Member',
    email: 'member@brilian.ai',
    roleId: 'member',
    department: 'Operations',
    avatarColor: '#16A34A',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000004',
    name: 'Dedi Chat Only',
    email: 'chatonly@brilian.ai',
    roleId: 'chat_only',
    department: 'Customer Support',
    avatarColor: '#9333EA',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000005',
    name: 'Rina Knowledge Only',
    email: 'knowledgeonly@brilian.ai',
    roleId: 'knowledge_only',
    department: 'Research & Library',
    avatarColor: '#D97706',
  },
];

const ROLES = [
  {
    id: 'admin',
    name: 'Super Administrator',
    description: 'Akses penuh ke seluruh modul sistem, dokumen, kurasi AI, manajemen pengguna, dan audit log.',
    isSystem: true,
    permissions: [
      'documents:read',
      'documents:upload',
      'documents:toggle_active',
      'documents:delete',
      'curation:trigger',
      'curation:edit',
      'curation:delete',
      'chat:query',
      'chat:export',
      'users:manage',
      'roles:manage',
      'audit:read',
    ],
  },
  {
    id: 'editor',
    name: 'Knowledge Manager & Editor',
    description: 'Dapat mengunggah dokumen, mengelola basis pengetahuan, dan bertanya ke Chatbot.',
    isSystem: true,
    permissions: [
      'documents:read',
      'documents:upload',
      'documents:toggle_active',
      'curation:trigger',
      'curation:edit',
      'curation:delete',
      'chat:query',
      'chat:export',
    ],
  },
  {
    id: 'member',
    name: 'Member / Viewer',
    description: 'Hak akses standar untuk membaca dokumen aktif dan bertanya pada AI Chatbot.',
    isSystem: true,
    permissions: ['documents:read', 'chat:query', 'chat:export'],
  },
  {
    id: 'chat_only',
    name: 'Chatbot Specialist',
    description: 'Hak akses khusus untuk bertanya dan berdiskusi dengan AI Chatbot.',
    isSystem: false,
    permissions: ['chat:query', 'chat:export'],
  },
  {
    id: 'knowledge_only',
    name: 'Knowledge Viewer',
    description: 'Hak akses khusus untuk membaca repositori dokumen pengetahuan.',
    isSystem: false,
    permissions: ['documents:read'],
  },
];

async function seedDemoUsers() {
  let connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/brilian_db';
  if (connectionString.includes('@postgres:') && !process.env.DOCKER_CONTAINER) {
    connectionString = connectionString.replace('@postgres:', '@localhost:');
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    await client.query('BEGIN');

    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        is_system BOOLEAN NOT NULL DEFAULT false,
        permissions JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    for (const role of ROLES) {
      await client.query(
        `INSERT INTO roles (id, name, description, is_system, permissions)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [role.id, role.name, role.description, role.isSystem, JSON.stringify(role.permissions)]
      );
    }

    await client.query(`
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
      )
    `);

    for (const user of DEMO_USERS) {
      await client.query(
        `INSERT INTO users (id, name, email, role_id, status, department, avatar_color, last_login_at)
         VALUES ($1, $2, $3, $4, 'active', $5, $6, now())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           role_id = EXCLUDED.role_id,
           status = 'active',
           department = EXCLUDED.department,
           avatar_color = EXCLUDED.avatar_color`,
        [user.id, user.name, user.email, user.roleId, user.department, user.avatarColor]
      );
    }

    await client.query('COMMIT');

    console.log('Demo users seeded successfully.');
    console.table(
      DEMO_USERS.map((user) => ({
        role: user.roleId,
        email: user.email,
        password: 'SUPERADMIN_PASSWORD',
      }))
    );
    console.log('Set SUPERADMIN_PASSWORD="1qa2ws3ed!@#" in .env before starting the app.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[seed-demo-users] Error:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

seedDemoUsers();
