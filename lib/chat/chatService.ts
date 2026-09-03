import { embedTexts } from '../ai/embeddingClient';
import { searchSimilarChunks, SimilarChunkResult } from '../db/vectorStore';
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
 * 2. pgvector for similarity search against document chunks
 * 3. llama3.2:3b for LLM generation (with strict or public knowledge grounding)
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
  const topK = options?.topK ?? 5;
  const minSimilarity = options?.minSimilarity ?? (allowPublicKnowledge ? 0.3 : 0.4);

  // 1. Generate query embedding with BGE-M3 (1024-dim)
  const [queryEmbedding] = await embedTexts([trimmedQuery]);

  // 2. Search pgvector for most similar chunks
  let similarChunks: SimilarChunkResult[] = [];
  if (queryEmbedding && queryEmbedding.length > 0) {
    similarChunks = await searchSimilarChunks(queryEmbedding, {
      batchId: options?.documentId,
      limit: topK,
      minSimilarity,
    });
  }

  // 3. Format retrieved chunks into context
  const contextParts = similarChunks.map((chunk, index) => {
    const pageLabel =
      chunk.sourcePageStart === chunk.sourcePageEnd
        ? `Halaman ${chunk.sourcePageStart}`
        : `Halaman ${chunk.sourcePageStart}-${chunk.sourcePageEnd}`;

    return `[Dokumen: ${chunk.originalFilename} | ${pageLabel} | Chunk #${chunk.chunkIndex + 1}]\n${chunk.content}`;
  });

  const contextText = contextParts.join('\n\n---\n\n');

  // 4. Generate answer via Llama 3.2 (3B)
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
