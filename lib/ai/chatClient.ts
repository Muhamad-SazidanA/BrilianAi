import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';

// Configure Node.js undici dispatcher timeout to allow long AI/LLM inferences
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

export interface ChatClientOptions {
  model?: string;
  baseUrl?: string;
  temperature?: number;
}

export const SYSTEM_STRICT_PROMPT = `Anda adalah asisten AI cerdas untuk analisis dokumen.
TUGAS UTAMA: Jawab pertanyaan pengguna HANYA berdasarkan konteks dokumen (chunks) yang disediakan di bawah ini.

ATURAN KETAT:
1. HANYA gunakan informasi yang secara eksplisit ada di dalam KONTEKS DOKUMEN.
2. DILARANG menggunakan pengetahuan eksternal atau mengarang informasi (halusinasi).
3. Jika informasi tidak ditemukan dalam konteks dokumen, jawab dengan jujur dan sopan: "Maaf, informasi tersebut tidak ditemukan dalam dokumen yang diunggah."
4. Sertakan referensi nomor halaman asal informasi jika relevan.
5. Gunakan bahasa Indonesia yang jelas, profesional, dan mudah dipahami.`;

export const SYSTEM_PUBLIC_PROMPT = `Anda adalah asisten AI cerdas serbaguna.
TUGAS UTAMA: Jawab pertanyaan pengguna dengan memprioritaskan konteks dokumen yang diberikan.

ATURAN KERJA:
1. UTAMAKAN informasi yang terdapat di dalam KONTEKS DOKUMEN.
2. Jika konteks dokumen TIDAK MEMILIKI informasi yang cukup atau pertanyaan bersifat umum/pengetahuan publik, Anda DIIZINKAN menggunakan pengetahuan umum Anda untuk memberikan jawaban lengkap.
3. Berikan penandaan yang jelas antara bagian yang bersumber dari DOKUMEN dan bagian yang bersumber dari PENGETAHUAN UMUM.
4. Gunakan bahasa Indonesia yang jelas, profesional, dan terstruktur.`;

/**
 * Generates an AI response using Llama 3.2 (3B) text model via Ollama.
 *
 * @param query - User question
 * @param contextText - Formatted chunks context from vector store
 * @param allowPublicKnowledge - If false, enforces strict grounding on document context only
 * @param options - Client options (model, baseUrl, temperature)
 * @returns Promise<string> - AI generated response text
 */
export async function generateChatResponse(
  query: string,
  contextText: string,
  allowPublicKnowledge: boolean = false,
  options?: ChatClientOptions
): Promise<string> {
  const model =
    options?.model ||
    process.env.CHAT_MODEL_NAME ||
    process.env.CHAT_MODEL ||
    'gemma2:2b';

  const baseUrl =
    options?.baseUrl ||
    process.env.OLLAMA_ENDPOINT ||
    process.env.OLLAMA_BASE_URL ||
    'http://localhost:11434';

  const temperature = options?.temperature ?? (allowPublicKnowledge ? 0.3 : 0.0);

  const systemPrompt = allowPublicKnowledge ? SYSTEM_PUBLIC_PROMPT : SYSTEM_STRICT_PROMPT;

  const userMessageContent = `--- KONTEKS DOKUMEN ---
${contextText || '(Tidak ada konteks dokumen yang ditemukan)'}
-----------------------

PERTANYAAN PENGGUNA:
${query}`;

  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    new HumanMessage(userMessageContent),
  ];

  const client = new ChatOllama({
    model,
    baseUrl,
    temperature,
  });

  const response = await client.invoke(messages);
  return typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content);
}
