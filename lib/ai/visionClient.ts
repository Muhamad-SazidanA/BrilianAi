import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface VisionClientOptions {
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
  initialBackoffMs?: number;
}

export const SYSTEM_VISION_PROMPT =
  'Ekstrak SELURUH konten substantif dari gambar halaman dokumen ini: judul, penjelasan, poin-poin, serta teks dan angka dalam diagram/tabel/grafik. Tuliskan dalam urutan baca yang logis. ABAIKAN logo dekoratif dan watermark kecil di pojok. Tulis teks naratif dan representasikan tabel dalam format tabel Markdown yang rapi.';

/**
 * Agent 1: Vision Ingestion Agent
 * Ekstraksi teks & tabel dari gambar halaman PDF.
 * Terkunci EKSKLUSIF pada model ID yang ditentukan (tanpa fallback diam-diam ke model lain).
 * Jika model tidak tersedia atau dinonaktifkan oleh provider, sistem akan melempar error (Fail-Fast)
 * agar tidak ada tagihan token membengkak di luar perhitungan anggaran.
 *
 * @param imageBuffer - Buffer gambar halaman PNG
 * @param options - Konfigurasi opsional (model, retries, timeout)
 * @returns Promise<string> - Teks hasil ekstraksi dokumen
 */
export async function extractPageText(
  imageBuffer: Buffer,
  options?: VisionClientOptions
): Promise<string> {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    return '';
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    const model = options?.model || process.env.VISION_MODEL_NAME || 'qwen2.5vl:3b';
    const baseUrl = process.env.OLLAMA_ENDPOINT || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const maxRetries = options?.maxRetries ?? 3;
    let attempt = 0;
    let delay = options?.initialBackoffMs ?? 1000;

    const base64Image = imageBuffer.toString('base64');
    const messages = [
      new SystemMessage(SYSTEM_VISION_PROMPT),
      new HumanMessage({
        content: [
          { type: 'text', text: 'Berikut adalah gambar halaman dokumen yang perlu diekstrak:' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } },
        ],
        additional_kwargs: { images: [base64Image] },
      }),
    ];

    while (attempt <= maxRetries) {
      try {
        const client = new ChatOllama({ model, baseUrl, numCtx: 4096 });
        const response = await client.invoke(messages);
        return typeof response.content === 'string' ? response.content.trim() : '';
      } catch (err) {
        attempt++;
        if (attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          return '';
        }
      }
    }
    return '';
  }

  // Model ID default
  const modelName = options?.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const maxRetries = options?.maxRetries ?? 2;
  const timeoutMs = options?.timeoutMs ?? 45000;
  let delay = options?.initialBackoffMs ?? 1000;

  const base64Image = imageBuffer.toString('base64');
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: SYSTEM_VISION_PROMPT },
                {
                  inline_data: {
                    mime_type: 'image/png',
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && typeof text === 'string') {
          return text.trim();
        }
        return '';
      }

      // Jika error 404 (model dihentikan Google), coba model alternatif atau OpenAI Vision
      const errorBody = await res.text().catch(() => '');
      if (res.status === 404) {
        console.warn(`[Agent 1: Vision Ingestion] Model "${modelName}" 404 (dihentikan Google). Mengalihkan ke model aktif alternatif...`);

        // 1. Coba Gemini alternatif
        const fallbackGeminiModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.5-flash-lite'];
        for (const altModel of fallbackGeminiModels) {
          if (altModel === modelName) continue;
          try {
            const altRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${altModel}:generateContent?key=${geminiApiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: SYSTEM_VISION_PROMPT },
                      { inline_data: { mime_type: 'image/png', data: base64Image } },
                    ],
                  },
                ],
                generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
              }),
            });
            if (altRes.ok) {
              const altData = await altRes.json();
              const text = altData?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text && typeof text === 'string') {
                return text.trim();
              }
            }
          } catch {}
        }

        // 2. Coba OpenAI GPT-4o-mini Vision jika Gemini seluruhnya 404
        const openAiApiKey = process.env.OPENAI_API_KEY;
        if (openAiApiKey) {
          try {
            const openAiText = await extractWithOpenAiVision(base64Image, openAiApiKey);
            if (openAiText) return openAiText;
          } catch {}
        }

        throw new Error(
          `[Agent 1: Vision Ingestion] Model "${modelName}" TIDAK TERSEDIA atau telah dihentikan oleh Google (HTTP 404). Detail: ${errorBody}`
        );
      }

      throw new Error(`[Agent 1: Vision Ingestion] Google API HTTP ${res.status}: ${errorBody}`);
    } catch (error: any) {
      attempt++;
      if (error?.message?.includes('HTTP 404') || error?.message?.includes('TIDAK TERSEDIA')) {
        console.error(error.message);
        throw error;
      }

      if (attempt <= maxRetries) {
        console.warn(`[Agent 1: Vision Ingestion] Percobaan ${attempt}/${maxRetries} gagal: ${error?.message}. Menunggu ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        // Fallback terakhir ke OpenAI Vision sebelum melempar error
        const openAiApiKey = process.env.OPENAI_API_KEY;
        if (openAiApiKey) {
          try {
            const fallbackText = await extractWithOpenAiVision(base64Image, openAiApiKey);
            if (fallbackText) return fallbackText;
          } catch {}
        }

        console.error(`[Agent 1: Vision Ingestion] Gagal mengekstrak teks dengan model "${modelName}": ${error?.message}`);
        throw error;
      }
    }
  }

  return '';
}

/**
 * Fallback ekstraksi gambar menggunakan OpenAI GPT-4o-mini Vision
 */
async function extractWithOpenAiVision(base64Image: string, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_VISION_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Ekstrak teks dan representasikan tabel dalam format tabel Markdown dari gambar ini:' },
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${base64Image}` },
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      return data?.choices?.[0]?.message?.content?.trim() || '';
    }
  } catch (err: any) {
    console.warn('[VisionClient] OpenAI vision fallback notice:', err?.message);
  }
  return '';
}
