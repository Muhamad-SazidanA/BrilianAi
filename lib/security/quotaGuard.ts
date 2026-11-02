/**
 * Enterprise AI Generation Quota & Cost Protection Engine
 *
 * Enforces per-user / per-role daily query quotas to prevent runaway LLM costs,
 * recursive script spamming, and prompt looping.
 */

export interface QuotaCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: string;
}

// In-memory quota store: `userId:YYYYMMDD` -> count
const quotaStore = new Map<string, number>();

function getTodayKey(userId: string): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${userId}:${yyyy}${mm}${dd}`;
}

function getMidnightUtcIso(): string {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}

/**
 * Returns allowed daily queries based on role
 */
export function getDailyLimitForRole(roleId?: string): number {
  if (!roleId) return 100;
  const normalized = roleId.toLowerCase();
  if (normalized === 'admin' || normalized === 'superadmin' || normalized === 'direktur') {
    return Infinity; // Unlimited quota for executives & administrators
  }
  if (normalized === 'editor') {
    return 300;
  }
  const envQuota = parseInt(process.env.DEFAULT_DAILY_CHAT_QUOTA || '100', 10);
  return isNaN(envQuota) || envQuota <= 0 ? 100 : envQuota;
}

/**
 * Verifies if user has remaining AI chat query quota for today
 */
export function checkChatQuota(userId: string, roleId?: string): QuotaCheckResult {
  const limit = getDailyLimitForRole(roleId);
  const resetAt = getMidnightUtcIso();

  if (limit === Infinity) {
    return {
      allowed: true,
      limit: 999999,
      remaining: 999999,
      resetAt,
    };
  }

  const key = getTodayKey(userId);
  const currentUsage = quotaStore.get(key) || 0;
  const remaining = Math.max(0, limit - currentUsage);

  return {
    allowed: currentUsage < limit,
    limit,
    remaining,
    resetAt,
  };
}

/**
 * Increments user's AI query count for today
 */
export function recordChatUsage(userId: string): number {
  const key = getTodayKey(userId);
  const current = quotaStore.get(key) || 0;
  const next = current + 1;
  quotaStore.set(key, next);
  return next;
}

/**
 * For testing purposes: resets quota store
 */
export function _resetQuotaStoreForTesting() {
  quotaStore.clear();
}

