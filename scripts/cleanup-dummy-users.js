const { Client } = require('pg');
try { require('dotenv').config(); } catch {}
const { getConnectionString } = require('./get-db-url');

async function cleanupDummyUsers() {
  const connectionString = getConnectionString();

  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    const superadminEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@brilian.ai').trim().toLowerCase();

    // Update existing ID or insert
    const updateRes = await client.query(`
      UPDATE users 
      SET email = $1, name = 'Super Admin', department = 'System Administration', role_id = 'admin', status = 'active'
      WHERE id = 'a0000000-0000-0000-0000-000000000001';
    `, [superadminEmail]);

    if (updateRes.rowCount === 0) {
      await client.query(`
        INSERT INTO users (id, name, email, role_id, status, department, avatar_color, last_login_at)
        VALUES
            ('a0000000-0000-0000-0000-000000000001', 'Super Admin', $1, 'admin', 'active', 'System Administration', '#2563EB', now())
        ON CONFLICT (email) DO UPDATE 
          SET role_id = 'admin', status = 'active', name = 'Super Admin';
      `, [superadminEmail]);
    }

    // 2. Delete all dummy users
    const deleteRes = await client.query(`
      DELETE FROM users 
      WHERE email IN (
        'budi.editor@brilian.ai',
        'siti.member@brilian.ai',
        'ahmad.fauzi@brilian.ai',
        'rian.inactive@brilian.ai',
        'admin@brilian.ai'
      ) AND email != $1;
    `, [superadminEmail]);

    console.log(`Deleted ${deleteRes.rowCount || 0} dummy users.`);

    // 3. List remaining users
    const users = await client.query('SELECT id, name, email, role_id, status FROM users');
    console.log('Current users in database:');
    console.table(users.rows);

  } catch (err) {
    console.error('[cleanup-dummy-users] Error:', err);
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

cleanupDummyUsers();
