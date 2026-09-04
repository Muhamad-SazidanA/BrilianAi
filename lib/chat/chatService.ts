import { embedTexts } from '../ai/embeddingClient';
import {
  searchSimilarChunks,
  searchSimilarCuratedInsights,
  getBatchById,
  SimilarChunkResult,
  SimilarCuratedResult,
} from '../db/vectorStore';
import { generateChatResponse } from '../ai/chatClient';

export interface ChatSource {
  chunkId: number | string;
  uploadBatchId: string;
  filename: string;
  pageStart: number;
  pageEnd: number;
  content: string;
  similarity: number;
}

export interface ChatRequestOptions {
  documentId?: string;
  allowPublicKnowledge?: boolean;
  topK?: number;
  minSimilarity?: number;
}

export interface ChatResponseResult {
  answer: string;
  sources: ChatSource[];
  allowPublicKnowledge: boolean;
  retrievedCount: number;
}

/**
 * Orchestrates end-to-end RAG chat using:
 * 1. bge-m3 for query embedding
 * 2. pgvector for similarity search against document chunks and curated insights
 * 3. LLM generation with comprehensive structured grounding
 *
 * @param query - User's question
 * @param options - Document filters, public knowledge flag, top-K chunks
 * @returns Promise<ChatResponseResult>
 */
export async function askDocumentChat(
  query: string,
  options?: ChatRequestOptions
): Promise<ChatResponseResult> {
  const trimmedQuery = query?.trim();
  if (!trimmedQuery) {
    throw new Error('Pertanyaan tidak boleh kosong.');
  }

  const allowPublicKnowledge = Boolean(options?.allowPublicKnowledge);
  const topK = options?.topK ?? 4;
  const minSimilarity = options?.minSimilarity ?? (allowPublicKnowledge ? 0.2 : 0.25);

  // Jika dokumen spesifik ditargetkan, pastikan dokumen telah aktif sebagai Basis Pengetahuan AI
  if (options?.documentId) {
    try {
      const batch = await getBatchById(options.documentId);
      if (batch && !batch.is_active_knowledge) {
        return {
          answer: `Dokumen "${batch.original_filename}" belum diaktifkan sebagai basis pengetahuan AI Chatbot. Dokumen baru dapat dibaca dan ditanyakan setelah proses Kurasi Insight mencapai 100% dan diaktifkan melalui tombol "Aktifkan sebagai Basis Pengetahuan AI".`,
          sources: [],
          allowPublicKnowledge,
          retrievedCount: 0,
        };
      }
    } catch (err) {
      console.warn('[ChatService] getBatchById check warning:', err);
    }
  }

  // 1. Generate query embedding with BGE-M3 (1024-dim)
  const [queryEmbedding] = await embedTexts([trimmedQuery]);

  // 2. Search pgvector for most similar chunks and curated insights
  let similarChunks: SimilarChunkResult[] = [];
  let similarCurated: SimilarCuratedResult[] = [];

  if (queryEmbedding && queryEmbedding.length > 0) {
    similarChunks = await searchSimilarChunks(queryEmbedding, {
      batchId: options?.documentId,
      limit: topK,
      minSimilarity,
      onlyActiveKnowledge: true,
    });

    try {
      similarCurated = await searchSimilarCuratedInsights(queryEmbedding, {
        batchId: options?.documentId,
        limit: 3,
        minSimilarity,
        onlyActiveKnowledge: true,
      });
    } catch {
      // Fallback gracefully if curated insights table is not yet populated
    }
  }

  // 3. Format retrieved context sections
  const contextSections: string[] = [];

  if (similarCurated.length > 0) {
    const curatedLines = similarCurated.map(
      (c) =>
        `[Insight Kurasi: "${c.title}" | Kategori: ${c.category} | ${c.sourcePages} | Dokumen: ${c.originalFilename}]\n${c.content}`
    );
    contextSections.push(`=== INSIGHT KURASI TERSTRUKTUR DOKUMEN ===\n${curatedLines.join('\n\n')}`);
  }

  if (similarChunks.length > 0) {
    const rawLines = similarChunks.map((chunk) => {
      const pageLabel =
        chunk.sourcePageStart === chunk.sourcePageEnd
          ? `Halaman ${chunk.sourcePageStart}`
          : `Halaman ${chunk.sourcePageStart}-${chunk.sourcePageEnd}`;

      return `[Dokumen: ${chunk.originalFilename} | ${pageLabel} | Chunk #${chunk.chunkIndex + 1}]\n${chunk.content}`;
    });
    contextSections.push(`=== KONTEN LENGKAP HALAMAN DOKUMEN ===\n${rawLines.join('\n\n---\n\n')}`);
  }

  const contextText = contextSections.join('\n\n====================\n\n');

  // 4. Generate comprehensive structured answer via LLM
  const answer = await generateChatResponse(trimmedQuery, contextText, allowPublicKnowledge);

  // 5. Build sources list
  const sources: ChatSource[] = similarChunks.map((c) => ({
    chunkId: c.id,
    uploadBatchId: c.uploadBatchId,
    filename: c.originalFilename,
    pageStart: c.sourcePageStart,
    pageEnd: c.sourcePageEnd,
    content: c.content,
    similarity: Number(c.similarity.toFixed(4)),
  }));

  return {
    answer,
    sources,
    allowPublicKnowledge,
    retrievedCount: sources.length,
  };
}
