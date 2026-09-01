import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as handleUpload } from '../src/app/api/documents/upload/route';
import { GET as handleListBatches } from '../src/app/api/documents/route';
import { GET as handleListChunks } from '../src/app/api/documents/[id]/chunks/route';
import { NextRequest } from 'next/server';
import * as queueModule from '../lib/queue/ingestQueue';
import * as vectorStoreModule from '../lib/db/vectorStore';

describe('Next.js API Route Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/documents/upload', () => {
    it('1. should return 400 when non-PDF file is uploaded (invalid magic bytes)', async () => {
      const formData = new FormData();
      const fakeTextBlob = new Blob(['Ini bukan file PDF melainkan teks biasa'], {
        type: 'text/plain',
      });
      formData.append('file', fakeTextBlob, 'catatan.txt');

      const request = new NextRequest('http://localhost:3000/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await handleUpload(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/Invalid file format/i);
    });

    it('2. should return 400 when no file is provided in the form data', async () => {
      const formData = new FormData();
      const request = new NextRequest('http://localhost:3000/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await handleUpload(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toMatch(/No PDF file uploaded/i);
    });

    it('3. should return 200 with valid upload result when valid PDF is provided', async () => {
      const mockResult = {
        uploadBatchId: 'b1111111-2222-3333-4444-555555555555',
        originalFilename: 'laporan.pdf',
        pageCount: 3,
        chunkCount: 5,
      };

      vi.spyOn(queueModule, 'queuePdfIngestion').mockResolvedValueOnce(mockResult);

      const validPdfBytes = Buffer.from('%PDF-1.4\n%valid dummy header\n%%EOF');
      const pdfBlob = new Blob([validPdfBytes], { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', pdfBlob, 'laporan.pdf');

      const request = new NextRequest('http://localhost:3000/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await handleUpload(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        upload_batch_id: 'b1111111-2222-3333-4444-555555555555',
        original_filename: 'laporan.pdf',
        page_count: 3,
        chunk_count: 5,
      });
    });
  });

  describe('GET /api/documents', () => {
    it('should return 200 with list of upload batches', async () => {
      const mockBatches = [
        {
          id: 'b1',
          original_filename: 'doc1.pdf',
          chunk_count: 4,
          page_count: 2,
          uploaded_at: '2026-09-01T15:00:00Z',
        },
      ];

      vi.spyOn(vectorStoreModule, 'listBatches').mockResolvedValueOnce(mockBatches);

      const response = await handleListBatches();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockBatches);
    });
  });

  describe('GET /api/documents/[id]/chunks', () => {
    it('should return 200 with list of chunks for a batch ID', async () => {
      const mockChunks = [
        {
          id: '1',
          upload_batch_id: 'b1',
          chunk_index: 0,
          content: 'Chunk pertama',
          source_page_start: 1,
          source_page_end: 1,
          embedding: '[...]',
          created_at: '2026-09-01T15:00:00Z',
        },
      ];

      vi.spyOn(vectorStoreModule, 'listChunks').mockResolvedValueOnce(mockChunks as any);

      const request = new NextRequest('http://localhost:3000/api/documents/b1/chunks');
      const response = await handleListChunks(request, { params: { id: 'b1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockChunks);
    });
  });
});
