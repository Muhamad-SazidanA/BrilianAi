import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  recordRateLimitHit,
  resetRateLimit,
  _resetRateLimitStoreForTesting,
} from '../lib/security/rateLimiter';

describe('Enterprise Rate Limiter & Brute-Force Shield', () => {
  beforeEach(() => {
    _resetRateLimitStoreForTesting();
  });

  it('should allow requests when under the maximum limit', () => {
    const key = 'test:login:user1';
    const check = checkRateLimit(key, { maxAttempts: 5, windowSeconds: 60 });

    expect(check.allowed).toBe(true);
    expect(check.remaining).toBe(5);
    expect(check.retryAfterSeconds).toBe(0);
  });

  it('should decrease remaining attempts as failures are recorded', () => {
    const key = 'test:login:user2';

    recordRateLimitHit(key, 60);
    recordRateLimitHit(key, 60);

    const check = checkRateLimit(key, { maxAttempts: 5, windowSeconds: 60 });
    expect(check.allowed).toBe(true);
    expect(check.remaining).toBe(3);
  });

  it('should block requests and return retryAfterSeconds when threshold is reached', () => {
    const key = 'test:login:user3';

    for (let i = 0; i < 5; i++) {
      recordRateLimitHit(key, 60);
    }

    const check = checkRateLimit(key, { maxAttempts: 5, windowSeconds: 60 });
    expect(check.allowed).toBe(false);
    expect(check.remaining).toBe(0);
    expect(check.retryAfterSeconds).toBeGreaterThan(0);
    expect(check.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('should reset counter immediately when resetRateLimit is called', () => {
    const key = 'test:login:user4';

    for (let i = 0; i < 5; i++) {
      recordRateLimitHit(key, 60);
    }
    expect(checkRateLimit(key, { maxAttempts: 5 }).allowed).toBe(false);

    resetRateLimit(key);

    const checkAfterReset = checkRateLimit(key, { maxAttempts: 5 });
    expect(checkAfterReset.allowed).toBe(true);
    expect(checkAfterReset.remaining).toBe(5);
  });
});
