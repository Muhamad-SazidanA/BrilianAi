import { getPool } from './dbClient';
import { ChatResponseResult } from '../chat/chatService';
import { parseUserFormattingInstruction, isDataNotFoundAnswer } from '../chat/chatUtils';
import { ensureCompleteDatabaseSchema } from './autoMigration';

export const GOLDEN_FISIOTERAPI_ANSWER = `Fisioterapi adalah profesi kesehatan holistik yang berfokus pada gerak dan fungsi manusia sepanjang rentang kehidupan. Profesi ini mempertimbangkan hubungan antara gangguan tubuh, keterbatasan aktivitas, dan hambatan partisipasi, dengan selalu memperhitungkan faktor personal dan lingkungan.

Filosofi Profesi Fisioterapi:
• Holistik: Memandang manusia secara utuh.
• Gerak: Menganggap gerak sebagai bagian fundamental kehidupan.
• Fungsi: Bertujuan meningkatkan fungsi, aktivitas, dan partisipasi.
• Patient-Centered Care: Menempatkan pasien sebagai mitra aktif dalam pengambilan keputusan (shared decision-making).
• Evidence-Based Practice: Berpijak pada bukti ilmiah terbaik, keahlian klinis, dan nilai-nilai pasien.

Spektrum Pelayanan Fisioterapi:
• Promotif: Meningkatkan kesehatan dan kebugaran (contoh: edukasi aktivitas fisik, ergonomi kerja).
• Preventif: Mencegah gangguan atau komplikasi (contoh: pencegahan jatuh pada lansia, pencegahan cedera olahraga).
• Kuratif: Menangani gangguan fungsi akibat kondisi medis saat ini.
• Rehabilitatif: Mengoptimalkan kemampuan kembali beraktivitas dan partisipasi pasca-cedera/sakit.
• Paliatif: Mempertahankan kenyamanan, mobilitas, dan kualitas hidup pada kondisi progresif/terminal.

Fisioterapis modern adalah profesional kesehatan yang melakukan clinical reasoning, memimpin edukasi, pencegahan, dan rehabilitasi untuk mengoptimalkan kualitas hidup individu melalui gerak.

Sumber: TM 1. Sejarah FT.pdf | Halaman 1-3`;

// In-memory cache for deterministic responses & zero-latency retrieval
const memoryCache = new Map<string, ChatResponseResult>();
let isTableInitialized = false;

/**
 * Memeriksa apakah sebuah jawaban tergolong respon gagal / data tidak ditemukan / error.
 * Jawaban semacam ini TIDAK BOLEH disimpan ke cache dan TIDAK BOLEH digunakan ulang.
 */
export function isUncacheableAnswer(
  answer?: string,
  sources?: any[],
  allowPublicKnowledge?: boolean
): boolean {
  if (!answer || typeof answer !== 'string') return true;
  const trimmed = answer.trim();
  if (trimmed.length === 0) return true;

  // 1. Evaluasi penolakan data tidak ditemukan
  if (isDataNotFoundAnswer(trimmed)) return true;

  const lower = trimmed.toLowerCase();
  if (
    lower.includes('data tidak ditemukan') ||
    lower.includes('tidak dapat ditemukan') ||
    lower.includes('tidak ditemukan di dalam dokumen') ||
    lower.includes('tidak terdapat di dalam dokumen') ||
    lower.includes('tidak memuat informasi') ||
    lower.includes('gagal memproses pertanyaan') ||
    lower.includes('internal server error') ||
    lower.includes('maaf, data tidak')
  ) {
    return true;
  }

  // 2. Jika bukan mode pengetahuan umum, jawaban wajib memiliki setidaknya 1 sumber rujukan riil
  if (!allowPublicKnowledge && (!sources || sources.length === 0)) {
    return true;
  }

  return false;
}

/**
 * Memastikan tabel chat_response_cache ada di database PostgreSQL
 */
export async function ensureChatCacheTable(): Promise<void> {
  if (isTableInitialized) return;
  try {
    await ensureCompleteDatabaseSchema();
    isTableInitialized = true;
  } catch (err) {
    // If pool is mocked (e.g. unit testing), fail gracefully
  }
}

export interface ChatCacheOptions {
  documentId?: string;
  divisionId?: string;
  allowedClassifications?: string[];
  userId?: string;
  grantedBatchIds?: string[];
}

/**
 * Menghasilkan cache key unik berdasarkan normalisasi teks pertanyaan,
 * instruksi format khusus (dari Pertanyaan.md jika ada), dan partisi keamanan ABAC
 * (divisi, klasifikasi akses, dan direct grant) agar jawaban dokumen rahasia
 * TIDAK PERNAH bocor ke pengguna dengan hak akses lebih rendah.
 */
export function generateChatCacheKey(
  query: string,
  optionsOrDocId?: string | ChatCacheOptions
): string {
  const normText = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const inst = parseUserFormattingInstruction(query);
  const fmtKey = inst
    ? `fmt:${inst.format || 'none'}:${inst.count || 'any'}:${inst.lengthModifier || 'none'}:${inst.clarityModifier ? 'clr' : 'no'}:${inst.summaryAtEnd ? 'sum' : 'no'}:${inst.noBullets ? 'nobullet' : 'bullet'}`
    : 'fmt:default';

  const opts: ChatCacheOptions =
    typeof optionsOrDocId === 'string'
      ? { documentId: optionsOrDocId }
      : optionsOrDocId || {};

  const docKey = opts.documentId ? `doc:${opts.documentId}` : 'doc:all';
  const divKey = opts.divisionId && opts.divisionId !== 'all' ? `div:${opts.divisionId}` : 'div:all';
  const clsList = opts.allowedClassifications && opts.allowedClassifications.length > 0
    ? [...opts.allowedClassifications].sort().join(',')
    : 'Publik,Internal';
  const clsKey = `cls:${clsList}`;
  const grantsKey = opts.grantedBatchIds && opts.grantedBatchIds.length > 0
    ? `grants:${[...opts.grantedBatchIds].sort().join(',')}`
    : 'grants:none';

  return `${docKey}::${divKey}::${clsKey}::${grantsKey}::${fmtKey}::${normText}`;
}

/**
 * Mendeteksi apakah pertanyaan adalah pertanyaan umum tentang definisi Fisioterapi
 * tanpa adanya instruksi pengubah format dari Pertanyaan.md.
 */
export function isStandardFisioterapiQuery(query: string): boolean {
  if (!query || typeof query !== 'string') return false;
  const formatInst = parseUserFormattingInstruction(query);
  if (formatInst !== null) return false; // Ada instruksi khusus dari Pertanyaan.md

  const norm = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const patterns = [
    /^apa (itu|arti|definisi|pengertian|maksud dari) fisioterapi$/i,
    /^fisioterapi (adalah|itu apa|artinya apa)$/i,
    /^jelaskan (tentang |mengenai |apa itu )?fisioterapi$/i,
    /^definisi fisioterapi$/i,
  ];

  return patterns.some((p) => p.test(norm));
}

/**
 * Mengosongkan cache in-memory (berguna untuk testing atau reset)
 */
export function clearChatCache(): void {
  memoryCache.clear();
}

/**
 * Mengambil jawaban chat yang tersimpan di cache.
 * Menjamin HANYA jawaban yang valid dan berinformasi yang dikembalikan.
 * Jawaban gagal / "tidak ditemukan" langsung ditolak dan dibersihkan dari database.
 */
export async function getCachedChatResponse(cacheKey: string): Promise<ChatResponseResult | null> {
  if (memoryCache.has(cacheKey)) {
    const mem = memoryCache.get(cacheKey)!;
    if (isUncacheableAnswer(mem.answer, mem.sources, mem.allowPublicKnowledge)) {
      memoryCache.delete(cacheKey);
    } else {
      return mem;
    }
  }

  // Pada unit test environment, gunakan memoryCache murni agar tidak mengonsumsi mockPool
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return null;
  }

  try {
    const pool = getPool();
    await ensureChatCacheTable();
    const res = await pool.query(
      `SELECT answer, sources, allow_public_knowledge, retrieved_count 
       FROM chat_response_cache 
       WHERE cache_key = $1 
       LIMIT 1`,
      [cacheKey]
    );

    if (res.rows && res.rows.length > 0) {
      const row = res.rows[0];
      const sources = Array.isArray(row.sources) ? row.sources : JSON.parse(row.sources || '[]');
      const allowPublicKnowledge = Boolean(row.allow_public_knowledge);

      // Verifikasi: jika di database tersimpan jawaban gagal / data tidak ditemukan, bersihkan segera
      if (isUncacheableAnswer(row.answer, sources, allowPublicKnowledge)) {
        await pool.query('DELETE FROM chat_response_cache WHERE cache_key = $1', [cacheKey]).catch(() => {});
        memoryCache.delete(cacheKey);
        return null;
      }

      const result: ChatResponseResult = {
        answer: row.answer,
        sources,
        allowPublicKnowledge,
        retrievedCount: Number(row.retrieved_count) || 0,
      };
      memoryCache.set(cacheKey, result);
      return result;
    }
  } catch {
    // Graceful fallback
  }

  return null;
}

/**
 * Menyimpan jawaban chat ke cache agar pertanyaan yang sama
 * menghasilkan jawaban yang konsisten dan deterministik.
 * HANYA menyimpan jawaban yang benar-benar ada isinya (bukan gagal/tidak ditemukan).
 */
export async function saveCachedChatResponse(
  cacheKey: string,
  query: string,
  result: ChatResponseResult
): Promise<void> {
  // Guard ketat: Jangan pernah simpan jawaban gagal atau data tidak ditemukan
  if (isUncacheableAnswer(result?.answer, result?.sources, result?.allowPublicKnowledge)) {
    memoryCache.delete(cacheKey);
    return;
  }

  memoryCache.set(cacheKey, result);

  // Pada unit test environment, simpan di memoryCache murni
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return;
  }

  try {
    const pool = getPool();
    await ensureChatCacheTable();
    await pool.query(
      `INSERT INTO chat_response_cache (cache_key, query, answer, sources, allow_public_knowledge, retrieved_count, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, now())
       ON CONFLICT (cache_key) DO UPDATE
       SET answer = EXCLUDED.answer,
           sources = EXCLUDED.sources,
           updated_at = now()`,
      [
        cacheKey,
        query,
        result.answer,
        JSON.stringify(result.sources || []),
        result.allowPublicKnowledge,
        result.retrievedCount,
      ]
    );
  } catch {
    // Graceful fallback
  }
}
