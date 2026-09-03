import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dbClient from '../lib/db/dbClient';
import * as embeddingClient from '../lib/ai/embeddingClient';
import {
  insertCuratedInsights,
  listCuratedInsights,
  updateCuratedInsight,
} from '../lib/db/vectorStore';
import { curateBatch } from '../lib/curation/curationService';
import { GET as handleGetCurated, POST as handlePostCurate } from '../src/app/api/documents/[id]/curate/route';
import { PUT as handlePutCuratedItem } from '../src/app/api/documents/[id]/curate/[insightId]/route';
import { GET as handleExport } from '../src/app/api/documents/[id]/export/route';
import { NextRequest } from 'next/server';

describe('Dual-Chunk & Curation Service (Konten Mentah vs Insight Kurasi)', () => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };

  const mockPool = {
    query: vi.fn(),
    connect: vi.fn().mockResolvedValue(mockClient),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(dbClient, 'getPool').mockReturnValue(mockPool as any);
  });

  describe('1. vectorStore curated_insights CRUD', () => {
    it('insertCuratedInsights should insert items within transaction and return records', async () => {
      const mockBatchId = 'b1111111-2222-3333-4444-555555555555';
      const mockSaved = {
        id: 1,
        upload_batch_id: mockBatchId,
        title: 'Realisasi Dana Hibah',
        content: 'Realisasi sebesar 300 juta rupiah...',
        importance: 'medium',
        category: 'track1_financial',
        tags: ['CSR', 'Dana Hibah'],
        source_pages: 'Halaman 1-3',
        source_chunk_id: null,
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockSaved], rowCount: 1 }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const results = await insertCuratedInsights(mockBatchId, [
        {
          title: 'Realisasi Dana Hibah',
          content: 'Realisasi sebesar 300 juta rupiah...',
          importance: 'medium',
          category: 'track1_financial',
          tags: ['CSR', 'Dana Hibah'],
          sourcePages: 'Halaman 1-3',
        },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Realisasi Dana Hibah');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('listCuratedInsights should fetch records ordered by importance', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            title: 'Hasil Kinerja',
            importance: 'high',
          },
        ],
        rowCount: 1,
      });

      const list = await listCuratedInsights('b1');
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe('Hasil Kinerja');
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('updateCuratedInsight should update fields and return updated insight', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 5,
            title: 'Judul Baru',
            content: 'Konten Baru',
            importance: 'high',
          },
        ],
        rowCount: 1,
      });

      const updated = await updateCuratedInsight(5, {
        title: 'Judul Baru',
        content: 'Konten Baru',
        importance: 'high',
      });

      expect(updated.title).toBe('Judul Baru');
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain('UPDATE curated_insights');
      expect(params).toContain('Judul Baru');
    });
  });

  describe('2. API Routes for Curated Insights', () => {
    it('GET /api/documents/[id]/curate should return list of curated insights', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, title: 'Survey Kepuasan', importance: 'high' }],
      });

      const req = new NextRequest('http://localhost:3000/api/documents/b1/curate');
      const res = await handleGetCurated(req, { params: { id: 'b1' } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].title).toBe('Survey Kepuasan');
    });

    it('PUT /api/documents/[id]/curate/[insightId] should edit curated insight successfully', async () => {
      vi.spyOn(embeddingClient, 'embedTexts').mockResolvedValueOnce([new Array(1024).fill(0.02)]);
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            title: 'Judul Diperbarui',
            content: 'Isi diperbarui',
            importance: 'medium',
          },
        ],
        rowCount: 1,
      });

      const req = new NextRequest('http://localhost:3000/api/documents/b1/curate/2', {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Judul Diperbarui',
          content: 'Isi diperbarui',
          importance: 'medium',
        }),
      });

      const res = await handlePutCuratedItem(req, { params: { id: 'b1', insightId: '2' } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.title).toBe('Judul Diperbarui');
    });

    it('GET /api/documents/[id]/export should return knowledge json payload', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: 'b1', original_filename: 'laporan.pdf' }],
        }) // listBatches
        .mockResolvedValueOnce({
          rows: [{ chunk_index: 0, content: 'raw', source_page_start: 1, source_page_end: 1 }],
        }) // listChunks
        .mockResolvedValueOnce({
          rows: [{ id: 1, title: 'Insight', content: 'curated' }],
        }); // listCuratedInsights

      const req = new NextRequest('http://localhost:3000/api/documents/b1/export');
      const res = await handleExport(req, { params: { id: 'b1' } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.rawChunksCount).toBe(1);
      expect(data.curatedInsightsCount).toBe(1);
      expect(data.rawChunks[0].content).toBe('raw');
      expect(data.curatedInsights[0].title).toBe('Insight');
    });
  });
});
