import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  detectDocumentType,
  formatRowsToMarkdownTable,
  extractExcelPages,
  extractCsvPages,
  extractDocumentPages,
} from '../lib/ingest/documentExtractors';

describe('Document Extractors & Multi-Format Ingestion Pipeline', () => {
  describe('1. detectDocumentType', () => {
    it('should detect PDF by magic bytes %PDF', () => {
      const buffer = Buffer.from('%PDF-1.7 sample content');
      expect(detectDocumentType(buffer, 'document.pdf')).toBe('pdf');
      // Even if renamed with wrong extension, magic bytes detect it
      expect(detectDocumentType(buffer, 'document.bin')).toBe('pdf');
    });

    it('should detect DOCX and XLSX by ZIP signature (PK..) and extension', () => {
      const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      expect(detectDocumentType(zipHeader, 'laporan.docx')).toBe('docx');
      expect(detectDocumentType(zipHeader, 'financial_data.xlsx')).toBe('xlsx');
    });

    it('should detect CSV by extension', () => {
      const csvBuffer = Buffer.from('id,name,role\n1,Admin,Superuser\n');
      expect(detectDocumentType(csvBuffer, 'users.csv')).toBe('csv');
    });

    it('should return unknown for unsupported files', () => {
      const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ exe header
      expect(detectDocumentType(exeBuffer, 'program.exe')).toBe('unknown');
    });
  });

  describe('2. formatRowsToMarkdownTable', () => {
    it('should convert 2D array into clean GitHub Flavored Markdown table', () => {
      const rows = [
        ['Nama', 'Jabatan', 'Departemen'],
        ['Budi Santoso', 'Lead Engineer', 'Technology'],
        ['Siti Rahma', 'Product Manager', 'Product'],
      ];

      const markdown = formatRowsToMarkdownTable(rows);
      expect(markdown).toContain('| Nama | Jabatan | Departemen |');
      expect(markdown).toContain('| --- | --- | --- |');
      expect(markdown).toContain('| Budi Santoso | Lead Engineer | Technology |');
      expect(markdown).toContain('| Siti Rahma | Product Manager | Product |');
    });

    it('should escape pipe characters and newlines in cell values', () => {
      const rows = [
        ['Kode', 'Catatan'],
        ['A-1', 'Pipa | Terpisah\ndan baris baru'],
      ];

      const markdown = formatRowsToMarkdownTable(rows);
      expect(markdown).toContain('Pipa \\| Terpisah<br>dan baris baru');
    });
  });

  describe('3. extractExcelPages', () => {
    it('should parse Excel workbook into structured Markdown pages per sheet', async () => {
      // Create a small Excel workbook in memory using SheetJS
      const wb = XLSX.utils.book_new();
      const wsData1 = [
        ['Bulan', 'Pendapatan', 'Laba'],
        ['Januari', '10000000', '3000000'],
        ['Februari', '12000000', '4000000'],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(wsData1);
      XLSX.utils.book_append_sheet(wb, ws1, 'Laporan Keuangan');

      const wsData2 = [
        ['ID', 'Proyek', 'Status'],
        ['PRJ-101', 'Migrasi Cloud', 'Selesai'],
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(wsData2);
      XLSX.utils.book_append_sheet(wb, ws2, 'Daftar Proyek');

      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const pages = await extractExcelPages(excelBuffer, 'annual_report.xlsx');

      expect(pages.length).toBe(2);
      expect(pages[0].pageNumber).toBe(1);
      expect(pages[0].text).toContain('## Sheet: Laporan Keuangan');
      expect(pages[0].text).toContain('| Bulan | Pendapatan | Laba |');
      expect(pages[0].text).toContain('| Januari | 10000000 | 3000000 |');

      expect(pages[1].pageNumber).toBe(2);
      expect(pages[1].text).toContain('## Sheet: Daftar Proyek');
      expect(pages[1].text).toContain('| ID | Proyek | Status |');
      expect(pages[1].text).toContain('| PRJ-101 | Migrasi Cloud | Selesai |');
    });

    it('should paginate sheets with large row counts while preserving table headers', async () => {
      const wb = XLSX.utils.book_new();
      const wsData = [['ID', 'Nilai']];
      for (let i = 1; i <= 65; i++) {
        wsData.push([`Item-${i}`, `${i * 100}`]);
      }
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'BigData');

      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      // rowsPerPage = 50
      const pages = await extractExcelPages(excelBuffer, 'big_data.xlsx', { rowsPerPage: 50 });

      expect(pages.length).toBe(2);
      expect(pages[0].text).toContain('Baris 1 - 50 dari 65');
      expect(pages[0].text).toContain('| Item-1 | 100 |');
      expect(pages[1].text).toContain('Baris 51 - 65 dari 65');
      expect(pages[1].text).toContain('| Item-65 | 6500 |');
      // Kedua halaman harus mempertahankan header kolom
      expect(pages[0].text).toContain('| ID | Nilai |');
      expect(pages[1].text).toContain('| ID | Nilai |');
    });
  });

  describe('4. extractCsvPages', () => {
    it('should parse CSV content into structured Markdown table pages', async () => {
      const csvContent =
        'SKU,Nama Barang,Harga,Stok\n' +
        'BRG-01,Laptop Ultra,15000000,25\n' +
        'BRG-02,Mouse Wireless,250000,100\n';

      const csvBuffer = Buffer.from(csvContent, 'utf-8');
      const pages = await extractCsvPages(csvBuffer, 'katalog.csv');

      expect(pages.length).toBe(1);
      expect(pages[0].pageNumber).toBe(1);
      expect(pages[0].text).toContain('## CSV: katalog.csv');
      expect(pages[0].text).toContain('| SKU | Nama Barang | Harga | Stok |');
      expect(pages[0].text).toContain('| BRG-01 | Laptop Ultra | 15000000 | 25 |');
    });
  });

  describe('5. extractDocumentPages unified dispatcher', () => {
    it('should dispatch Excel and CSV correctly', async () => {
      const csvBuffer = Buffer.from('Col1,Col2\nVal1,Val2\n');
      const result = await extractDocumentPages(csvBuffer, 'test.csv');

      expect(result.detectedType).toBe('csv');
      expect(result.pagesText.length).toBe(1);
      expect(result.pagesText[0].text).toContain('| Col1 | Col2 |');
    });

    it('should throw an error on unsupported file formats', async () => {
      const badBuffer = Buffer.from('executable binary code');
      await expect(extractDocumentPages(badBuffer, 'malware.exe')).rejects.toThrowError(
        /Format berkas "malware.exe" tidak didukung/
      );
    });
  });
});
