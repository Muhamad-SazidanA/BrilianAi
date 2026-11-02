import { NextRequest, NextResponse } from 'next/server';
import { revokeSession } from '@lib/db/sessionStore';
import { getAuthenticatedUser } from '@lib/auth/serverAuth';
import { recordAuditEvent } from '@lib/db/auditLogStore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get('brilian_session_token')?.value;
  const authUser = await getAuthenticatedUser(req).catch(() => null);

  if (sessionToken) {
    try {
      await revokeSession(sessionToken);
    } catch {
      // silent fallback
    }
  }

  if (authUser) {
    try {
      await recordAuditEvent({
        eventCategory: 'AUTH',
        action: 'auth.logout',
        actorId: authUser.id,
        actorName: authUser.name,
        actorEmail: authUser.email,
        actorDepartment: authUser.department,
        resourceType: 'session',
        resourceId: sessionToken || authUser.id,
        resourceName: `${authUser.name} (${authUser.email})`,
        status: 'success',
      });
    } catch {}
  }

  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });

  response.cookies.delete('brilian_session_token');
  response.cookies.delete('brilian_active_user_id');
  response.cookies.delete('brilian_user_status');
  response.cookies.delete('brilian_chat_access');

  // Also set expired cookies to force deletion across all browsers
  response.cookies.set({
    name: 'brilian_session_token',
    value: '',
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
  });
  response.cookies.set({
    name: 'brilian_active_user_id',
    value: '',
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
  });
  response.cookies.set({
    name: 'brilian_user_status',
    value: '',
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
  });
  response.cookies.set({
    name: 'brilian_chat_access',
    value: '',
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
  });

  return response;
}
