import { NextRequest } from 'next/server';

/**
 * Resolves the appropriate Google OAuth callback URL.
 * Supports:
 * - Production domain: https://brilian.uti.co.id/api/auth/google/callback (enforces HTTPS)
 * - Docker localhost: http://localhost:9000/api/auth/google/callback
 * - Dev localhost:    http://localhost:3000/api/auth/google/callback
 */
export function getGoogleRedirectUri(req: NextRequest): string {
  // 1. Inspect client request host headers (e.g. 'localhost:3000', 'localhost:9000', 'brilian.uti.co.id')
  const host =
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    req.nextUrl.host ||
    'localhost:3000';

  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');

  // If request is from a local development environment, always return local callback
  if (isLocal) {
    const proto =
      req.headers.get('x-forwarded-proto') ||
      (req.nextUrl.protocol ? req.nextUrl.protocol.replace(':', '') : 'http');
    return `${proto}://${host}/api/auth/google/callback`;
  }

  // 2. For remote/production environments:
  // If explicitly configured with a custom domain in process.env
  const envUri = (process.env.GOOGLE_REDIRECT_URI || '').trim();
  if (envUri && !envUri.includes('localhost')) {
    return envUri;
  }

  // 3. If APP_URL is configured (e.g. https://brilian.uti.co.id)
  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
  if (appUrl && !appUrl.includes('localhost')) {
    return `${appUrl}/api/auth/google/callback`;
  }

  // Fallback to HTTPS origin
  return `https://${host}/api/auth/google/callback`;
}

