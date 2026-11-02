import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_SYSTEM_SUGGESTIONS,
  generateDocumentSuggestions,
  getSuggestedQuestionsForUser,
} from '../lib/ai/suggestionService';
import * as vectorStore from '../lib/db/vectorStore';
import * as dbClient from '../lib/db/dbClient';

vi.mock('../lib/db/dbClient', () => {
  return {
    getPool: vi.fn(),
  };
});

describe('Document AI Suggestion Engine (suggestionService)', () => {
  const mockPool = {
    query: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.query.mockResolvedValue({ rows: [] });
    (dbClient.getPool as any).mockReturnValue(mockPool);
  });

  it('1. should return DEFAULT_SYSTEM_SUGGESTIONS when user has no active documents', async () => {
    vi.spyOn(vectorStore, 'listBatches').mockResolvedValue([]);

    const suggestions = await getSuggestedQuestionsForUser(null);
    expect(suggestions).toEqual(DEFAULT_SYSTEM_SUGGESTIONS);
    expect(suggestions.length).toBe(4);
    expect(suggestions[0]).toContain('Bagaimana cara mengunggah dokumen');
  });

  it('2. should return cached suggestions from accessible active document batches', async () => {
    const mockBatches: vectorStore.UploadBatch[] = [
      {
        id: 'batch-001',
        original_filename: 'Laporan_Keuangan_Q4.pdf',
        chunk_count: 5,
        page_count: 10,
        uploaded_at: new Date(),
        is_active_knowledge: true,
        classification: 'Internal',
        status: 'Aktif',
        suggested_questions: [
          'Berapa total laba bersih perseroan di kuartal 4?',
          'Apa saja faktor utama peningkatan efisiensi operasional?',
        ],
      },
    ];

    vi.spyOn(vectorStore, 'listBatches').mockResolvedValue(mockBatches);

    const suggestions = await getSuggestedQuestionsForUser({
      id: 'user-001',
      name: 'User Test',
      email: 'admin@example.com',
      role_id: 'admin',
      role: {
        id: 'admin',
        name: 'Admin',
        description: 'System Admin',
        is_system: true,
        permissions: ['chat:query'],
        allowed_classifications: ['Publik', 'Internal', 'Rahasia', 'Sangat Rahasia'],
      },
      status: 'active',
      department: 'Finance',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    expect(suggestions.length).toBe(2);
    expect(suggestions[0]).toBe('Berapa total laba bersih perseroan di kuartal 4?');
    expect(suggestions[1]).toBe('Apa saja faktor utama peningkatan efisiensi operasional?');
  });

  it('3. should generate explicit questions and update database when document has no cached suggestions', async () => {
    mockPool.query.mockImplementation((sql: string) => {
      if (sql.includes('curated_insights')) {
        return Promise.resolve({
          rows: [
            {
              title: 'Realisasi Pendapatan Operasional',
              content: 'Pendapatan operasional kuartal 4 mencapai Rp 150 Miliar, naik 12% YoY.',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const updateSpy = vi.spyOn(vectorStore, 'updateBatchSuggestedQuestions').mockResolvedValue();

    const questions = await generateDocumentSuggestions('batch-999', 'Audit_Keuangan_2024.pdf');

    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBeGreaterThanOrEqual(2);
    // Pertanyaan harus eksplisit diawali kata tanya (Berapa/Apa/Bagaimana/dll)
    expect(questions[0]).toMatch(/^(Berapa|Apa|Bagaimana|Kapan|Siapa|Apakah)/i);
    expect(updateSpy).toHaveBeenCalledWith('batch-999', expect.any(Array));
  });

  it('4. should filter out documents restricted by classification or user grants', async () => {
    const mockBatches: vectorStore.UploadBatch[] = [
      {
        id: 'batch-secret',
        original_filename: 'Rahasia_Direksi.pdf',
        chunk_count: 2,
        page_count: 5,
        uploaded_at: new Date(),
        is_active_knowledge: true,
        classification: 'Rahasia',
        status: 'Aktif',
        suggested_questions: ['Apa strategi akuisisi rahasia?'],
      },
    ];

    vi.spyOn(vectorStore, 'listBatches').mockResolvedValue(mockBatches);

    // Standard member tanpa hak akses Rahasia tidak boleh menerima saran dari dokumen rahasia
    const suggestions = await getSuggestedQuestionsForUser({
      id: 'user-standard',
      name: 'Staff Biasa',
      email: 'staff@example.com',
      role_id: 'member',
      role: {
        id: 'member',
        name: 'Member',
        description: 'Standard member',
        is_system: true,
        permissions: ['chat:query'],
        allowed_classifications: ['Publik', 'Internal'],
      },
      status: 'active',
      department: 'General',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Harus fallback ke saran default sistem, bukan dokumen rahasia
    expect(suggestions).toEqual(DEFAULT_SYSTEM_SUGGESTIONS);
    expect(suggestions).not.toContain('Apa strategi akuisisi rahasia?');
  });
});
