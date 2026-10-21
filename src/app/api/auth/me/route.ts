import { NextRequest, NextResponse } from 'next/server';
import { getUserById, ensureUsersAndRolesTables } from '@lib/db/userStore';
import { validateSession } from '@lib/db/sessionStore';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/me
 * Returns current authenticated user and synchronizes status cookies.
 */
export async function GET(req: NextRequest) {
  try {
    await ensureUsersAndRolesTables();

    let user = null;

    // 1. Enterprise Session Validation
    const sessionToken = req.cookies.get('brilian_session_token')?.value;
    if (sessionToken) {
      user = await validateSession(sessionToken);
    }

    // 2. Dev / Legacy fallback (strictly local development only)
    const isLocalDevOrTest =
      process.env.NODE_ENV !== 'production' &&
      !process.env.DOCKER_CONTAINER &&
      process.env.ENABLE_INSECURE_DEV_AUTH === 'true';

    if (!user && isLocalDevOrTest) {
      let userId = req.cookies.get('brilian_active_user_id')?.value;
      if (!userId) {
        userId = req.headers.get('x-user-id') || undefined;
      }

      const isUuid = Boolean(
        userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
      );

      if (userId && isUuid) {
        user = await getUserById(userId);
      }
    }

    if (!user) {
      const response = NextResponse.json(
        { authenticated: false, error: 'No active session found.' },
        { status: 401 }
      );
      response.cookies.delete('brilian_session_token');
      response.cookies.delete('brilian_active_user_id');
      response.cookies.delete('brilian_user_status');
      response.cookies.delete('brilian_chat_access');
      return response;
    }

    const response = NextResponse.json({
      authenticated: true,
      user,
      status: user.status,
      isApproved: user.status === 'active',
      isPending: user.status === 'pending_approval',
    });

    // Keep status cookie synchronized with latest database state
    response.cookies.set({
      name: 'brilian_user_status',
      value: user.status,
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
  } catch (err: any) {
    console.error('[/api/auth/me GET Error]:', err);
    return NextResponse.json(
      { authenticated: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
