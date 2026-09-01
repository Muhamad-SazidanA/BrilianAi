import { OllamaEmbeddings } from '@langchain/ollama';

export interface EmbeddingClientOptions {
  model?: string;
  baseUrl?: string;
}

/**
 * Generates vector embeddings for a batch of text strings using Ollama (model: bge-m3, 1024 dimensions).
 *
 * Calls Ollama in a single batch request via embedDocuments(texts) rather than one by one.
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

  const client = new OllamaEmbeddings({
    model,
    baseUrl,
  });

  const embeddings = await client.embedDocuments(texts);
  return embeddings;
}
