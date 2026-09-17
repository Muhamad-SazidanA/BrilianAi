import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, createUser, ensureUsersAndRolesTables } from '@lib/db/userStore';
import { getPool } from '@lib/db/dbClient';
import { getGoogleRedirectUri } from '@lib/auth/googleOAuth';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const origin = req.nextUrl.origin;

  const error = searchParams.get('error');
  const code = searchParams.get('code');
  const rawState = searchParams.get('state');

  // Decode target redirect url from state
  let targetRedirect = '/';
  if (rawState) {
    try {
      const decoded = JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8'));
      if (decoded.redirect && typeof decoded.redirect === 'string' && decoded.redirect.startsWith('/')) {
        targetRedirect = decoded.redirect;
      }
    } catch {
      targetRedirect = '/';
    }
  }

  // Handle errors from Google
  if (error) {
    console.error('[Google OAuth Error]:', error, searchParams.get('error_description'));
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', 'google_access_denied');
    return NextResponse.redirect(loginUrl.toString());
  }

  if (!code) {
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', 'google_missing_code');
    return NextResponse.redirect(loginUrl.toString());
  }

  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const redirectUri = getGoogleRedirectUri(req);

  try {
    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[Google OAuth Token Exchange Failed]:', tokenData);
      const loginUrl = new URL('/login', origin);
      loginUrl.searchParams.set('error', 'google_token_exchange_failed');
      return NextResponse.redirect(loginUrl.toString());
    }

    // 2. Fetch Google user profile
    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userinfoRes.ok) {
      console.error('[Google OAuth UserInfo Failed]:', await userinfoRes.text());
      const loginUrl = new URL('/login', origin);
      loginUrl.searchParams.set('error', 'google_userinfo_failed');
      return NextResponse.redirect(loginUrl.toString());
    }

    const profile = await userinfoRes.json();
    const googleEmail = (profile.email || '').trim().toLowerCase();
    const googleName = (profile.name || profile.given_name || 'Google User').trim();

    if (!googleEmail) {
      const loginUrl = new URL('/login', origin);
      loginUrl.searchParams.set('error', 'google_no_email');
      return NextResponse.redirect(loginUrl.toString());
    }

    // 3. Match or provision user in PostgreSQL
    await ensureUsersAndRolesTables();
    const superadminEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@brilian.ai').trim().toLowerCase();
    const pool = getPool();

    let authenticatedUser = await getUserByEmail(googleEmail);

    if (googleEmail === superadminEmail) {
      // Direct Super Admin match: always auto-approved as admin
      if (!authenticatedUser) {
        await pool.query(
          `INSERT INTO users (id, name, email, role_id, status, department, avatar_color, last_login_at)
           VALUES ('a0000000-0000-0000-0000-000000000001', 'Super Admin', $1, 'admin', 'active', 'System Administration', '#2563EB', now())
           ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, status = 'active', role_id = 'admin', last_login_at = now()
           RETURNING id`,
          [superadminEmail]
        );
        authenticatedUser = await getUserByEmail(superadminEmail);
      } else {
        await pool.query("UPDATE users SET status = 'active', role_id = 'admin', last_login_at = now() WHERE id = $1", [authenticatedUser.id]);
        authenticatedUser.status = 'active';
        authenticatedUser.role_id = 'admin';
      }
    } else if (authenticatedUser) {
      // Existing registered database user
      await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [authenticatedUser.id]);
    } else {
      // New user from Google SSO -> register with pending_approval
      authenticatedUser = await createUser({
        name: googleName,
        email: googleEmail,
        role_id: 'member',
        department: 'Google Account',
        status: 'pending_approval',
      });
    }

    const userId = authenticatedUser?.id || 'a0000000-0000-0000-0000-000000000001';
    const userName = authenticatedUser?.name || googleName;
    const userStatus = authenticatedUser?.status || 'pending_approval';

    // Handle deactivated accounts
    if (userStatus === 'inactive') {
      const loginUrl = new URL('/login', origin);
      loginUrl.searchParams.set('error', 'account_inactive');
      return NextResponse.redirect(loginUrl.toString());
    }

    // Determine target destination based on approval status
    const isPending = userStatus === 'pending_approval';
    const destination = isPending ? '/pending-approval' : targetRedirect;

    // 4. Return HTML client-side transition to store session in localStorage and redirect
    const htmlResponse = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${isPending ? 'Verifying Account Approval...' : 'Signing in to Brilian.Ai...'}</title>
  <style>
    body {
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #F8FAFC;
      color: #0F172A;
    }
    .card {
      background: #ffffff;
      padding: 32px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
      text-align: center;
      max-width: 360px;
      width: 90%;
      border: 1px solid #E2E8F0;
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid #E2E8F0;
      border-top-color: ${isPending ? '#F59E0B' : '#2563EB'};
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <div style="font-weight: 600; font-size: 16px; margin-bottom: 6px;">
      ${isPending ? 'Checking Approval Status' : 'Authenticating with Google'}
    </div>
    <div style="font-size: 13px; color: #64748B;">
      ${isPending ? 'Welcome, ' + userName.replace(/</g, '&lt;') + '. Checking superadmin approval...' : 'Welcome, ' + userName.replace(/</g, '&lt;') + '. Redirecting...'}
    </div>
  </div>
  <script>
    try {
      localStorage.setItem('brilian_active_user_id', ${JSON.stringify(userId)});
      localStorage.setItem('brilian_user_status', ${JSON.stringify(userStatus)});
      document.cookie = 'brilian_active_user_id=' + encodeURIComponent(${JSON.stringify(userId)}) + '; path=/; max-age=2592000; SameSite=Lax';
      document.cookie = 'brilian_user_status=' + encodeURIComponent(${JSON.stringify(userStatus)}) + '; path=/; max-age=2592000; SameSite=Lax';
    } catch (e) {
      console.error(e);
    }
    setTimeout(function() {
      window.location.replace(${JSON.stringify(destination)});
    }, 400);
  </script>
</body>
</html>`;

    const response = new NextResponse(htmlResponse, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
    response.cookies.set({
      name: 'brilian_active_user_id',
      value: userId,
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'lax',
    });
    response.cookies.set({
      name: 'brilian_user_status',
      value: userStatus,
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      sameSite: 'lax',
    });
    return response;
  } catch (err: any) {
    console.error('[Google OAuth Callback Error]:', err);
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', 'google_callback_exception');
    return NextResponse.redirect(loginUrl.toString());
  }
}
