import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_SALT = 'brilian-ai-vault-salt-2026';

function getVaultKey(): Buffer {
  const secret = process.env.CONNECTOR_SECRET_KEY || process.env.JWT_SECRET || 'brilian-ai-enterprise-secret-key-32b!';
  // Hash to exactly 32 bytes (256 bits)
  return crypto.scryptSync(secret, DEFAULT_SALT, 32);
}

/**
 * Enkripsi data sensitif (password DB, API key enterprise) dengan AES-256-GCM.
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(16);
  const key = getVaultKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  // Format: iv:authTag:encryptedHex
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Dekripsi data sensitif dengan AES-256-GCM.
 */
export function decryptSecret(cipherString: string): string {
  if (!cipherString) return '';
  const parts = cipherString.split(':');
  if (parts.length !== 3) {
    // Jika belum terenkripsi (misal legacy plain string), kembalikan as-is
    return cipherString;
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = getVaultKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
