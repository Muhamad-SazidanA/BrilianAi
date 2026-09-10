export interface EmbeddingClientOptions {
  model?: string;
  dimensions?: number;
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY tidak ditemukan di environment variables.');
  }

  const model = options?.model || process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  const dimensions = options?.dimensions || Number(process.env.EMBEDDING_DIM) || 1024;

  // OpenAI supports max 2048 inputs per batch
  const BATCH_SIZE = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const chunkBatch = texts.slice(i, i + BATCH_SIZE);
    
    // Replace newline noise with spaces as recommended by OpenAI embedding guidelines
    const sanitizedBatch = chunkBatch.map((t) => (t || '').replace(/\r\n|\r|\n/g, ' ').trim());

    let attempt = 0;
    const maxRetries = 3;
    let delay = 1000;
    let success = false;

    while (attempt <= maxRetries && !success) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

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
          console.error(`[Agent 2: Embedding] Gagal total membuat embedding batch: ${error?.message}`);
          throw error;
        }
      }
    }
  }

  return allEmbeddings;
}
