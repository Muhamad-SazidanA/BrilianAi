import crypto from 'crypto';

const KEY_LEN = 64;

/**
 * Hashes a plaintext password using Node.js crypto.scrypt with a unique random 16-byte salt.
 * Formats as "salt:hash" in hex. Memory-hard, resistant to GPU/ASIC brute force.
 *
 * @param plainPassword - The plaintext password to hash
 * @returns Promise<string> - Formatted as `${salt}:${derivedKeyHex}`
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  const salt = crypto.randomBytes(16).toString('hex');

  return new Promise((resolve, reject) => {
    crypto.scrypt(plainPassword, salt, KEY_LEN, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verifies a plaintext password against a stored "salt:hash" string using constant-time comparison.
 * Prevents timing attacks.
 *
 * @param plainPassword - The plaintext password candidate
 * @param storedHash - Stored string in "salt:hash" format
 * @returns Promise<boolean> - True if valid, false otherwise
 */
export async function verifyPassword(
  plainPassword: string,
  storedHash?: string | null
): Promise<boolean> {
  if (!plainPassword || !storedHash || typeof storedHash !== 'string') {
    return false;
  }

  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }

  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) {
    return false;
  }

  const expectedKey = Buffer.from(expectedHex, 'hex');

  return new Promise((resolve) => {
    crypto.scrypt(plainPassword, salt, expectedKey.length, (err, derivedKey) => {
      if (err) return resolve(false);
      try {
        if (expectedKey.length !== derivedKey.length) {
          return resolve(false);
        }
        resolve(crypto.timingSafeEqual(expectedKey, derivedKey));
      } catch {
        resolve(false);
      }
    });
  });
}

/**
 * Evaluates password strength according to standard enterprise guidelines.
 * Requires at least 8 characters.
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  error?: string;
} {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password wajib diisi.' };
  }

  if (password.length < 8) {
    return {
      valid: false,
      error: 'Password minimal terdiri dari 8 karakter.',
    };
  }

  return { valid: true };
}

