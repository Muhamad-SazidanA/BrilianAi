import { NextRequest, NextResponse } from 'next/server';
import { getGoogleRedirectUri } from '@lib/auth/googleOAuth';

/**
 * Endpoint to initiate Google OAuth 2.0 flow or check configuration status.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const isConfigured = Boolean(
    clientId &&
    clientId !== 'your_google_client_id_here' &&
    clientSecret &&
    clientSecret !== 'your_google_client_secret_here'
  );

  // Status check endpoint for client UI
  if (searchParams.get('check') === '1') {
    return NextResponse.json({
      configured: isConfigured,
      clientId: isConfigured ? `${clientId.slice(0, 12)}...` : null,
    });
  }

  // If not configured, redirect back to login with notice
  if (!isConfigured) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('error', 'google_not_configured');
    return NextResponse.redirect(loginUrl.toString());
  }

  // Build OAuth authorization URL
  const redirectParam = searchParams.get('redirect') || '/';
  const stateData = JSON.stringify({ redirect: redirectParam });
  const state = Buffer.from(stateData).toString('base64url');

  const redirectUri = getGoogleRedirectUri(req);

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'select_account consent');
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}
