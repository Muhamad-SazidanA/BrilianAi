import { OllamaEmbeddings } from '@langchain/ollama';

// Configure Node.js undici dispatcher timeout to allow long AI/LLM inferences without UND_ERR_HEADERS_TIMEOUT
try {
  const { setGlobalDispatcher, Agent } = require('undici');
  setGlobalDispatcher(
    new Agent({
      headersTimeout: 600000, // 10 menit
      bodyTimeout: 600000,
      connectTimeout: 60000,
    })
  );
} catch {
  // Ignore if undici is not directly loaded in current environment
}

export interface EmbeddingClientOptions {
  model?: string;
  baseUrl?: string;
}

/**
 * Generates vector embeddings for a batch of text strings using Ollama (model: bge-m3, 1024 dimensions).
 *
 * @param texts - Array of string chunks to embed
 * @param options - Optional configuration (baseUrl, model)
 * @returns Promise<number[][]> - Array of 1024-dimensional embedding vectors
 */
export async function embedTexts(
  texts: string[],
  options?: EmbeddingClientOptions
): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  const model = options?.model || 'bge-m3';
  const baseUrl =
    options?.baseUrl ||
    process.env.OLLAMA_ENDPOINT ||
    process.env.OLLAMA_BASE_URL ||
    'http://localhost:11434';

  const maxRetries = 2;
  let attempt = 0;
  let delay = 1000;

  while (attempt <= maxRetries) {
    try {
      const client = new OllamaEmbeddings({
        model,
        baseUrl,
      });

      const embeddings = await client.embedDocuments(texts);
      return embeddings;
    } catch (error) {
      attempt++;
      const cause = error instanceof Error && (error as any).cause ? ` (Detail: ${(error as any).cause})` : '';
      const errorMessage = `${error instanceof Error ? error.message : String(error)}${cause}`;

      if (attempt <= maxRetries) {
        console.warn(
          `[EmbeddingClient] Percobaan ${attempt}/${maxRetries} gagal: ${errorMessage}. Menunggu ${delay}ms sebelum mencoba lagi...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        console.error(`[EmbeddingClient] Gagal setelah ${maxRetries} kali percobaan: ${errorMessage}`);
        throw error;
      }
    }
  }

  return [];
}
