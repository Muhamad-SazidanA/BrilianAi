import { OllamaEmbeddings } from '@langchain/ollama';

export interface EmbeddingClientOptions {
  model?: string;
  dimensions?: number;
}

// In-memory cache for query embeddings to avoid repeat embedding API round-trips
const queryEmbeddingCache = new Map<string, number[]>();
const MAX_QUERY_EMBED_CACHE = 1000;

export function clearQueryEmbeddingCache(): void {
  queryEmbeddingCache.clear();
}

/**
 * Agent 2: Embedding & Indexing Agent (serta Vektor Search)
 * Menghasilkan representasi vektor semantik berdimensi 1024 menggunakan
 * OpenAI text-embedding-3-small (dengan Matryoshka Representation Learning dimension reduction: 1024).
 *
 * @param texts - Array potongan teks (chunks) atau query pencarian
 * @param options - Konfigurasi model & dimensi
 * @returns Promise<number[][]> - Array vektor embedding 1024-dimensi
 */
export async function embedTexts(
  texts: string[],
  options?: EmbeddingClientOptions
): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  const model = options?.model || process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  const dimensions = options?.dimensions || Number(process.env.EMBEDDING_DIM) || 1024;

  const isSingleQuery = texts.length === 1;
  const singleQueryText = isSingleQuery ? (texts[0] || '').trim() : '';
  const cacheKey = `${model}:${dimensions}:${singleQueryText}`;

  if (isSingleQuery && singleQueryText && queryEmbeddingCache.has(cacheKey)) {
    return [queryEmbeddingCache.get(cacheKey)!];
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const useOllamaExplicit = process.env.EMBEDDING_PROVIDER === 'ollama';

  const runOllamaFallback = async (): Promise<number[][]> => {
    try {
      let baseUrl = process.env.OLLAMA_ENDPOINT || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      if (baseUrl.includes('//ollama:') && !process.env.DOCKER_CONTAINER) {
        baseUrl = baseUrl.replace('//ollama:', '//localhost:');
      }
      const client = new OllamaEmbeddings({
        model: process.env.EMBEDDING_MODEL_NAME || 'bge-m3',
        baseUrl,
      });
      const vectors = await client.embedDocuments(texts);
      if (isSingleQuery && vectors[0]) {
        queryEmbeddingCache.set(cacheKey, vectors[0]);
      }
      return vectors;
    } catch {
      return texts.map(() => new Array(dimensions).fill(0.01));
    }
  };

  if (!apiKey || useOllamaExplicit) {
    return await runOllamaFallback();
  }

  // OpenAI supports max 2048 inputs per batch
  const BATCH_SIZE = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const chunkBatch = texts.slice(i, i + BATCH_SIZE);
    
    // Replace newline noise with spaces as recommended by OpenAI embedding guidelines
    const sanitizedBatch = chunkBatch.map((t) => (t || '').replace(/\r\n|\r|\n/g, ' ').trim());

    let attempt = 0;
    const maxRetries = 2;
    let delay = 1000;
    let success = false;

    while (attempt <= maxRetries && !success) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            input: sanitizedBatch,
            dimensions,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          // Jika kuota OpenAI habis (429) atau API Key kedaluwarsa (401), langsung alihkan ke Ollama bge-m3
          if (response.status === 429 || response.status === 401) {
            console.warn(
              `[Agent 2: Embedding] OpenAI kuota habis/error (HTTP ${response.status}). Mengalihkan otomatis ke Ollama bge-m3...`
            );
            return await runOllamaFallback();
          }
          throw new Error(`OpenAI Embedding API error HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        if (data && data.data && Array.isArray(data.data)) {
          // Sort by index to maintain exact original ordering
          const sorted = data.data.sort((a: any, b: any) => a.index - b.index);
          const batchVectors = sorted.map((item: any) => item.embedding as number[]);
          allEmbeddings.push(...batchVectors);
          success = true;
        } else {
          throw new Error('Format response OpenAI embedding tidak terduga.');
        }
      } catch (error: any) {
        attempt++;
        if (attempt <= maxRetries) {
          console.warn(
            `[Agent 2: Embedding] Percobaan ${attempt}/${maxRetries} gagal: ${error?.message}. Menunggu ${delay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          console.warn(`[Agent 2: Embedding] OpenAI gagal (${error?.message}). Mengalihkan otomatis ke Ollama bge-m3...`);
          return await runOllamaFallback();
        }
      }
    }
  }

  if (isSingleQuery && allEmbeddings[0]) {
    if (queryEmbeddingCache.size >= MAX_QUERY_EMBED_CACHE) {
      const oldestKey = queryEmbeddingCache.keys().next().value;
      if (oldestKey) queryEmbeddingCache.delete(oldestKey);
    }
    queryEmbeddingCache.set(cacheKey, allEmbeddings[0]);
  }

  return allEmbeddings;
}
