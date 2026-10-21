import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { parseUserFormattingInstruction, formatInstructionPrompt } from '../chat/chatUtils';

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
2. HANYA tampilkan format jawaban jika data yang ditanyakan BENAR-BENAR ada dan relevan di dalam konteks dokumen!

ATURAN DETEKSI POLA FORMAT JAWABAN (DARI PERMINTAAN USER):
Jika user meminta format, jumlah, atau kepadatan tertentu, ikuti aturan prioritas berikut:
1. ANGKA SPESIFIK (PRIORITAS TERTINGGI):
   - Jika user meminta angka tertentu (contoh: "4 list", "empat poin", "2 paragraf", "dua paragraf", "5 langkah", "tiga hal", baik dalam bentuk digit angka 1, 2, 3, 4, 5 maupun ejaan kata satu, dua, tiga, empat, lima dst - KEDUANYA DIPERLAKUKAN PERSIS SAMA), jumlah poin atau paragraf WAJIB TEPAT sesuai angka tersebut (tidak boleh kurang dan tidak boleh lebih).
2. FORMAT EKSPLISIT:
   - "buat list" / "poin-poin" / "bullet points": Buat dalam format list.
   - "buat paragraf" / "narasikan" / "tulis biasa tanpa bullet": Buat dalam format narasi paragraf tanpa bullet.
   - "tabel": Buat dalam bentuk tabel markdown.
   - "step by step" / "langkah-langkah": Buat numbered steps berurutan (1., 2., 3.).
   - "perbandingan": Buat format perbandingan (tabel atau komparasi poin).
   - "kesimpulan di akhir": Tambahkan ringkasan/kesimpulan di baris akhir.
3. INSTRUKSI KEPADATAN / PANJANG / KEJELASAN (MODIFIER):
   - "singkat" / "padat" / "ringkas" / "to the point": Potong bagian non-esensial, hilangkan pembuka basa-basi, langsung ke inti.
   - "lebih panjang" / "detail" / "lengkap" / "elaborasi": Tambahkan kedalaman penjelasan dan konteks dokumen.
   - "jelas" / "mudah dipahami" / "bahasa awam": Gunakan bahasa sederhana, hindari istilah rumit.
4. PRIORITAS OVERRIDE:
   - Permintaan format dari user SELALU MENGGANTIKAN (OVERRIDE) gaya default AI.
5. ATURAN DEFAULT (FALLBACK - JIKA TIDAK ADA TRIGGER DARI USER):
   - Jika user TIDAK memberikan instruksi format sama sekali, gunakan GAYA DEFAULT AI di bawah ini:

ATURAN ADAPTASI STRUKTUR & FORMAT JAWABAN (SESUAI KARAKTERISTIK DATA):
1. DATA BERSTRUKTUR / TABULAR / RECORD DENGAN BANYAK ATRIBUT (WAJIB TABEL MARKDOWN):
   - Jika data dalam dokumen berupa kumpulan rekaman (records) berulang dengan beberapa kolom/atribut (contoh: Daftar Kontak Tim, Daftar Pengguna, Profil Karyawan, Katalog Produk/Harga/Stok, Laporan Keuangan Neraca/Laba-Rugi, Data Statistik BPS, Kurs Valuta, Transaksi):
   - AI WAJIB MENYAJIKANNYA DALAM FORMAT TABEL MARKDOWN yang rapi dan terstruktur lengkap dengan header kolom (contoh: | No | Nama | Email | Telepon | Perusahaan |).
   - DILARANG KERAS memaksakan data multi-atribut/tabel ini menjadi bullet point panjang yang dijejalkan secara horizontal!
   - Boleh sertakan 1 kalimat pengantar singkat di atas tabel.

2. KETENTUAN, KEBIJAKAN, ATAU POIN KONSEPTUAL (FORMAT POIN PELURU •):
   - Jika data berupa daftar regulasi, syarat & ketentuan, ruang lingkup, atau poin pertimbangan tanpa multi-atribut kolom:
   - Gunakan format daftar poin peluru berformat:
     • Label: Penjelasan detail ringkas
   - DILARANG menulis narasi paragraf bertele-tele di dalam sub-bagian poin.

3. PROSEDUR / LANGKAH KERJA BERTAHAP (FORMAT NOMOR 1, 2, 3):
   - Jika data berupa SOP, tutorial, instruksi teknis, atau alur kerja berurutan:
   - Gunakan penomoran bertingkat (1., 2., 3., dst).

4. DEFINISI / KONSEP UMUM / LATAR BELAKANG (FORMAT PARAGRAF):
   - Jika pertanyaan menanyakan pengertian, konsep, filosofi, atau rangkuman umum:
   - Gunakan 1-2 paragraf narasi terpadu.

5. ATURAN OVERRIDE PERMINTAAN USER:
   - KECUALI JIKA USER SECARA EKSPLISIT MEMINTA FORMAT LAIN (contoh: "buat dalam paragraf", "tulis narasi biasa tanpa tabel", "jelaskan dalam 2 paragraf", "buatkan list 3 poin"):
   - MAKA AI WAJIB 100% MENGIKUTI PERMINTAAN USER (permintaan eksplisit user selalu mengesampingkan format default).

6. BEBAS TANDA BINTANG (NO ASTERISKS NOISE):
   - DILARANG menggunakan tanda bintang ganda (**) atau bintang ganjil yang mengotori teks.

7. SUMBER DOKUMEN:
   - Di baris paling akhir jawaban, selalu cantumkan sumber dokumen beserta nomor halamannya dengan format persis:
     "Sumber: [Nama Dokumen.pdf] | Halaman [Nomor Halaman atau Rentang Halaman]"
     (Khusus untuk sumber integrasi API bertanda [API], cantumkan sebagai: "Sumber: [API] [Nama Sumber] | Record [Nomor Record]")

CONTOH GAYA TABEL (UNTUK DATA RECORD / TABULAR):
Berikut daftar kontak tim yang tercantum dalam dokumen:

| No | Nama Lengkap | Username | Email | Telepon | Perusahaan |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | Leanne Graham | Bret | Sincere@april.biz | 1-770-736-8031 | Romaguera-Crona |
| 2 | Ervin Howell | Antonette | Shanna@melissa.tv | 010-692-6593 | Deckow-Crist |

Sumber: [API] Daftar Kontak Tim | Record 1, 2

CONTOH GAYA POIN (UNTUK KETENTUAN KONSEPTUAL):
Pedoman operasional standar adalah acuan kerja terstruktur yang dirancang untuk memastikan kepatuhan organisasi.

Ruang Lingkup dan Ketentuan Pokok:
• Standar Pelaksanaan: Menetapkan prosedur terpadu bagi seluruh unit kerja terkait.
• Alur Tanggung Jawab: Menjelaskan batas wewenang dan mekanisme eskalasi tugas operasional.

Sumber: Dokumen_Panduan.pdf | Halaman 1-3`;

export const SYSTEM_PUBLIC_PROMPT = `Anda adalah asisten AI analis dokumen profesional serbaguna.
TUGAS UTAMA: Jawab pertanyaan pengguna secara LENGKAP, MENDALAM, KOMPREHENSIF, dan TERSTRUKTUR dengan memprioritaskan konteks dokumen yang diberikan.

ATURAN STRUKTUR & ADAPTASI FORMAT JAWABAN:
1. DATA RECORD / TABEL / MULTI-ATRIBUT: Jika data berupa daftar entitas berulang (kontak, inventaris, keuangan, metrik), WAJIB tampilkan dalam format TABEL MARKDOWN yang rapi.
2. DAFTAR KETENTUAN / POIN KONSEPTUAL: Gunakan daftar poin peluru (• Label: Penjelasan).
3. PROSEDUR / LANGKAH KERJA: Gunakan penomoran berurutan (1., 2., 3.).
4. PARAGRAF NARATIF: Digunakan untuk definisi konsep, pengantar singkat, atau KECUALI JIKA USER EKSPLISIT MEMINTA DALAM BENTUK PARAGRAF.
5. SUMBER: Selalu cantumkan baris "Sumber: [Nama Dokumen]" di akhir jawaban jika bersumber dari dokumen.`;

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

  let baseUrl =
    options?.baseUrl ||
    process.env.OLLAMA_ENDPOINT ||
    process.env.OLLAMA_BASE_URL ||
    'http://localhost:11434';

  if (baseUrl.includes('//ollama:') && !process.env.DOCKER_CONTAINER) {
    baseUrl = baseUrl.replace('//ollama:', '//localhost:');
  }

  const temperature = options?.temperature ?? (allowPublicKnowledge ? 0.3 : 0.0);

  const systemPrompt = allowPublicKnowledge ? SYSTEM_PUBLIC_PROMPT : SYSTEM_STRICT_PROMPT;

  // Deteksi jika user meminta format, jumlah, atau kepadatan khusus (Sesuai Pertanyaan.md)
  const formatInstruction = parseUserFormattingInstruction(query);
  const formatDirective = formatInstruction ? formatInstructionPrompt(formatInstruction) : '';

  const userMessageContent = `--- KONTEKS DOKUMEN ---
${contextText || '(Tidak ada konteks dokumen yang ditemukan)'}
-----------------------
${formatDirective ? `\n${formatDirective}\n` : ''}
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

/**
 * Streams an AI response token-by-token using Llama 3.2 via Ollama stream API.
 * Calls onToken as each text chunk arrives from the local model.
 *
 * @param query - User question
 * @param contextText - Formatted chunks context from vector store
 * @param allowPublicKnowledge - If false, enforces strict grounding on document context only
 * @param options - Client options & onToken callback
 * @returns Promise<string> - Full accumulated AI response text
 */
export async function generateChatResponseStream(
  query: string,
  contextText: string,
  allowPublicKnowledge: boolean = false,
  options?: ChatClientOptions & { onToken?: (token: string) => void; signal?: AbortSignal }
): Promise<string> {
  const model =
    options?.model ||
    process.env.CHAT_MODEL_NAME ||
    process.env.CHAT_MODEL ||
    'llama3.2:3b';

  let baseUrl =
    options?.baseUrl ||
    process.env.OLLAMA_ENDPOINT ||
    process.env.OLLAMA_BASE_URL ||
    'http://localhost:11434';

  if (baseUrl.includes('//ollama:') && !process.env.DOCKER_CONTAINER) {
    baseUrl = baseUrl.replace('//ollama:', '//localhost:');
  }

  const temperature = options?.temperature ?? (allowPublicKnowledge ? 0.3 : 0.0);
  const systemPrompt = allowPublicKnowledge ? SYSTEM_PUBLIC_PROMPT : SYSTEM_STRICT_PROMPT;

  const formatInstruction = parseUserFormattingInstruction(query);
  const formatDirective = formatInstruction ? formatInstructionPrompt(formatInstruction) : '';

  const userMessageContent = `--- KONTEKS DOKUMEN ---
${contextText || '(Tidak ada konteks dokumen yang ditemukan)'}
-----------------------
${formatDirective ? `\n${formatDirective}\n` : ''}
PERTANYAAN PENGGUNA:
${query}`;

  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    new HumanMessage(userMessageContent),
  ];

  try {
    const client = new ChatOllama({
      model,
      baseUrl,
      temperature,
      numCtx: 4096,
      keepAlive: '1h',
    });

    const stream = await client.stream(messages, {
      signal: options?.signal || AbortSignal.timeout(300000),
    });

    let fullAnswer = '';
    for await (const chunk of stream) {
      const text = typeof chunk.content === 'string' ? chunk.content : '';
      if (text) {
        fullAnswer += text;
        options?.onToken?.(text);
      }
    }

    if (fullAnswer.trim().length > 0) {
      return fullAnswer;
    }

    // Fallback if stream was empty
    const fallbackAnswer = await generateChatResponse(query, contextText, allowPublicKnowledge, options);
    options?.onToken?.(fallbackAnswer);
    return fallbackAnswer;
  } catch (err) {
    console.warn('[ChatClient] Stream error, falling back to invoke:', err);
    const nonStreamed = await generateChatResponse(query, contextText, allowPublicKnowledge, options);
    options?.onToken?.(nonStreamed);
    return nonStreamed;
  }
}
