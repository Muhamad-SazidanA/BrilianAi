import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface VisionClientOptions {
  model?: string;
  baseUrl?: string;
  maxRetries?: number;
  timeoutMs?: number;
  initialBackoffMs?: number;
}

export const SYSTEM_VISION_PROMPT =
  'Ekstrak SELURUH konten substantif dari gambar halaman dokumen ini: judul, penjelasan, poin-poin, teks dalam diagram/tabel/kotak. Tuliskan dalam urutan baca yang logis. ABAIKAN logo, watermark kecil yang berulang di pojok/footer, nomor halaman, dan elemen dekoratif murni. Tulis sebagai teks naratif yang mengalir, BUKAN daftar mentah per elemen visual.';

/**
 * Extracts substantive text from a page image Buffer using Ollama AI Vision (Qwen2.5-VL).
 *
 * - Sends the image as base64 in the message payload.
 * - Applies exponential backoff retry (up to 3x) on failure/timeout.
 * - Enforces a 60-second timeout per attempt.
 * - Returns an empty string on complete failure rather than throwing, to protect batch ingestion.
 *
 * @param imageBuffer - In-memory Buffer of the page PNG image
 * @param options - Optional client configuration (baseUrl, model, retries, etc.)
 * @returns Promise<string> - Extracted text content or empty string on failure
 */
export async function extractPageText(
  imageBuffer: Buffer,
  options?: VisionClientOptions
): Promise<string> {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    return '';
  }

  const model =
    options?.model ||
    process.env.VISION_MODEL_NAME ||
    process.env.VISION_MODEL ||
    'qwen2.5vl:3b';
  const baseUrl =
    options?.baseUrl ||
    process.env.OLLAMA_ENDPOINT ||
    process.env.OLLAMA_BASE_URL ||
    'http://localhost:11434';
  const maxRetries = options?.maxRetries ?? 3;
  const timeoutMs = options?.timeoutMs ?? 60000;
  const initialBackoffMs = options?.initialBackoffMs ?? 500;

  const base64Image = imageBuffer.toString('base64');

  const messages = [
    new SystemMessage(SYSTEM_VISION_PROMPT),
    new HumanMessage({
      content: [
        {
          type: 'text',
          text: 'Berikut adalah gambar halaman dokumen yang perlu diekstrak:',
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${base64Image}`,
          },
        },
      ],
      additional_kwargs: {
        images: [base64Image],
      },
    }),
  ];

  let attempt = 0;
  let delay = initialBackoffMs;

  while (attempt <= maxRetries) {
    try {
      const client = new ChatOllama({
        model,
        baseUrl,
        numCtx: 8192,
      });

      const response = await client.invoke(messages, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      const content = response.content;

      if (typeof content === 'string') {
        return content.trim();
      } else if (Array.isArray(content)) {
        return content
          .map((c) => (typeof c === 'string' ? c : 'text' in c ? (c as { text: string }).text : ''))
          .join('\n')
          .trim();
      }

      return String(content || '').trim();
    } catch (error) {
      attempt++;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (attempt <= maxRetries) {
        console.warn(
          `[VisionClient] Percobaan ${attempt}/${maxRetries} gagal: ${errorMessage}. Menunggu ${delay}ms sebelum mencoba lagi...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // exponential backoff
      } else {
        console.error(
          `[VisionClient] Gagal mengekstrak teks setelah ${maxRetries} kali percobaan: ${errorMessage}. Mengembalikan string kosong.`
        );
      }
    }
  }

  return '';
}
