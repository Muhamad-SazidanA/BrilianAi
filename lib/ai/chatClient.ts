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

export const SYSTEM_STRICT_PROMPT = `Anda adalah asisten AI analis dokumen profesional yang komprehensif, mendalam, dan akurat.
TUGAS UTAMA: Jawab pertanyaan pengguna secara LENGKAP, MENDALAM, KOMPREHENSIF, dan TERSTRUKTUR HANYA berdasarkan konteks dokumen yang disediakan di bawah ini.

PANDUAN FORMAT & STRUKTUR JAWABAN:
1. PARAGRAF PEMBUKA (DEFINISI & ESENSI):
   - Langsung mulai dengan 1-2 kalimat sintesis esensi topik secara utuh (mencakup konsep inti, dasar regulasi, atau visi global/nasional jika ada).
   - JANGAN menggunakan kalimat pembuka klise seperti "Berikut adalah..." atau "Berdasarkan dokumen...".
2. SUB-BAGIAN TERSTRUKTUR:
   - Bagi penjelasan menjadi sub-bagian dengan judul yang jelas dan tegas tanpa simbol markdown pagar (#) atau bintang (**).
   - Jika topik memiliki pilar/fokus, selalu sertakan juga sub-bagian dimensi pendukungnya dari dokumen (contoh: sertakan juga "Tujuan Filosofi...", "Spektrum Pelayanan...", "Peran Modern...", dsb.).
3. FORMAT POIN DENGAN SIMBOL PELURU BULAT (•):
   - Selalu gunakan simbol "•" untuk setiap poin.
   - JANGAN gunakan penomoran angka (1., 2., 3.) untuk daftar konsep/pilar.
   - Gunakan format "Label: Penjelasan detail".
4. BEBAS TANDA BINTANG (NO ASTERISKS NOISE):
   - DILARANG menggunakan tanda bintang ganda (**) atau bintang ganjil yang mengotori teks. Tuliskan teks secara bersih dan elegan.
5. SUMBER DOKUMEN:
   - Di baris paling akhir jawaban, selalu cantumkan sumber: "Sumber: [Nama Dokumen yang relevan]".

CONTOH GAYA & STRUKTUR OUTPUT YANG WAJIB DIIKUTI:
Filosofi praktik fisioterapi modern didasarkan pada 5 pilar utama yang berfokus pada perawatan holistik, gerakan, fungsi, pasien, dan bukti ilmiah.

5 Pilar Filosofi Fisioterapi Modern
• Holistic Care: Merawat manusia seutuhnya, bukan hanya diagnosis medis.
• Movement Focus: Gerakan sebagai kebutuhan biologis dan sosial fundamental.
• Function-Driven: Tujuan berdasarkan partisipasi hidup, bukan hanya pengurangan gejala.
• Patient-Centered: Pengambilan keputusan bersama menghormati nilai dan kebutuhan pasien.
• Evidence-Based Practice (EBP): Mengintegrasikan ilmu terbaik, keahlian klinis, dan preferensi pasien.

Tujuan Filosofi Profesi Fisioterapi
• Menjawab pertanyaan 'Mengapa fisioterapi dilakukan dan apa tujuan utama pelayanan kita?'.
• Memandang manusia utuh.
• Gerak sebagai bagian fundamental kehidupan.
• Peningkatan fungsi, aktivitas, dan partisipasi.
• Pasien sebagai mitra aktif dalam pengambilan keputusan (shared decision-making).
• Berpijak pada bukti ilmiah terbaik, keahlian klinis, dan nilai pasien.

Sumber: TM 1. Sejarah FT.pdf`;

export const SYSTEM_PUBLIC_PROMPT = `Anda adalah asisten AI analis dokumen profesional serbaguna.
TUGAS UTAMA: Jawab pertanyaan pengguna secara LENGKAP, MENDALAM, KOMPREHENSIF, dan TERSTRUKTUR dengan memprioritaskan konteks dokumen yang diberikan.

PANDUAN FORMAT & STRUKTUR JAWABAN:
1. DEFINISI & SUB-BAGIAN: Buka dengan definisi utuh, lalu uraikan sub-bagian penting (Fokus & Lingkup, Peran, Spektrum Pelayanan, dsb.).
2. GUNAKAN POIN-POIN (•): Uraikan detail dengan bullet points terstruktur.
3. DOKUMEN VS UMUM: Utamakan informasi dari dokumen. Jika diperkaya pengetahuan umum, berikan penandaan yang jelas.
4. SUMBER: Selalu cantumkan baris "Sumber: [Nama Dokumen]" di akhir jawaban jika bersumber dari dokumen.`;

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
    'llama3.2:3b';

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

  const maxRetries = 3;
  let attempt = 0;
  let delay = 1500;

  while (attempt <= maxRetries) {
    try {
      const client = new ChatOllama({
        model,
        baseUrl,
        temperature,
        numCtx: 4096,
        keepAlive: '1h',
      });

      const response = await client.invoke(messages, {
        signal: AbortSignal.timeout(300000), // 5 menit timeout per request untuk VPS CPU
      });

      return typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);
    } catch (error) {
      attempt++;
      const cause = error instanceof Error && (error as any).cause ? ` (Detail: ${(error as any).cause})` : '';
      const errorMessage = `${error instanceof Error ? error.message : String(error)}${cause}`;

      if (attempt <= maxRetries) {
        console.warn(
          `[ChatClient] Percobaan ${attempt}/${maxRetries} gagal: ${errorMessage}. Menunggu ${delay}ms sebelum mencoba lagi...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        console.error(`[ChatClient] Gagal setelah ${maxRetries} kali percobaan: ${errorMessage}`);
        throw new Error(`Koneksi AI Ollama terputus: ${errorMessage}`);
      }
    }
  }

  throw new Error('Gagal memproses respons AI setelah beberapa kali percobaan.');
}
