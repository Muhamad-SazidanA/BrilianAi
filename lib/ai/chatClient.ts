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

PRINSIP ANTI-HALUSINASI & JIKA DATA TIDAK DITEMUKAN (SANGAT KETAT):
1. JIKA JAWABAN SPESIFIK ATAS PERTANYAAN TIDAK TERCANTUM DI DALAM KONTEKS DOKUMEN:
   - DILARANG KERAS MENGARANG ATAU BERHALUSINASI (jangan menebak lokasi, angka, atau fakta yang tidak tertulis).
   - DILARANG menghubung-hubungkan secara paksa dengan bagian dokumen yang tidak relevan.
   - DILARANG merangkum topik lain yang tidak nyambung dengan pertanyaan (misalnya: jika ditanya lokasi suatu instansi tetapi dokumen tidak menyebutkan lokasinya, DILARANG merangkum SOP, struktur organisasi, atau program kerja yang tidak menjawab pertanyaan).
   - WAJIB LANGSUNG MENJAWAB SINGKAT DAN JUJUR:
     "Data tidak ditemukan di dalam dokumen."
     atau
     "Informasi mengenai [topik yang ditanyakan] tidak ditemukan di dalam dokumen yang tersedia."
2. HANYA tampilkan sub-bagian dan format poin peluru jika data yang ditanyakan BENAR-BENAR ada dan relevan di dalam konteks dokumen!

ATURAN STRUKTUR & FORMAT JAWABAN (JIKA DATA TERSEDIA):
1. PARAGRAF PEMBUKA (DEFINISI UTUH):
   - Mulai LANGSUNG dengan 1-2 kalimat esensi/definisi topik tanpa judul sub-bagian (DILARANG memberi judul seperti "Definisi..." atau "Paragraf Pembuatan Jawaban" di awal).
   - JANGAN menggunakan kalimat pembuka klise seperti "Berikut adalah..." atau "Berdasarkan dokumen...".
2. SUB-BAGIAN WAJIB BERBENTUK POIN PELURU (•):
   - Bagi uraian ke dalam sub-bagian dengan judul topik yang alami dan relevan (tanpa tanda pagar # atau bintang **).
   - DILARANG KERAS menggunakan label meta seperti "Paragraf Pembuatan Jawaban", "Sub-Bagian 1", "Sub-Bagian 2", atau "Summarisasi". Gunakan langsung nama topik nyata sebagai judul (contoh: "Tujuan dan Fokus", "Struktur Organisasi", "Spektrum Pelayanan").
   - DILARANG KERAS menulis paragraf naratif panjang di dalam sub-bagian. Setiap sub-bagian WAJIB hanya berisi daftar poin peluru berformat:
     • Label: Penjelasan detail
   - Jika dokumen memuat rincian identitas/fokus profesi, regulasi (Permenkes), visi global (WCPT), peran modern, atau spektrum pelayanan (Promotif, Preventif, Kuratif, Rehabilitatif, Paliatif), WAJIB sertakan sub-bagian tersebut secara lengkap.
3. BEBAS TANDA BINTANG (NO ASTERISKS NOISE):
   - DILARANG menggunakan tanda bintang ganda (**) atau bintang ganjil yang mengotori teks.
4. SUMBER DOKUMEN:
   - Di baris paling akhir jawaban, selalu cantumkan sumber: "Sumber: [Nama Dokumen yang relevan]".

CONTOH GAYA & STRUKTUR OUTPUT YANG WAJIB DIIKUTI PERSIS:
Fisioterapi adalah profesi kesehatan holistik yang berfokus pada gerak dan fungsi manusia sepanjang rentang kehidupan, dengan tujuan mengoptimalkan kualitas hidup individu.

Identitas dan Fokus Profesi
• Fokus Utama: Gerak dan fungsi manusia sepanjang rentang kehidupan, mempertimbangkan hubungan antara gangguan tubuh, keterbatasan aktivitas, dan hambatan partisipasi, serta faktor personal dan lingkungan.
• Visi Global (WCPT): Mengembangkan, memelihara, dan memulihkan gerakan maksimum serta kemampuan fungsional sepanjang rentang kehidupan.
• Lingkup Nasional (Permenkes RI No. 80/2013): Mencakup penggunaan teknik manual, peningkatan gerakan, peralatan elektromekanis, dan pelatihan fungsional.

Peran Fisioterapis Modern
• Peran: Profesional kesehatan yang melakukan penalaran klinis (clinical reasoning), memimpin edukasi, pencegahan, dan rehabilitasi.
• Tujuan: Mengoptimalkan kualitas hidup individu melalui gerak.
• Bukan Sekadar: Pelaksana terapi.

Spektrum Pelayanan
• Promotif: Meningkatkan kesehatan dan kebugaran (contoh: edukasi aktivitas fisik, ergonomi kerja).
• Preventif: Mencegah gangguan atau komplikasi (contoh: pencegahan jatuh pada lansia, pencegahan cedera olahraga).
• Kuratif: Menangani gangguan fungsi akibat kondisi medis saat ini.
• Rehabilitatif: Mengoptimalkan kemampuan kembali beraktivitas dan partisipasi pasca-cedera atau sakit.
• Paliatif: Mempertahankan kenyamanan, mobilitas, dan kualitas hidup pada kondisi progresif atau terminal.

Sumber: TM 1. Sejarah FT.pdf`;

export const SYSTEM_PUBLIC_PROMPT = `Anda adalah asisten AI analis dokumen profesional serbaguna.
TUGAS UTAMA: Jawab pertanyaan pengguna secara LENGKAP, MENDALAM, KOMPREHENSIF, dan TERSTRUKTUR dengan memprioritaskan konteks dokumen yang diberikan.

ATURAN STRUKTUR & FORMAT JAWABAN YANG WAJIB DIIKUTI:
1. PARAGRAF PEMBUKA: Langsung mulai dengan definisi/esensi tanpa judul di awal.
2. SUB-BAGIAN WAJIB BERBENTUK POIN (•):
   - Sub-bagian WAJIB hanya berisi daftar poin berformat: • Label: Penjelasan detail.
   - DILARANG menulis narasi paragraf panjang di dalam sub-bagian.
3. SUMBER: Selalu cantumkan baris "Sumber: [Nama Dokumen]" di akhir jawaban jika bersumber dari dokumen.`;

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
