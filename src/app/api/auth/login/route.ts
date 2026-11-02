import { NextRequest, NextResponse } from 'next/server';
import {
  getUserByEmail,
  getUserAuthByEmailOrUsername,
  updateUserPassword,
  ensureUsersAndRolesTables,
} from '@lib/db/userStore';
import { hashPassword, verifyPassword } from '@lib/security/passwordHasher';
import { createSession } from '@lib/db/sessionStore';
import { getPool } from '@lib/db/dbClient';
import { checkRateLimit, recordRateLimitHit, resetRateLimit } from '@lib/security/rateLimiter';
import { recordAuditEvent } from '@lib/db/auditLogStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, identifier, password } = body;

    const cleanInput = (email || identifier || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanInput) {
      return NextResponse.json(
        { error: 'Username or email address is required.' },
        { status: 400 }
      );
    }

    if (!cleanPassword) {
      return NextResponse.json(
        { error: 'Password is required.' },
        { status: 400 }
      );
    }

    // Rate Limiting & Brute-Force Shield
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';
    const rateLimitKey = `login:${clientIp}:${cleanInput}`;
    const rateCheck = checkRateLimit(rateLimitKey, { maxAttempts: 5, windowSeconds: 900 });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak percobaan login gagal. Akun/IP dibatasi sementara demi keamanan. Coba lagi dalam ${rateCheck.retryAfterSeconds} detik.`,
        },
        { status: 429 }
      );
    }

    // Ensure database tables exist and superadmin is seeded
    await ensureUsersAndRolesTables();

    // Check Super Admin configured via environment variables
    const envSuperadminEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@brilian.ai').trim().toLowerCase();
    const rawEnvPassword = (process.env.SUPERADMIN_PASSWORD || 'admin123').trim();
    const envSuperadminPassword = rawEnvPassword.replace(/^["']|["']$/g, '').trim();
    const defaultUserPassword = (process.env.DEFAULT_USER_PASSWORD || 'admin123').trim();

    const isSuperPasswordValid = (pwd: string) => {
      if (!pwd) return false;
      return (
        (Boolean(envSuperadminPassword) && pwd === envSuperadminPassword) ||
        (Boolean(rawEnvPassword) && pwd === rawEnvPassword)
      );
    };

    const isDemoUserPasswordValid = (pwd: string) => {
      if (!pwd) return false;
      return (
        pwd === defaultUserPassword ||
        pwd === 'admin123' ||
        (Boolean(envSuperadminPassword) && pwd === envSuperadminPassword) ||
        (Boolean(rawEnvPassword) && pwd === rawEnvPassword)
      );
    };

    // Match either exact email, configured env email, or username 'superadmin'
    const isSuperadminMatch =
      cleanInput === envSuperadminEmail ||
      cleanInput === 'superadmin' ||
      cleanInput === 'superadmin@brilian.ai';

    if (isSuperadminMatch) {
      // Find or insert superadmin in DB
      let userAuth = await getUserAuthByEmailOrUsername(envSuperadminEmail);
      if (!userAuth) {
        userAuth = await getUserAuthByEmailOrUsername('superadmin@brilian.ai');
      }

      let isSuperValid = false;
      if (userAuth?.password_hash) {
        isSuperValid = await verifyPassword(cleanPassword, userAuth.password_hash);
      }
      // Fallback to configured env password
      if (!isSuperValid && isSuperPasswordValid(cleanPassword)) {
        isSuperValid = true;
        // Auto-hash superadmin password if missing
        if (userAuth && !userAuth.password_hash) {
          const newHash = await hashPassword(cleanPassword);
          await updateUserPassword(userAuth.id, newHash);
        }
      }

      if (!isSuperValid) {
        recordRateLimitHit(rateLimitKey);
        return NextResponse.json(
          { error: 'Incorrect username or password.' },
          { status: 401 }
        );
      }

      // Successful credentials, reset rate limit counter
      resetRateLimit(rateLimitKey);

      let user = userAuth;
      const pool = getPool();
      if (!user) {
        const initialHash = await hashPassword(cleanPassword);
        const res = await pool.query(
          `INSERT INTO users (id, name, email, password_hash, role_id, status, department, avatar_color, last_login_at)
           VALUES ('a0000000-0000-0000-0000-000000000001', 'Super Admin', $1, $2, 'admin', 'active', 'System Administration', '#2563EB', now())
           ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, last_login_at = now()
           RETURNING *`,
          [envSuperadminEmail, initialHash]
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

      const { password_hash: _omitSuper, ...safeSuperUser } = user;
      const userAgent = req.headers.get('user-agent') || undefined;
      const forwardedFor = req.headers.get('x-forwarded-for');
      const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : req.headers.get('x-real-ip') || undefined;
      const sessionToken = await createSession(user.id, userAgent, ipAddress);

      const response = NextResponse.json({
        success: true,
        user: safeSuperUser,
      });
      response.cookies.set({
        name: 'brilian_session_token',
        value: sessionToken,
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
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
    const dbUserWithAuth = await getUserAuthByEmailOrUsername(cleanInput);
    if (!dbUserWithAuth) {
      recordRateLimitHit(rateLimitKey);
      return NextResponse.json(
        { error: 'Incorrect username or password.' },
        { status: 401 }
      );
    }

    if (dbUserWithAuth.status === 'pending_approval') {
      return NextResponse.json(
        { error: 'Akun Anda sedang menunggu persetujuan Super Administrator.' },
        { status: 403 }
      );
    }

    if (dbUserWithAuth.status === 'inactive') {
      return NextResponse.json(
        { error: 'This account is currently inactive. Contact your administrator.' },
        { status: 403 }
      );
    }

    // Verify individual password hash, with fallback to env password & progressive auto-migration
    let isDbUserValid = false;
    if (dbUserWithAuth.password_hash) {
      isDbUserValid = await verifyPassword(cleanPassword, dbUserWithAuth.password_hash);
    } else {
      // Legacy user without hash: check against default env password and auto-upgrade
      if (isDemoUserPasswordValid(cleanPassword)) {
        isDbUserValid = true;
        const newHash = await hashPassword(cleanPassword);
        await updateUserPassword(dbUserWithAuth.id, newHash);
      }
    }

    if (!isDbUserValid) {
      recordRateLimitHit(rateLimitKey);
      try {
        await recordAuditEvent({
          eventCategory: 'AUTH',
          action: 'auth.login_failed',
          actorName: dbUserWithAuth?.name || cleanInput,
          actorEmail: dbUserWithAuth?.email || cleanInput,
          actorDepartment: dbUserWithAuth?.department,
          status: 'failed',
          details: { reason: 'Incorrect credentials' },
        });
      } catch {}
      return NextResponse.json(
        { error: 'Incorrect username or password.' },
        { status: 401 }
      );
    }

    // Successful credentials, reset rate limit counter
    resetRateLimit(rateLimitKey);

    const pool = getPool();
    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [dbUserWithAuth.id]);

    const { password_hash: _omitDb, ...dbUser } = dbUserWithAuth;

    const userAgent = req.headers.get('user-agent') || undefined;
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : req.headers.get('x-real-ip') || undefined;
    const sessionToken = await createSession(dbUser.id, userAgent, ipAddress);

    try {
      await recordAuditEvent({
        eventCategory: 'AUTH',
        action: 'auth.login',
        actorId: dbUser.id,
        actorName: dbUser.name,
        actorEmail: dbUser.email,
        actorDepartment: dbUser.department,
        actorIp: ipAddress,
        resourceType: 'session',
        resourceId: sessionToken,
        resourceName: `${dbUser.name} (${dbUser.email})`,
        status: 'success',
        details: {
          role: dbUser.role?.name || dbUser.role_id,
          user_agent: userAgent,
        },
      });
    } catch {}

    const response = NextResponse.json({
      success: true,
      user: dbUser,
    });
    response.cookies.set({
      name: 'brilian_session_token',
      value: sessionToken,
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
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
