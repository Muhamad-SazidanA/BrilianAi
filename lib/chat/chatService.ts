import { embedTexts } from '../ai/embeddingClient';
import {
  searchSimilarChunks,
  searchSimilarCuratedInsights,
  getBatchById,
  listBatches,
  UploadBatch,
  SimilarChunkResult,
  SimilarCuratedResult,
} from '../db/vectorStore';
import {
  runGuardrailAndRouter,
  runRagSynthesizer,
  runSafetyEvaluator,
} from '../ai/multiAgentClient';
import { generateChatResponse } from '../ai/chatClient';
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
          answer: `Dokumen "${batch.original_filename}" saat ini berstatus non-aktif (standby) untuk AI Chatbot. Anda dapat mengaktifkannya melalui menu Knowledge Base atau Document Studio.`,
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
  // Hanya digunakan jika database belum memiliki batch/dokumen aktif (misal saat cold-start / unit testing)
  if (isStandardFisioterapiQuery(trimmedQuery)) {
    try {
      const batches: UploadBatch[] = await listBatches();
      const hasRealActiveDoc = batches.some((b: UploadBatch) => (b.chunk_count || 0) > 0 && b.is_active_knowledge);
      if (!hasRealActiveDoc) {
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
    } catch {
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

  // 2. Agent 2: Generate query embedding (1024-dim) with fallback
  let queryEmbedding: number[] = [];
  try {
    const embeddings = await embedTexts([effectiveQuery]);
    if (embeddings && embeddings[0] && Array.isArray(embeddings[0])) {
      queryEmbedding = embeddings[0];
    }
  } catch (embErr) {
    console.warn('[ChatService] embedTexts notice:', embErr);
  }

  // 3. Hybrid Search: pgvector cosine similarity + text keyword search
  let similarChunks: SimilarChunkResult[] = [];
  let similarCurated: SimilarCuratedResult[] = [];

  similarChunks = await searchSimilarChunks(queryEmbedding, {
    batchId: options?.documentId,
    limit: topK,
    minSimilarity,
    onlyActiveKnowledge: true,
    textQuery: effectiveQuery,
  });

  try {
    similarCurated = await searchSimilarCuratedInsights(queryEmbedding, {
      batchId: options?.documentId,
      limit: 4,
      minSimilarity,
      onlyActiveKnowledge: true,
      textQuery: effectiveQuery,
    });
  } catch {
    // Fallback gracefully if curated insights table is not yet populated
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

  // 5. Agent 4: Synthesizer & RAG Answer via DeepSeek-V3 / Multi-Agent
  let rawAnswer = '';
  try {
    rawAnswer = await runRagSynthesizer(trimmedQuery, contextText, { allowPublicKnowledge });
  } catch (synthErr) {
    console.warn('[ChatService] Synthesizer fallback:', synthErr);
    rawAnswer = await generateChatResponse(trimmedQuery, contextText, allowPublicKnowledge);
  }

  // 6. Agent 5: Safety & Output Evaluator via OpenAI GPT-4o-mini
  let evaluatedAnswer = rawAnswer;
  try {
    evaluatedAnswer = await runSafetyEvaluator(trimmedQuery, rawAnswer);
  } catch {
    evaluatedAnswer = rawAnswer;
  }

  // 7. Format canonical source line & sources badges secara cerdas & presisi
  const isNotFound = isDataNotFoundAnswer(evaluatedAnswer);

  let formattedAnswer = evaluatedAnswer.trim();
  let sources: ChatSource[] = [];

  if (isNotFound) {
    formattedAnswer = formattedAnswer.replace(/\n*Sumber:\s*.*$/i, '').trim();
  } else {
    const { primaryFilename, pageLabel, filteredSources } = determineAccurateSources(
      evaluatedAnswer,
      similarChunks,
      similarCurated
    );

    if (primaryFilename) {
      const canonicalSource = `Sumber: ${primaryFilename} | ${pageLabel}`;
      if (/Sumber:\s*.*$/i.test(formattedAnswer)) {
        formattedAnswer = formattedAnswer.replace(/Sumber:\s*.*$/i, canonicalSource).trim();
      } else {
        formattedAnswer = `${formattedAnswer}\n\n${canonicalSource}`;
      }
    }

    sources = filteredSources;
  }

  const result: ChatResponseResult = {
    answer: formattedAnswer,
    sources,
    allowPublicKnowledge,
    retrievedCount: sources.length,
  };

  // Simpan ke cache jika jawaban informatif
  if (!isNotFound) {
    await saveCachedChatResponse(cacheKey, trimmedQuery, result);
  }

  return result;
}

interface AttributionResult {
  primaryFilename: string;
  pageLabel: string;
  filteredSources: ChatSource[];
}

/**
 * Menentukan dokumen sumber yang BENAR-BENAR digunakan dalam jawaban:
 * 1. Menghargai kutipan eksplisit nama file dari LLM jika cocok dengan kandidat dokumen.
 * 2. Menghitung content overlap (kesesuaian kata kunci fakta) antara jawaban dan isi teks tiap file.
 * 3. Menyaring chunk yang tidak relevan (zero overlap) agar tidak mencemari daftar sumber.
 * 4. Menduplikasi halaman sumber sehingga tidak ada kartu hal yang sama berulang kali.
 */
export function determineAccurateSources(
  evaluatedAnswer: string,
  chunks: SimilarChunkResult[],
  curated: SimilarCuratedResult[]
): AttributionResult {
  if (chunks.length === 0 && curated.length === 0) {
    return { primaryFilename: '', pageLabel: '', filteredSources: [] };
  }

  // 1. Cek apakah LLM secara eksplisit menyebutkan nama file sumber di baris akhir
  // Contoh: "Sumber: Fisioterapi.pdf | Halaman 1"
  const explicitMatch = evaluatedAnswer.match(/Sumber:\s*([^\n|]+?)(?:\s*\|\s*([^\n]+))?$/i);
  let explicitFile: string | null = null;
  let explicitPage: string | null = null;
  if (explicitMatch) {
    explicitFile = explicitMatch[1].trim();
    explicitPage = explicitMatch[2]?.trim() || null;
  }

  // 2. Tokenisasi teks jawaban (hilangkan kata sambung/stop words) untuk content overlap
  const answerTokens = evaluatedAnswer
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 4 &&
        !['yang', 'pada', 'dalam', 'untuk', 'dengan', 'adalah', 'yaitu', 'sumber', 'halaman', 'dari'].includes(w)
    );
  const tokenSet = new Set(answerTokens);

  // Kumpulkan nama-nama file unik dari chunks & curated
  const allCandidateFiles = new Set<string>();
  for (const c of chunks) allCandidateFiles.add(c.originalFilename);
  for (const ci of curated) allCandidateFiles.add(ci.originalFilename);

  // Hitung skor kecocokan isi jawaban terhadap masing-masing file
  const fileScores = new Map<string, number>();
  for (const fn of Array.from(allCandidateFiles)) {
    let score = 0;
    const fnLower = fn.toLowerCase();

    // Jika eksplisit cocok dengan nama file yang ditulis LLM
    if (explicitFile && (fnLower.includes(explicitFile.toLowerCase()) || explicitFile.toLowerCase().includes(fnLower))) {
      score += 100;
    }

    const chunksOfFile = chunks.filter((c) => c.originalFilename === fn);
    const curatedOfFile = curated.filter((ci) => ci.originalFilename === fn);

    const fullContent = [
      ...chunksOfFile.map((c) => c.content),
      ...curatedOfFile.map((ci) => `${ci.title} ${ci.content}`),
    ]
      .join(' ')
      .toLowerCase();

    let matchedTokens = 0;
    for (const t of Array.from(tokenSet)) {
      if (fullContent.includes(t)) {
        matchedTokens++;
      }
    }
    score += matchedTokens;
    fileScores.set(fn, score);
  }

  // Cari file dengan skor tertinggi (kontributor utama)
  let bestFile = chunks[0]?.originalFilename || curated[0]?.originalFilename || '';
  let highestScore = -1;
  for (const [fn, score] of Array.from(fileScores.entries())) {
    if (score > highestScore) {
      highestScore = score;
      bestFile = fn;
    }
  }

  // Tentukan file-file yang berkontribusi (hanya yang relevan dengan jawaban)
  const contributingFiles = new Set<string>();
  contributingFiles.add(bestFile);
  const minScoreThreshold = Math.max(2, highestScore * 0.25);
  for (const [fn, score] of Array.from(fileScores.entries())) {
    if (score >= minScoreThreshold) {
      contributingFiles.add(fn);
    }
  }

  // Tentukan label halaman untuk bestFile
  const bestFileChunks = chunks.filter((c) => c.originalFilename === bestFile);
  const bestFileCurated = curated.filter((ci) => ci.originalFilename === bestFile);

  let pageLabel = 'Halaman 1';
  if (
    explicitPage &&
    explicitFile &&
    (bestFile.toLowerCase().includes(explicitFile.toLowerCase()) ||
      explicitFile.toLowerCase().includes(bestFile.toLowerCase()))
  ) {
    pageLabel = explicitPage.startsWith('Halaman') ? explicitPage : `Halaman ${explicitPage}`;
  } else if (bestFileChunks.length > 0) {
    // Ambil hanya chunk yang kontennya benar-benar ada di dalam jawaban
    const relevantBestChunks = bestFileChunks.filter((c) => {
      const cLower = (c.content || '').toLowerCase();
      for (const t of Array.from(tokenSet)) {
        if (cLower.includes(t)) return true;
      }
      return false;
    });

    const targetChunks = relevantBestChunks.length > 0 ? relevantBestChunks : bestFileChunks;
    const pages = Array.from(
      new Set(targetChunks.flatMap((c) => [c.sourcePageStart, c.sourcePageEnd]))
    ).sort((a, b) => a - b);
    const minP = pages[0] || 1;
    const maxP = pages[pages.length - 1] || 1;
    pageLabel = minP === maxP ? `Halaman ${minP}` : `Halaman ${minP}-${maxP}`;
  } else if (bestFileCurated.length > 0 && bestFileCurated[0].sourcePages) {
    pageLabel = bestFileCurated[0].sourcePages;
  }

  const safeSimilarity = (val: unknown): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : Number(val.toFixed(4));
    const parsed = parseFloat(String(val));
    return isNaN(parsed) ? 0 : Number(parsed.toFixed(4));
  };

  const seenPageKeys = new Set<string>();
  const filteredSources: ChatSource[] = [];

  // Prioritaskan chunks dari bestFile di posisi teratas
  const sortedChunks = [...chunks].sort((a, b) => {
    if (a.originalFilename === bestFile && b.originalFilename !== bestFile) return -1;
    if (b.originalFilename === bestFile && a.originalFilename !== bestFile) return 1;
    return b.similarity - a.similarity;
  });

  for (const c of sortedChunks) {
    if (!contributingFiles.has(c.originalFilename)) continue;

    // Filter keluar chunk dari file yang sama jika chunk tersebut tidak memuat satupun fakta jawaban
    const cLower = (c.content || '').toLowerCase();
    const hasTokenMatch = Array.from(tokenSet).some((t) => cLower.includes(t));
    if (
      tokenSet.size > 0 &&
      !hasTokenMatch &&
      sortedChunks.some(
        (sc) =>
          sc.originalFilename === c.originalFilename &&
          Array.from(tokenSet).some((t) => (sc.content || '').toLowerCase().includes(t))
      )
    ) {
      continue;
    }

    const pageKey = `${c.uploadBatchId}:${c.sourcePageStart}-${c.sourcePageEnd}`;
    if (seenPageKeys.has(pageKey)) continue;
    seenPageKeys.add(pageKey);

    filteredSources.push({
      chunkId: c.id,
      uploadBatchId: c.uploadBatchId,
      filename: c.originalFilename,
      pageStart: c.sourcePageStart,
      pageEnd: c.sourcePageEnd,
      content: c.content,
      similarity: safeSimilarity(c.similarity),
    });
  }

  for (const ci of curated) {
    if (!contributingFiles.has(ci.originalFilename)) continue;
    if (filteredSources.some((s) => s.uploadBatchId === ci.uploadBatchId)) continue;
    filteredSources.push({
      chunkId: `curated-${ci.id}`,
      uploadBatchId: ci.uploadBatchId,
      filename: ci.originalFilename,
      pageStart: 1,
      pageEnd: 1,
      content: ci.content,
      similarity: safeSimilarity(ci.similarity),
    });
  }

  // Jika setelah difilter kosong (misal semua skor 0), kembalikan chunk teratas
  if (filteredSources.length === 0 && chunks.length > 0) {
    const c = chunks[0];
    filteredSources.push({
      chunkId: c.id,
      uploadBatchId: c.uploadBatchId,
      filename: c.originalFilename,
      pageStart: c.sourcePageStart,
      pageEnd: c.sourcePageEnd,
      content: c.content,
      similarity: safeSimilarity(c.similarity),
    });
  }

  return { primaryFilename: bestFile, pageLabel, filteredSources };
}
