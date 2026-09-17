import crypto from 'crypto';

// 62 karakter URL-safe (0-9, A-Z, a-z)
const NANOID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Menghasilkan NanoID URL-safe acak secara cryptographically secure.
 * Default panjang: 11 karakter (menghasilkan 62^11 kombinasi unik).
 */
export function generateNanoId(size: number = 11): string {
  const bytes = crypto.randomBytes(size);
  let result = '';
  const alphabetLength = NANOID_ALPHABET.length;
  for (let i = 0; i < size; i++) {
    result += NANOID_ALPHABET[bytes[i] % alphabetLength];
  }
  return result;
}
