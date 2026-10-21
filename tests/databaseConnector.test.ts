import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from '../lib/connectors/credentialVault';
import { validateReadOnlyQuery } from '../lib/connectors/databaseConnectorService';

describe('Database Connector & Security (No Mock / Zero Dummy)', () => {
  describe('1. Credential Vault (AES-256-GCM Cryptographic Security)', () => {
    it('should encrypt and decrypt database credentials successfully', () => {
      const secretPassword = 'P@ssw0rdEnterprise2026!#$';
      const encrypted = encryptSecret(secretPassword);

      expect(encrypted).not.toBe(secretPassword);
      expect(encrypted.split(':').length).toBe(3); // iv:authTag:ciphertext

      const decrypted = decryptSecret(encrypted);
      expect(decrypted).toBe(secretPassword);
    });

    it('should handle empty string safely', () => {
      expect(encryptSecret('')).toBe('');
      expect(decryptSecret('')).toBe('');
    });
  });

  describe('2. Database Read-Only Query Validation Guard', () => {
    it('should allow valid SELECT queries', () => {
      const q1 = 'SELECT id, name, price, stock FROM products WHERE active = true;';
      expect(validateReadOnlyQuery(q1).isValid).toBe(true);

      const q2 = `
        WITH recent_orders AS (
          SELECT id, customer_id, total FROM orders WHERE created_at > now() - interval '30 days'
        )
        SELECT * FROM recent_orders;
      `;
      expect(validateReadOnlyQuery(q2).isValid).toBe(true);
    });

    it('should reject destructive SQL mutation statements', () => {
      const drops = 'DROP TABLE users;';
      expect(validateReadOnlyQuery(drops).isValid).toBe(false);

      const inserts = 'INSERT INTO users (username) VALUES ("hacker");';
      expect(validateReadOnlyQuery(inserts).isValid).toBe(false);

      const deletes = 'DELETE FROM transactions WHERE amount < 0;';
      expect(validateReadOnlyQuery(deletes).isValid).toBe(false);

      const alters = 'ALTER TABLE accounts ADD COLUMN backdoors text;';
      expect(validateReadOnlyQuery(alters).isValid).toBe(false);

      const truncates = 'TRUNCATE TABLE audit_logs;';
      expect(validateReadOnlyQuery(truncates).isValid).toBe(false);
    });

    it('should reject empty or whitespace queries', () => {
      expect(validateReadOnlyQuery('').isValid).toBe(false);
      expect(validateReadOnlyQuery('   ').isValid).toBe(false);
    });
  });
});
