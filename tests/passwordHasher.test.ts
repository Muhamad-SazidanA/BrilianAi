import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from '../lib/security/passwordHasher';

describe('passwordHasher security module', () => {
  it('should hash a password and verify successfully', async () => {
    const rawPassword = 'SecurePassword123!';
    const hash = await hashPassword(rawPassword);

    expect(hash).toContain(':');
    const [salt, key] = hash.split(':');
    expect(salt).toHaveLength(32); // 16 bytes = 32 hex chars
    expect(key).toHaveLength(128); // 64 bytes = 128 hex chars

    const isValid = await verifyPassword(rawPassword, hash);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const hash = await hashPassword('CorrectPassword999');
    const isValid = await verifyPassword('WrongPassword', hash);
    expect(isValid).toBe(false);
  });

  it('should return false for invalid hash formats or empty strings', async () => {
    expect(await verifyPassword('test', '')).toBe(false);
    expect(await verifyPassword('test', null as any)).toBe(false);
    expect(await verifyPassword('test', 'not-a-valid-hash')).toBe(false);
    expect(await verifyPassword('', 'salt:key')).toBe(false);
  });

  it('should generate distinct salts for identical passwords', async () => {
    const pwd = 'SamePassword123';
    const hash1 = await hashPassword(pwd);
    const hash2 = await hashPassword(pwd);

    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(pwd, hash1)).toBe(true);
    expect(await verifyPassword(pwd, hash2)).toBe(true);
  });

  it('should validate password length strength', () => {
    expect(validatePasswordStrength('short').valid).toBe(false);
    expect(validatePasswordStrength('12345678').valid).toBe(true);
    expect(validatePasswordStrength('SuperSecurePass2026!').valid).toBe(true);
  });
});

