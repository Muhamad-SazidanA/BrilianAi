import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ingestPdf } from '../lib/ingest/ingestService';
import * as renderPagesModule from '../lib/pdf/renderPages';
import * as visionClientModule from '../lib/ai/visionClient';
import * as chunkingModule from '../lib/chunking/splitWithPageTracking';
import * as embeddingModule from '../lib/ai/embeddingClient';
import * as vectorStoreModule from '../lib/db/vectorStore';
import fs from 'fs';

describe('ingestPdf (End-to-End Ingestion Service Pipeline)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. should execute the ingestion steps in exact sequential order and return valid UploadResult', async () => {
    const dummyPdfBuffer = Buffer.from('%PDF-1.4 dummy pdf content');
    const dummyPagePng = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const mockBatchId = 'b0000000-0000-0000-0000-000000000001';

    // Track execution order
    const executionOrder: string[] = [];

    // 1. Mock renderPdfPagesToImages (2 pages)
    vi.spyOn(renderPagesModule, 'renderPdfPagesToImages').mockImplementation(async () => {
      executionOrder.push('1.renderPdfPagesToImages');
      return [dummyPagePng, dummyPagePng];
    });

    // 2. Mock extractPageText
    vi.spyOn(visionClientModule, 'extractPageText').mockImplementation(async () => {
      executionOrder.push('2.extractPageText');
      return 'Teks hasil AI Vision halaman dokumen.';
    });

    // 3. Mock chunkWithPageOffsets
    vi.spyOn(chunkingModule, 'chunkWithPageOffsets').mockImplementation(async () => {
      executionOrder.push('3.chunkWithPageOffsets');
      return [
        { content: 'Chunk 1 teks', sourcePageStart: 1, sourcePageEnd: 1 },
        { content: 'Chunk 2 teks', sourcePageStart: 1, sourcePageEnd: 2 },
      ];
    });

    // 4. Mock embedTexts
    vi.spyOn(embeddingModule, 'embedTexts').mockImplementation(async () => {
      executionOrder.push('4.embedTexts');
      return [
        new Array(1024).fill(0.01),
        new Array(1024).fill(0.02),
      ];
    });

    // 5. Mock createUploadBatch
    vi.spyOn(vectorStoreModule, 'createUploadBatch').mockImplementation(async () => {
      executionOrder.push('5.createUploadBatch');
      return mockBatchId;
    });

    // 6. Mock insertChunks
    vi.spyOn(vectorStoreModule, 'insertChunks').mockImplementation(async () => {
      executionOrder.push('6.insertChunks');
    });

    // Spy on fs.writeFileSync to ensure zero disk write
    const fsWriteSpy = vi.spyOn(fs, 'writeFileSync');

    const result = await ingestPdf(dummyPdfBuffer, 'laporan_tahunan.pdf');

    // Verify Return Value
    expect(result).toEqual({
      uploadBatchId: mockBatchId,
      originalFilename: 'laporan_tahunan.pdf',
      pageCount: 2,
      chunkCount: 2,
    });

    // Verify Order
    expect(executionOrder).toEqual([
      '1.renderPdfPagesToImages',
      '2.extractPageText',
      '2.extractPageText',
      '3.chunkWithPageOffsets',
      '4.embedTexts',
      '5.createUploadBatch',
      '6.insertChunks',
    ]);

    // Verify 100% in-memory: no file written to disk
    expect(fsWriteSpy).not.toHaveBeenCalled();
  });

  it('2. should throw an error if the input fileBuffer is empty or invalid', async () => {
    await expect(ingestPdf(Buffer.alloc(0), 'empty.pdf')).rejects.toThrowError(
      /Invalid PDF file buffer/
    );
  });
});
