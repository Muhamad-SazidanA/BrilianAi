import { describe, it, expect } from 'vitest';
import { renderPdfPagesToImages } from '../lib/pdf/renderPages';
import { createTestPdf } from './fixtures/createPdf';

describe('renderPdfPagesToImages', () => {
  // Standard PNG 8-byte magic header: 89 50 4E 47 0D 0A 1A 0A
  const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it('1. should return an array with exactly 3 Buffers for a 3-page PDF', async () => {
    const pdfBuffer = createTestPdf(3);
    const images = await renderPdfPagesToImages(pdfBuffer);

    expect(Array.isArray(images)).toBe(true);
    expect(images).toHaveLength(3);
    images.forEach((img) => {
      expect(Buffer.isBuffer(img)).toBe(true);
      expect(img.length).toBeGreaterThan(0);
    });
  });

  it('2. should verify that every rendered Buffer has valid 8-byte PNG magic header', async () => {
    const pdfBuffer = createTestPdf(3);
    const images = await renderPdfPagesToImages(pdfBuffer);

    expect(images.length).toBe(3);
    images.forEach((img) => {
      const header = img.subarray(0, 8);
      expect(header.equals(PNG_MAGIC_BYTES)).toBe(true);
    });
  });

  it('3. should return an array with exactly 1 Buffer for a 1-page PDF', async () => {
    const pdfBuffer = createTestPdf(1);
    const images = await renderPdfPagesToImages(pdfBuffer);

    expect(Array.isArray(images)).toBe(true);
    expect(images).toHaveLength(1);
    expect(Buffer.isBuffer(images[0])).toBe(true);
    expect(images[0].subarray(0, 8).equals(PNG_MAGIC_BYTES)).toBe(true);
  });

  it('4. should throw a clear and explicit error when given corrupt or damaged PDF buffers', async () => {
    const corruptBuffer = Buffer.from('this is not a valid pdf document format');

    await expect(renderPdfPagesToImages(corruptBuffer)).rejects.toThrowError(
      /Failed to open PDF document/
    );

    // Also test empty buffer
    const emptyBuffer = Buffer.alloc(0);
    await expect(renderPdfPagesToImages(emptyBuffer)).rejects.toThrowError(
      /Invalid PDF buffer/
    );
  });
});
