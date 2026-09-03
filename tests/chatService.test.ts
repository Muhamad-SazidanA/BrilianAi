import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchSimilarChunks, SimilarChunkResult } from '../lib/db/vectorStore';
import * as dbClient from '../lib/db/dbClient';
import * as embeddingClient from '../lib/ai/embeddingClient';
import * as chatClient from '../lib/ai/chatClient';
import { askDocumentChat } from '../lib/chat/chatService';
import { POST as handleChatRoute } from '../src/app/api/chat/route';
import { NextRequest } from 'next/server';

describe('AI Chatbot Service (Llama 3.2 3B & pgvector RAG)', () => {
  const mockPool = {
    query: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(dbClient, 'getPool').mockReturnValue(mockPool as any);
  });

  describe('1. vectorStore.searchSimilarChunks()', () => {
    it('should query pgvector using cosine distance and return top matches with similarity', async () => {
      const dummyVector = new Array(1024).fill(0.1);
      const mockRows: SimilarChunkResult[] = [
        {
          id: 1,
          uploadBatchId: 'b1111111-2222-3333-4444-555555555555',
          originalFilename: 'pedoman_audit.pdf',
          chunkIndex: 0,
          content: 'Pasal 4: Ketentuan audit operasional dilakukan berkala.',
          sourcePageStart: 2,
          sourcePageEnd: 2,
          similarity: 0.89,
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockRows, rowCount: 1 });

      const results = await searchSimilarChunks(dummyVector, {
        batchId: 'b1111111-2222-3333-4444-555555555555',
        limit: 3,
      });

      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('Pasal 4');
      expect(mockPool.query).toHaveBeenCalledTimes(1);

      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain('c.embedding <=> $1::vector');
      expect(params[1]).toBe('b1111111-2222-3333-4444-555555555555');
      expect(params[2]).toBe(3);
    });

    it('should return empty array if queryEmbedding is empty', async () => {
      const results = await searchSimilarChunks([]);
      expect(results).toEqual([]);
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  describe('2. chatService.askDocumentChat()', () => {
    it('should generate embeddings, search pgvector, and invoke Llama 3.2 in strict mode (allowPublicKnowledge = false)', async () => {
      const mockVector = new Array(1024).fill(0.05);
      vi.spyOn(embeddingClient, 'embedTexts').mockResolvedValueOnce([mockVector]);

      const mockChunks: SimilarChunkResult[] = [
        {
          id: 10,
          uploadBatchId: 'batch-123',
          originalFilename: 'sop_keuangan.pdf',
          chunkIndex: 1,
          content: 'Anggaran belanja harus disetujui oleh Direktur Keuangan.',
          sourcePageStart: 5,
          sourcePageEnd: 6,
          similarity: 0.8523,
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockChunks, rowCount: 1 });

      const spyChatResponse = vi
        .spyOn(chatClient, 'generateChatResponse')
        .mockResolvedValueOnce(
          'Berdasarkan dokumen sop_keuangan.pdf Halaman 5-6, anggaran belanja harus disetujui oleh Direktur Keuangan.'
        );

      const result = await askDocumentChat('Siapa yang menyetujui anggaran?', {
        allowPublicKnowledge: false,
      });

      expect(result.allowPublicKnowledge).toBe(false);
      expect(result.retrievedCount).toBe(1);
      expect(result.sources[0].filename).toBe('sop_keuangan.pdf');
      expect(result.sources[0].pageStart).toBe(5);
      expect(result.sources[0].pageEnd).toBe(6);
      expect(result.answer).toContain('Direktur Keuangan');

      expect(spyChatResponse).toHaveBeenCalledWith(
        'Siapa yang menyetujui anggaran?',
        expect.stringContaining('sop_keuangan.pdf'),
        false
      );
    });

    it('should pass allowPublicKnowledge = true to chatClient when enabled', async () => {
      vi.spyOn(embeddingClient, 'embedTexts').mockResolvedValueOnce([new Array(1024).fill(0.01)]);
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const spyChatResponse = vi
        .spyOn(chatClient, 'generateChatResponse')
        .mockResolvedValueOnce('Ibu kota Indonesia adalah Jakarta / IKN.');

      const result = await askDocumentChat('Apa ibu kota Indonesia?', {
        allowPublicKnowledge: true,
      });

      expect(result.allowPublicKnowledge).toBe(true);
      expect(result.retrievedCount).toBe(0);
      expect(spyChatResponse).toHaveBeenCalledWith(
        'Apa ibu kota Indonesia?',
        expect.any(String),
        true
      );
    });

    it('should throw error if query is empty or whitespace', async () => {
      await expect(askDocumentChat('   ')).rejects.toThrow('Pertanyaan tidak boleh kosong.');
    });
  });

  describe('3. API Route POST /api/chat', () => {
    it('should return 400 when query is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await handleChatRoute(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('Field "query" is required');
    });

    it('should return 200 with answer and sources on valid query', async () => {
      vi.spyOn(embeddingClient, 'embedTexts').mockResolvedValueOnce([new Array(1024).fill(0.05)]);
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            uploadBatchId: 'b1',
            originalFilename: 'doc.pdf',
            chunkIndex: 0,
            content: 'Isi teks chunk',
            sourcePageStart: 1,
            sourcePageEnd: 1,
            similarity: 0.9,
          },
        ],
        rowCount: 1,
      });

      vi.spyOn(chatClient, 'generateChatResponse').mockResolvedValueOnce('Jawaban dari Llama 3.2');

      const req = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          query: 'Jelaskan isi teks chunk',
          allowPublicKnowledge: false,
        }),
      });

      const res = await handleChatRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.answer).toBe('Jawaban dari Llama 3.2');
      expect(data.sources).toHaveLength(1);
    });
  });
});
