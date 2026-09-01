import { describe, it, expect, vi, beforeEach } from 'vitest';
import { embedTexts } from '../lib/ai/embeddingClient';
import { OllamaEmbeddings } from '@langchain/ollama';

vi.mock('@langchain/ollama', () => {
  const MockOllamaEmbeddings = vi.fn();
  MockOllamaEmbeddings.prototype.embedDocuments = vi.fn();
  return {
    OllamaEmbeddings: MockOllamaEmbeddings,
  };
});

describe('embedTexts (AI Embedding Client)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. should embed an array of 3 texts in a single batch and return 3 vectors of 1024 dimensions', async () => {
    const inputTexts = [
      'Pendahuluan sistem ingestion data enterprise berbasis AI Vision.',
      'Sliding window chunking dengan pelacakan halaman sumber.',
      'Penyimpanan embedding vektor bge-m3 1024 dimensi ke pgvector.',
    ];

    // Create mock 1024-dim vectors
    const mockVector1 = new Array(1024).fill(0.01);
    const mockVector2 = new Array(1024).fill(0.02);
    const mockVector3 = new Array(1024).fill(0.03);
    const mockEmbeddings = [mockVector1, mockVector2, mockVector3];

    vi.mocked(OllamaEmbeddings.prototype.embedDocuments).mockResolvedValueOnce(
      mockEmbeddings
    );

    const result = await embedTexts(inputTexts);

    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(1024);
    expect(result[1]).toHaveLength(1024);
    expect(result[2]).toHaveLength(1024);

    // Verify batch call: embedDocuments was called once with the entire array
    expect(OllamaEmbeddings.prototype.embedDocuments).toHaveBeenCalledTimes(1);
    expect(OllamaEmbeddings.prototype.embedDocuments).toHaveBeenCalledWith(inputTexts);
  });

  it('2. should return an empty array without calling Ollama when given empty input', async () => {
    const result = await embedTexts([]);
    expect(result).toEqual([]);
    expect(OllamaEmbeddings.prototype.embedDocuments).not.toHaveBeenCalled();
  });
});
