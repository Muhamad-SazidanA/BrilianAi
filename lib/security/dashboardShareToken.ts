import crypto from 'crypto';

const SHARE_SECRET =
  process.env.DASHBOARD_SHARE_SECRET ||
  process.env.SESSION_SECRET ||
  'brilian-dashboard-share-secret-key-2026';

/**
 * Generates an HMAC-SHA256 signature for sharing a specific dashboard turn.
 * Strictly bound to (sessionId, turnIndex, dashboardId).
 */
export function generateDashboardShareToken(
  sessionId: string,
  turnIndex: number,
  dashboardId: string
): string {
  const data = `${sessionId.toLowerCase().trim()}:${turnIndex}:${dashboardId.trim()}`;
  return crypto.createHmac('sha256', SHARE_SECRET).update(data).digest('hex').slice(0, 32);
}

/**
 * Verifies that the provided share token matches the signature for (sessionId, turnIndex, dashboardId).
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyDashboardShareToken(
  sessionId: string,
  turnIndex: number,
  dashboardId: string,
  token: string | null | undefined
): boolean {
  if (!token || typeof token !== 'string' || token.length !== 32) {
    return false;
  }
  const expected = generateDashboardShareToken(sessionId, turnIndex, dashboardId);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}
