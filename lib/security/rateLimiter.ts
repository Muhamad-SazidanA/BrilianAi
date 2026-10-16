/**
 * Enterprise In-Memory Rate Limiter & Brute-Force Protection
 *
 * Tracks requests and failed attempts with sliding-window expiration.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodic cleanup of expired rate limit keys every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    rateLimitStore.forEach((record, key) => {
      if (now > record.resetAt) {
        rateLimitStore.delete(key);
      }
    });
  }, 5 * 60 * 1000).unref?.();
}

export interface RateLimitOptions {
  maxAttempts?: number;
  windowSeconds?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Checks and increments the rate limit counter for a given key.
 *
 * @param key - Unique identifier (e.g. `login:192.168.1.1:user@example.com`)
 * @param options - Configuration options (maxAttempts: default 5, windowSeconds: default 900 = 15m)
 */
export function checkRateLimit(
  key: string,
  options?: RateLimitOptions
): RateLimitResult {
  const maxAttempts = options?.maxAttempts ?? 5;
  const windowMs = (options?.windowSeconds ?? 900) * 1000;
  const now = Date.now();

  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    return {
      allowed: true,
      remaining: maxAttempts,
      retryAfterSeconds: 0,
    };
  }

  if (record.count >= maxAttempts) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    };
  }

  return {
    allowed: true,
    remaining: maxAttempts - record.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Records a failed attempt (increments failure counter).
 */
export function recordRateLimitHit(
  key: string,
  windowSeconds = 900
): void {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
  } else {
    record.count += 1;
  }
}

/**
 * Resets/clears the rate limit counter (e.g., upon successful authentication).
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Resets all rate limit records (for testing purposes).
 */
export function _resetRateLimitStoreForTesting(): void {
  rateLimitStore.clear();
}
