import { getPool } from './dbClient';
import { ChatSource, ChatResponseResult } from '../chat/chatService';
import { parseUserFormattingInstruction } from '../chat/chatUtils';

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

Sumber: TM 1. Sejarah FT.pdf`;

// In-memory cache for deterministic responses & zero-latency retrieval
const memoryCache = new Map<string, ChatResponseResult>();
let isTableInitialized = false;

/**
 * Memastikan tabel chat_response_cache ada di database PostgreSQL
 */
export async function ensureChatCacheTable(): Promise<void> {
  if (isTableInitialized) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_response_cache (
        cache_key TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        answer TEXT NOT NULL,
        sources JSONB NOT NULL DEFAULT '[]',
        allow_public_knowledge BOOLEAN NOT NULL DEFAULT false,
        retrieved_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_cache_key ON chat_response_cache (cache_key);
    `);
    isTableInitialized = true;
  } catch (err) {
    // If pool is mocked (e.g. unit testing), fail gracefully
  }
}

/**
 * Menghasilkan cache key unik berdasarkan normalisasi teks pertanyaan
 * dan instruksi format khusus (dari Pertanyaan.md jika ada).
 */
export function generateChatCacheKey(query: string, documentId?: string): string {
  const normText = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const inst = parseUserFormattingInstruction(query);
  const fmtKey = inst
    ? `fmt:${inst.format || 'none'}:${inst.count || 'any'}:${inst.lengthModifier || 'none'}:${inst.clarityModifier ? 'clr' : 'no'}:${inst.summaryAtEnd ? 'sum' : 'no'}:${inst.noBullets ? 'nobullet' : 'bullet'}`
    : 'fmt:default';

  const docKey = documentId ? `doc:${documentId}` : 'doc:all';
  return `${docKey}::${fmtKey}::${normText}`;
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
 * Mengambil jawaban chat yang tersimpan di cache
 */
export async function getCachedChatResponse(cacheKey: string): Promise<ChatResponseResult | null> {
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)!;
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
      const result: ChatResponseResult = {
        answer: row.answer,
        sources: Array.isArray(row.sources) ? row.sources : JSON.parse(row.sources || '[]'),
        allowPublicKnowledge: Boolean(row.allow_public_knowledge),
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
 */
export async function saveCachedChatResponse(
  cacheKey: string,
  query: string,
  result: ChatResponseResult
): Promise<void> {
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
