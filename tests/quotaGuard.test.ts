import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkChatQuota,
  recordChatUsage,
  getDailyLimitForRole,
  _resetQuotaStoreForTesting,
} from '../lib/security/quotaGuard';

describe('AI Cost Governance & Daily Quota Guardrail (quotaGuard)', () => {
  beforeEach(() => {
    _resetQuotaStoreForTesting();
    delete process.env.DEFAULT_DAILY_CHAT_QUOTA;
  });

  it('should grant unlimited quota to superadmin, admin, and direktur roles', () => {
    expect(getDailyLimitForRole('superadmin')).toBe(Infinity);
    expect(getDailyLimitForRole('admin')).toBe(Infinity);
    expect(getDailyLimitForRole('direktur')).toBe(Infinity);

    const check = checkChatQuota('admin-user-1', 'admin');
    expect(check.allowed).toBe(true);
    expect(check.limit).toBeGreaterThan(99999);
  });

  it('should grant higher quota (300) to editor role', () => {
    expect(getDailyLimitForRole('editor')).toBe(300);
  });

  it('should default member role to 100 queries per day', () => {
    expect(getDailyLimitForRole('member')).toBe(100);
  });

  it('should allow queries until quota limit is reached and reject afterwards', () => {
    process.env.DEFAULT_DAILY_CHAT_QUOTA = '3';
    const userId = 'test-member-99';

    // Query 1
    let check = checkChatQuota(userId, 'member');
    expect(check.allowed).toBe(true);
    expect(check.remaining).toBe(3);
    recordChatUsage(userId);

    // Query 2
    check = checkChatQuota(userId, 'member');
    expect(check.allowed).toBe(true);
    expect(check.remaining).toBe(2);
    recordChatUsage(userId);

    // Query 3
    check = checkChatQuota(userId, 'member');
    expect(check.allowed).toBe(true);
    expect(check.remaining).toBe(1);
    recordChatUsage(userId);

    // Query 4 -> Limit reached
    check = checkChatQuota(userId, 'member');
    expect(check.allowed).toBe(false);
    expect(check.remaining).toBe(0);
    expect(check.limit).toBe(3);
  });
});

