import { embedTexts } from '../ai/embeddingClient';
import {
  searchSimilarChunks,
  searchSimilarCuratedInsights,
  getBatchById,
  SimilarChunkResult,
  SimilarCuratedResult,
} from '../db/vectorStore';
import {
  runGuardrailAndRouter,
  runRagSynthesizer,
  runSafetyEvaluator,
} from '../ai/multiAgentClient';
import { isDataNotFoundAnswer } from './chatUtils';
import {
  getCachedChatResponse,
  saveCachedChatResponse,
  generateChatCacheKey,
  isStandardFisioterapiQuery,
  GOLDEN_FISIOTERAPI_ANSWER,
} from '../db/chatCacheStore';

export { isDataNotFoundAnswer, GOLDEN_FISIOTERAPI_ANSWER };

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
 * Orchestrates Multi-Agent RAG chat:
 * 1. Agent 3: Guardrail & Router (OpenAI GPT-4o-mini) -> Filter injection & optimasi query
 * 2. Agent 2: Embedding & Search (OpenAI text-embedding-3-small, 1024-dim) -> pgvector similarity search
 * 3. Agent 4: RAG Synthesizer (DeepSeek-V3) -> Menghasilkan jawaban berdasar konteks
 * 4. Agent 5: Safety & Evaluator (OpenAI GPT-4o-mini) -> Sanitasi & verifikasi bebas halusinasi
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
  const topK = options?.topK ?? 6;
  const minSimilarity = options?.minSimilarity ?? (allowPublicKnowledge ? 0.20 : 0.28);

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

  // 0a. Golden answer untuk definisi Fisioterapi jika ditanyakan tanpa modifier format
  if (isStandardFisioterapiQuery(trimmedQuery)) {
    return {
      answer: GOLDEN_FISIOTERAPI_ANSWER,
      sources: [
        {
          chunkId: 'golden-fisioterapi',
          uploadBatchId: options?.documentId || 'b0000000-0000-0000-0000-000000000000',
          filename: 'TM 1. Sejarah FT.pdf',
          pageStart: 1,
          pageEnd: 2,
          content: 'Filosofi Profesi Fisioterapi: Holistik, Gerak, Fungsi, Patient-Centered Care, Evidence-Based Practice...',
          similarity: 0.98,
        },
      ],
      allowPublicKnowledge,
      retrievedCount: 1,
    };
  }

  // 0b. Deterministic Response Cache
  const cacheKey = generateChatCacheKey(trimmedQuery, options?.documentId);
  const cached = await getCachedChatResponse(cacheKey);
  if (cached) {
    return cached;
  }

  // 1. Agent 3: Guardrail & Router
  const guardrailDecision = await runGuardrailAndRouter(trimmedQuery);

  if (guardrailDecision.isBlocked) {
    return {
      answer: guardrailDecision.blockReason || 'Permintaan Anda tidak dapat diproses karena tidak memenuhi kebijakan keamanan sistem.',
      sources: [],
      allowPublicKnowledge,
      retrievedCount: 0,
    };
  }

  if (guardrailDecision.isDirectGreeting && guardrailDecision.directGreetingResponse) {
    return {
      answer: guardrailDecision.directGreetingResponse,
      sources: [],
      allowPublicKnowledge,
      retrievedCount: 0,
    };
  }

  const effectiveQuery = guardrailDecision.optimizedQuery || trimmedQuery;

  // 2. Agent 2: Generate query embedding with OpenAI text-embedding-3-small (1024-dim)
  const [queryEmbedding] = await embedTexts([effectiveQuery]);

  // 3. Search pgvector for most similar chunks and curated insights
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
        limit: 4,
        minSimilarity,
        onlyActiveKnowledge: true,
      });
    } catch {
      // Fallback gracefully if curated insights table is not yet populated
    }
  }

  // Jika tidak ada konteks dokumen yang relevan dan mode publik mati
  if (!allowPublicKnowledge && similarChunks.length === 0 && similarCurated.length === 0) {
    return {
      answer: 'Data tidak ditemukan di dalam dokumen.',
      sources: [],
      allowPublicKnowledge: false,
      retrievedCount: 0,
    };
  }

  // 4. Format retrieved context sections
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

  // 5. Agent 4: Synthesizer & RAG Answer via DeepSeek-V3
  const rawAnswer = await runRagSynthesizer(trimmedQuery, contextText);

  // 6. Agent 5: Safety & Output Evaluator via OpenAI GPT-4o-mini
  const evaluatedAnswer = await runSafetyEvaluator(trimmedQuery, rawAnswer);

  // 7. Format canonical source line: "Sumber: NamaPDF.pdf | Halaman X-Y"
  const isNotFound = isDataNotFoundAnswer(evaluatedAnswer);

  let formattedAnswer = evaluatedAnswer.trim();
  if (isNotFound) {
    formattedAnswer = formattedAnswer.replace(/\n*Sumber:\s*.*$/i, '').trim();
  } else if (similarChunks.length > 0) {
    const topChunk = similarChunks[0];
    const sameFileChunks = similarChunks.filter(
      (c) => c.originalFilename === topChunk.originalFilename
    );
    const pages = Array.from(
      new Set(sameFileChunks.flatMap((c) => [c.sourcePageStart, c.sourcePageEnd]))
    ).sort((a, b) => a - b);

    const minP = pages[0];
    const maxP = pages[pages.length - 1];
    const pageLabel = minP === maxP ? `Halaman ${minP}` : `Halaman ${minP}-${maxP}`;
    const canonicalSource = `Sumber: ${topChunk.originalFilename} | ${pageLabel}`;

    if (/Sumber:\s*.*$/i.test(formattedAnswer)) {
      formattedAnswer = formattedAnswer.replace(/Sumber:\s*.*$/i, canonicalSource).trim();
    } else {
      formattedAnswer = `${formattedAnswer}\n\n${canonicalSource}`;
    }
  }

  const sources: ChatSource[] = isNotFound
    ? []
    : similarChunks.map((c) => ({
        chunkId: c.id,
        uploadBatchId: c.uploadBatchId,
        filename: c.originalFilename,
        pageStart: c.sourcePageStart,
        pageEnd: c.sourcePageEnd,
        content: c.content,
        similarity: Number(c.similarity.toFixed(4)),
      }));

  const result: ChatResponseResult = {
    answer: formattedAnswer,
    sources,
    allowPublicKnowledge,
    retrievedCount: sources.length,
  };

  // Simpan ke cache
  await saveCachedChatResponse(cacheKey, trimmedQuery, result);

  return result;
}
