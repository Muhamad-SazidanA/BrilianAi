import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, getUserByEmailOrUsername, ensureUsersAndRolesTables } from '@lib/db/userStore';
import { getPool } from '@lib/db/dbClient';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, isSso } = body;

    const cleanInput = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanInput) {
      return NextResponse.json(
        { error: 'Username or email address is required.' },
        { status: 400 }
      );
    }

    if (!isSso && !cleanPassword) {
      return NextResponse.json(
        { error: 'Password is required.' },
        { status: 400 }
      );
    }

    // Ensure database tables exist and superadmin is seeded
    await ensureUsersAndRolesTables();

    // Check Super Admin configured via environment variables
    const envSuperadminEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@brilian.ai').trim().toLowerCase();
    const envSuperadminPassword = (process.env.SUPERADMIN_PASSWORD || 'admin123').trim();

    // Match either exact email, configured env email, or username 'superadmin'
    const isSuperadminMatch =
      cleanInput === envSuperadminEmail ||
      cleanInput === 'superadmin' ||
      cleanInput === 'superadmin@brilian.ai';

    if (isSuperadminMatch) {
      // Validate password if not SSO
      if (!isSso && cleanPassword !== envSuperadminPassword) {
        return NextResponse.json(
          { error: 'Incorrect username or password.' },
          { status: 401 }
        );
      }

      // Find or insert superadmin in DB
      let user = await getUserByEmail(envSuperadminEmail);
      if (!user) {
        user = await getUserByEmail('superadmin@brilian.ai');
      }

      const pool = getPool();
      if (!user) {
        const res = await pool.query(
          `INSERT INTO users (id, name, email, role_id, status, department, avatar_color, last_login_at)
           VALUES ('a0000000-0000-0000-0000-000000000001', 'Super Admin', $1, 'admin', 'active', 'System Administration', '#2563EB', now())
           ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, last_login_at = now()
           RETURNING *`,
          [envSuperadminEmail]
        );
        const row = res.rows[0];
        user = {
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
            id: 'admin',
            name: 'Super Administrator',
            description: 'Akses penuh ke seluruh modul sistem',
            is_system: true,
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
        };
      } else {
        await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
      }

      const response = NextResponse.json({
        success: true,
        user,
      });
      response.cookies.set({
        name: 'brilian_active_user_id',
        value: user.id,
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax',
      });
      response.cookies.set({
        name: 'brilian_user_status',
        value: user.status || 'active',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax',
      });
      response.cookies.set({
        name: 'brilian_chat_access',
        value: user.role?.permissions.includes('chat:query') ? '1' : '0',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax',
      });
      return response;
    }

    // Check other registered database users
    const dbUser = await getUserByEmailOrUsername(cleanInput);
    if (!dbUser) {
      return NextResponse.json(
        { error: 'Incorrect username or password.' },
        { status: 401 }
      );
    }

    if (dbUser.status === 'pending_approval') {
      return NextResponse.json(
        { error: 'Akun Anda sedang menunggu persetujuan Super Administrator.' },
        { status: 403 }
      );
    }

    if (dbUser.status === 'inactive') {
      return NextResponse.json(
        { error: 'This account is currently inactive. Contact your administrator.' },
        { status: 403 }
      );
    }

    // Standard password check against environment password
    if (!isSso && cleanPassword !== envSuperadminPassword) {
      return NextResponse.json(
        { error: 'Incorrect username or password.' },
        { status: 401 }
      );
    }

    const pool = getPool();
    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [dbUser.id]);

    const response = NextResponse.json({
      success: true,
      user: dbUser,
    });
    response.cookies.set({
      name: 'brilian_active_user_id',
      value: dbUser.id,
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'lax',
    });
    response.cookies.set({
      name: 'brilian_user_status',
      value: dbUser.status || 'active',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'lax',
    });
    response.cookies.set({
      name: 'brilian_chat_access',
      value: dbUser.role?.permissions.includes('chat:query') ? '1' : '0',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'lax',
    });
    return response;
  } catch (error: any) {
    console.error('[/api/auth/login error]:', error);
    return NextResponse.json(
      { error: 'Failed to authenticate: ' + (error?.message || 'Internal error') },
      { status: 500 }
    );
  }
}
