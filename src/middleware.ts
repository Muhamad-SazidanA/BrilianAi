import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const host = request.headers.get('host') || '';
  const isShareSubdomain = host.startsWith('share.');

  // Handle subdomain share.brilian.ai/chat/[id] -> rewrite to /share/chat/[id]
  if (isShareSubdomain && pathname.startsWith('/chat/')) {
    const shareRewriteUrl = request.nextUrl.clone();
    shareRewriteUrl.pathname = `/share${pathname}`;
    return NextResponse.rewrite(shareRewriteUrl);
  }

  // 1. Skip static files, Next.js internal files, auth APIs, public share pages, and images
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/share') ||
    /\.(.*)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const activeUserId = request.cookies.get('brilian_active_user_id')?.value;
  const userStatus = request.cookies.get('brilian_user_status')?.value;

  // 2. Unauthenticated handling
  if (!activeUserId) {
    if (pathname === '/login') {
      return NextResponse.next();
    }

    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/' && pathname !== '/dashboard' && pathname !== '/pending-approval') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 3. User is authenticated, check account status
  // 3a. Account is pending approval by superadmin:
  if (userStatus === 'pending_approval') {
    if (pathname === '/pending-approval') {
      return NextResponse.next();
    }

    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Forbidden: Akun Anda sedang menunggu persetujuan Super Administrator.' },
        { status: 403 }
      );
    }

    // Stuck on /pending-approval until superadmin approves
    return NextResponse.redirect(new URL('/pending-approval', request.url));
  }

  // 3b. Account is inactive/suspended:
  if (userStatus === 'inactive') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden: Akun dinonaktifkan.' }, { status: 403 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'account_inactive');
    return NextResponse.redirect(loginUrl);
  }

  // Fast route-level gate. API handlers perform the authoritative DB-backed
  // permission check; this prevents unauthorized users from entering chat UI.
  if (pathname === '/chat' || pathname.startsWith('/chat/')) {
    const chatAccess = request.cookies.get('brilian_chat_access')?.value;
    if (chatAccess === '0') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden: AI Assistant access required.' }, { status: 403 });
      }
      const forbiddenUrl = new URL('/forbidden', request.url);
      forbiddenUrl.searchParams.set('permission', 'chat:query');
      return NextResponse.redirect(forbiddenUrl);
    }
  }

  // 3c. Account is active:
  if (pathname === '/login' || pathname === '/pending-approval') {
    let redirectTarget = request.nextUrl.searchParams.get('redirect') || '/';
    if (redirectTarget === '/login' || redirectTarget === '/pending-approval') {
      redirectTarget = '/';
    }
    return NextResponse.redirect(new URL(redirectTarget, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and files
     */
    '/((?!_next/static|_next/image|favicon.png|favicon.ico|.*\\..*).*)',
    '/',
  ],
};
