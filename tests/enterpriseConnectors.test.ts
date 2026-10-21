import { describe, it, expect, vi } from 'vitest';
import { encryptSecret, decryptSecret } from '../lib/connectors/credentialVault';
import { validateReadOnlyQuery } from '../lib/connectors/databaseConnectorService';
import { fetchFeedData, AVAILABLE_FEED_PRESETS } from '../lib/connectors/feedConnectorService';
import { formatEnterpriseEntityToMarkdown } from '../lib/connectors/enterpriseConnectorService';

describe('Enterprise Connectors Hub & Security', () => {
  describe('1. Credential Vault (AES-256-GCM)', () => {
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

  describe('3. External Data Feeds (Kurs BI, BPS, Pasar Keuangan)', () => {
    it('should fetch and format Kurs BI exchange rates to Markdown table', async () => {
      const feed = await fetchFeedData('kurs-bi');
      expect(feed.title).toContain('Kurs Valuta Asing');
      expect(feed.records.length).toBeGreaterThan(0);
      expect(feed.summaryTableMarkdown).toContain('| Simbol | Mata Uang | Kurs Tengah (IDR) |');
      expect(feed.summaryTableMarkdown).toContain('USD');
      expect(feed.summaryTableMarkdown).toContain('EUR');
    });

    it('should fetch and format BPS macro statistics to Markdown table', async () => {
      const feed = await fetchFeedData('bps-makro');
      expect(feed.title).toContain('Statistik Makroekonomi BPS');
      expect(feed.records.length).toBeGreaterThan(0);
      expect(feed.summaryTableMarkdown).toContain('Inflasi');
      expect(feed.summaryTableMarkdown).toContain('PDB');
    });

    it('should fetch and format financial market indicators to Markdown table', async () => {
      const feed = await fetchFeedData('market-keuangan');
      expect(feed.title).toContain('Indikator Pasar Keuangan');
      expect(feed.summaryTableMarkdown).toContain('IHSG');
      expect(feed.summaryTableMarkdown).toContain('SBN 10 Tahun');
    });

    it('should have standard preset configurations available', () => {
      expect(AVAILABLE_FEED_PRESETS.length).toBe(3);
      expect(AVAILABLE_FEED_PRESETS.map(p => p.id)).toEqual(['kurs-bi', 'bps-makro', 'market-keuangan']);
    });
  });

  describe('4. Enterprise Systems (SAP & Salesforce Entity Mapping)', () => {
    it('should format enterprise entity records into structured Markdown cards', () => {
      const sapRecords = [
        { PurchaseOrder: '4500019283', Vendor: 'PT Krakatau Sarana', TotalValue: 'IDR 4,850,000,000' },
        { PurchaseOrder: '4500019284', Vendor: 'Schneider Electric', TotalValue: 'IDR 1,220,000,000' },
      ];

      const pages = formatEnterpriseEntityToMarkdown('sap', 'PurchaseOrders', sapRecords);
      expect(pages.length).toBe(1);
      expect(pages[0].pageNumber).toBe(1);
      expect(pages[0].text).toContain('# Sistem Enterprise: SAP - PurchaseOrders');
      expect(pages[0].text).toContain('### Entitas: 4500019283');
      expect(pages[0].text).toContain('- **Vendor**: PT Krakatau Sarana');
      expect(pages[0].text).toContain('- **TotalValue**: IDR 4,850,000,000');
    });
  });
});
