import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchSimilarChunks, SimilarChunkResult } from '../lib/db/vectorStore';
import * as dbClient from '../lib/db/dbClient';
import * as embeddingClient from '../lib/ai/embeddingClient';
import * as chatClient from '../lib/ai/chatClient';
import {
  askDocumentChat,
  isDataNotFoundAnswer,
  GOLDEN_FISIOTERAPI_ANSWER,
} from '../lib/chat/chatService';
import {
  parseUserFormattingInstruction,
  formatInstructionPrompt,
} from '../lib/chat/chatUtils';
import {
  isStandardFisioterapiQuery,
  generateChatCacheKey,
} from '../lib/db/chatCacheStore';
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

    it('should return empty sources when LLM response indicates data was not found in the documents', async () => {
      const mockVector = new Array(1024).fill(0.05);
      vi.spyOn(embeddingClient, 'embedTexts').mockResolvedValueOnce([mockVector]);

      // Mock pgvector finding a chunk with weak similarity
      const mockChunks: SimilarChunkResult[] = [
        {
          id: 20,
          uploadBatchId: 'batch-999',
          originalFilename: '6.b.-SPO.pdf',
          chunkIndex: 2,
          content: 'SOP Pelaksanaan Kegiatan Lapangan...',
          sourcePageStart: 2,
          sourcePageEnd: 2,
          similarity: 0.35,
        },
      ];

      mockPool.query.mockResolvedValueOnce({ rows: mockChunks, rowCount: 1 });

      vi.spyOn(chatClient, 'generateChatResponse').mockResolvedValueOnce(
        'Maaf, saya tidak dapat menemukan informasi tentang lokasi gedung PT UTI di dalam dokumen yang disediakan. Dokumen tersebut tidak menyebutkan lokasi atau alamat gedung PT UTI.'
      );

      const result = await askDocumentChat('dimana lokasi gedung PT UTI?', {
        allowPublicKnowledge: false,
      });

      expect(result.answer).toContain('tidak dapat menemukan informasi');
      // sources WAJIB kosong karena halaman 2 tidak memuat informasi lokasi PT UTI
      expect(result.sources).toEqual([]);
      expect(result.retrievedCount).toBe(0);
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
      expect(data.answer).toContain('Jawaban dari Llama 3.2');
      expect(data.answer).toContain('Sumber: doc.pdf | Halaman 1');
      expect(data.sources).toHaveLength(1);
    });
  });

  describe('4. isDataNotFoundAnswer() helper', () => {
    it('should return true for negative / not-found statements', () => {
      const negativeCases = [
        'Maaf, saya tidak dapat menemukan informasi tentang lokasi gedung PT UTI di dalam dokumen yang disediakan. Dokumen tersebut tidak menyebutkan lokasi atau alamat gedung PT UTI.',
        'Data tidak ditemukan di dalam dokumen.',
        'Informasi mengenai lokasi gedung PT UTI tidak ditemukan di dalam dokumen yang tersedia.',
        'Dokumen tidak menyebutkan lokasi PT UTI.',
        'Tidak terdapat informasi mengenai hal tersebut di dalam dokumen.',
        'Maaf, saya tidak memiliki data mengenai topik tersebut.',
      ];

      for (const text of negativeCases) {
        expect(isDataNotFoundAnswer(text)).toBe(true);
      }
    });

    it('should return false for valid informative answers', () => {
      const positiveCases = [
        'Fisioterapi adalah profesi kesehatan holistik yang berfokus pada gerak dan fungsi manusia sepanjang rentang kehidupan.\n\nTujuan dan Fokus:\n• Pelayanan: Meningkatkan gerak tubuh manusia\n• Regulasi: Didasarkan pada Permenkes RI',
        'PT UTI berlokasi di Jalan Kebayoran Baru, Jakarta Selatan.',
      ];

      for (const text of positiveCases) {
        expect(isDataNotFoundAnswer(text)).toBe(false);
      }
    });
  });

  describe('5. parseUserFormattingInstruction() & formatInstructionPrompt() (Pertanyaan.md)', () => {
    it('1. Deteksi Format Dasar (List vs Paragraf)', () => {
      const listReq = parseUserFormattingInstruction('buat dalam bentuk list mengenai tujuan yayasan');
      expect(listReq?.format).toBe('list');
      expect(listReq?.count).toBeNull();

      const paraReq = parseUserFormattingInstruction('jelaskan dalam paragraf mengenai sejarah berdirinya');
      expect(paraReq?.format).toBe('paragraph');
      expect(paraReq?.count).toBeNull();

      // Fallback: tidak ada trigger
      const noTrigger = parseUserFormattingInstruction('Apa itu fisioterapi?');
      expect(noTrigger).toBeNull();
    });

    it('2. Deteksi Format + Jumlah Spesifik (Digit 1/2/3/4/5 maupun Kata satu/dua/tiga/empat/lima)', () => {
      // Menguji digit angka (1, 2, 3, 4, 5)
      const fourList = parseUserFormattingInstruction('buat dalam 4 list fungsi fisioterapi');
      expect(fourList?.format).toBe('list');
      expect(fourList?.count).toBe(4);

      const twoParas = parseUserFormattingInstruction('jelaskan dalam 2 paragraf saja');
      expect(twoParas?.format).toBe('paragraph');
      expect(twoParas?.count).toBe(2);

      const threeListShort = parseUserFormattingInstruction('buat 3 list singkat');
      expect(threeListShort?.format).toBe('list');
      expect(threeListShort?.count).toBe(3);
      expect(threeListShort?.lengthModifier).toBe('short');

      const fiveReasons = parseUserFormattingInstruction('kasih 5 alasan dalam bentuk list');
      expect(fiveReasons?.format).toBe('list');
      expect(fiveReasons?.count).toBe(5);

      // Menguji kata ejaan angka (satu, dua, tiga, empat, lima, dst) - Hasilnya harus sama persis
      const empatPoin = parseUserFormattingInstruction('buat dalam empat poin fungsi fisioterapi');
      expect(empatPoin?.format).toBe('list');
      expect(empatPoin?.count).toBe(4);

      const duaParagraf = parseUserFormattingInstruction('jelaskan dalam dua paragraf saja');
      expect(duaParagraf?.format).toBe('paragraph');
      expect(duaParagraf?.count).toBe(2);

      const tigaListSingkat = parseUserFormattingInstruction('buat tiga list singkat');
      expect(tigaListSingkat?.format).toBe('list');
      expect(tigaListSingkat?.count).toBe(3);
      expect(tigaListSingkat?.lengthModifier).toBe('short');

      const limaAlasan = parseUserFormattingInstruction('kasih lima alasan dalam bentuk list');
      expect(limaAlasan?.format).toBe('list');
      expect(limaAlasan?.count).toBe(5);

      const tigaHal = parseUserFormattingInstruction('sebutkan tiga hal utama');
      expect(tigaHal?.format).toBe('list');
      expect(tigaHal?.count).toBe(3);
    });

    it('3. Deteksi Instruksi Panjang/Kepadatan & Kejelasan Jawaban', () => {
      const shortReq = parseUserFormattingInstruction('jawab secara singkat dan padat to the point');
      expect(shortReq?.lengthModifier).toBe('short');

      const longReq = parseUserFormattingInstruction('jelaskan lebih detail dan elaborasi sejarahnya');
      expect(longReq?.lengthModifier).toBe('long');

      const clearReq = parseUserFormattingInstruction('jelaskan dengan bahasa awam yang gampang dipahami');
      expect(clearReq?.clarityModifier).toBe(true);
    });

    it('4. Deteksi Instruksi Format Lain (Tabel, Steps, No Bullets, Summary)', () => {
      const tableReq = parseUserFormattingInstruction('tampilkan dalam bentuk tabel');
      expect(tableReq?.format).toBe('table');

      const stepsReq = parseUserFormattingInstruction('jelaskan langkah-langkah pendaftaran step by step');
      expect(stepsReq?.format).toBe('steps');

      const noBulletsReq = parseUserFormattingInstruction('jangan pakai bullet, tulis biasa aja');
      expect(noBulletsReq?.noBullets).toBe(true);
      expect(noBulletsReq?.format).toBe('paragraph');

      const summaryReq = parseUserFormattingInstruction('jelaskan isi SOP dan buat kesimpulan di akhir');
      expect(summaryReq?.summaryAtEnd).toBe(true);
    });

    it('5. formatInstructionPrompt menghasilkan direktif presisi untuk LLM', () => {
      const inst = parseUserFormattingInstruction('buat 4 poin singkat dan jelas')!;
      expect(inst).not.toBeNull();
      const prompt = formatInstructionPrompt(inst);
      expect(prompt).toContain('TEPAT 4 POIN LIST');
      expect(prompt).toContain('SINGKAT, PADAT');
      expect(prompt).toContain('SEDERHANA, JELAS');
      expect(prompt).toContain('OVERRIDE');
    });
  });

  describe('6. Deterministic Response Cache & Golden Fisioterapi Answer', () => {
    it('should return exact golden answer for "Apa Itu Fisioterapi?" when asked without modifiers', async () => {
      const queries = [
        'Apa Itu Fisioterapi?',
        'apa itu fisioterapi',
        'definisi fisioterapi',
        'jelaskan apa itu fisioterapi',
      ];

      for (const q of queries) {
        expect(isStandardFisioterapiQuery(q)).toBe(true);
        const result = await askDocumentChat(q);
        expect(result.answer).toBe(GOLDEN_FISIOTERAPI_ANSWER);
        expect(result.answer).toContain('Filosofi Profesi Fisioterapi:');
        expect(result.answer).toContain('Spektrum Pelayanan Fisioterapi:');
        expect(result.answer).toContain('Fisioterapis modern adalah profesional kesehatan');
        expect(result.sources[0].filename).toBe('TM 1. Sejarah FT.pdf');
      }
    });

    it('should NOT intercept golden answer if user adds Pertanyaan.md modifiers', () => {
      expect(isStandardFisioterapiQuery('Apa itu fisioterapi dalam 4 poin?')).toBe(false);
      expect(isStandardFisioterapiQuery('Jelaskan fisioterapi secara singkat')).toBe(false);
      expect(isStandardFisioterapiQuery('buat 2 paragraf tentang fisioterapi')).toBe(false);
    });

    it('should generate different cache keys when modifiers from Pertanyaan.md are used', () => {
      const stdKey = generateChatCacheKey('Apa itu fisioterapi?');
      const fourListKey = generateChatCacheKey('Apa itu fisioterapi dalam 4 poin?');
      const shortKey = generateChatCacheKey('Apa itu fisioterapi secara singkat');

      expect(stdKey).toContain('fmt:default');
      expect(fourListKey).toContain('fmt:list:4');
      expect(shortKey).toContain('short');
      expect(stdKey).not.toBe(fourListKey);
      expect(stdKey).not.toBe(shortKey);
    });
  });
});
