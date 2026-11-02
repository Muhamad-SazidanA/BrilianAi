import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_INACTIVITY_TIMEOUT_MS,
  DEFAULT_INACTIVITY_WARNING_MS,
  getInactivityConfig,
  calculateInactivityState,
  formatInactivityCountdown,
} from '../lib/security/inactivityConfig';

describe('Inactivity Timeout & Session Security Logic', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getInactivityConfig', () => {
    it('should return default 30 minutes timeout and 2 minutes warning when env is not set', () => {
      delete process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS;
      delete process.env.NEXT_PUBLIC_INACTIVITY_WARNING_MS;

      const config = getInactivityConfig();
      expect(config.timeoutMs).toBe(30 * 60 * 1000);
      expect(config.warningMs).toBe(2 * 60 * 1000);
    });

    it('should correctly parse valid environment variable overrides', () => {
      process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS = '900000'; // 15 mins
      process.env.NEXT_PUBLIC_INACTIVITY_WARNING_MS = '60000';   // 1 min

      const config = getInactivityConfig();
      expect(config.timeoutMs).toBe(900000);
      expect(config.warningMs).toBe(60000);
    });

    it('should fall back to default when env variable is invalid string or negative', () => {
      process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS = 'invalid';
      process.env.NEXT_PUBLIC_INACTIVITY_WARNING_MS = '-1000';

      const config = getInactivityConfig();
      expect(config.timeoutMs).toBe(DEFAULT_INACTIVITY_TIMEOUT_MS);
      expect(config.warningMs).toBe(DEFAULT_INACTIVITY_WARNING_MS);
    });
  });

  describe('calculateInactivityState', () => {
    const timeoutMs = 30 * 60 * 1000; // 30 min = 1,800,000 ms
    const warningMs = 2 * 60 * 1000;  // 2 min = 120,000 ms
    const config = { timeoutMs, warningMs };

    it('should report active and no warning immediately after activity', () => {
      const now = 1000000;
      const lastActivity = now;

      const state = calculateInactivityState(lastActivity, now, config);
      expect(state.isTimedOut).toBe(false);
      expect(state.isWarning).toBe(false);
      expect(state.remainingMs).toBe(timeoutMs);
      expect(state.remainingSeconds).toBe(1800);
    });

    it('should report active and no warning at 15 minutes of inactivity', () => {
      const now = 1000000 + 15 * 60 * 1000;
      const lastActivity = 1000000;

      const state = calculateInactivityState(lastActivity, now, config);
      expect(state.isTimedOut).toBe(false);
      expect(state.isWarning).toBe(false);
      expect(state.remainingMs).toBe(15 * 60 * 1000);
      expect(state.remainingSeconds).toBe(900);
    });

    it('should trigger warning state at 28 minutes and 10 seconds (less than 2 min remaining)', () => {
      // 28 min 10 sec = 1,690,000 ms elapsed. Remaining: 110,000 ms (< 120,000 ms)
      const now = 1000000 + (28 * 60 + 10) * 1000;
      const lastActivity = 1000000;

      const state = calculateInactivityState(lastActivity, now, config);
      expect(state.isTimedOut).toBe(false);
      expect(state.isWarning).toBe(true);
      expect(state.remainingMs).toBe(110000);
      expect(state.remainingSeconds).toBe(110);
    });

    it('should trigger isTimedOut at exact 30 minutes threshold', () => {
      const now = 1000000 + 30 * 60 * 1000;
      const lastActivity = 1000000;

      const state = calculateInactivityState(lastActivity, now, config);
      expect(state.isTimedOut).toBe(true);
      expect(state.isWarning).toBe(false);
      expect(state.remainingMs).toBe(0);
      expect(state.remainingSeconds).toBe(0);
    });

    it('should stay in isTimedOut when elapsed time exceeds 30 minutes', () => {
      const now = 1000000 + 45 * 60 * 1000;
      const lastActivity = 1000000;

      const state = calculateInactivityState(lastActivity, now, config);
      expect(state.isTimedOut).toBe(true);
      expect(state.isWarning).toBe(false);
      expect(state.remainingMs).toBe(0);
      expect(state.remainingSeconds).toBe(0);
    });
  });

  describe('formatInactivityCountdown', () => {
    it('should format 120 seconds to 02:00', () => {
      expect(formatInactivityCountdown(120)).toBe('02:00');
    });

    it('should format 65 seconds to 01:05', () => {
      expect(formatInactivityCountdown(65)).toBe('01:05');
    });

    it('should format 9 seconds with leading zero to 00:09', () => {
      expect(formatInactivityCountdown(9)).toBe('00:09');
    });

    it('should handle zero seconds to 00:00', () => {
      expect(formatInactivityCountdown(0)).toBe('00:00');
    });

    it('should handle negative seconds gracefully to 00:00', () => {
      expect(formatInactivityCountdown(-5)).toBe('00:00');
    });
  });
});

