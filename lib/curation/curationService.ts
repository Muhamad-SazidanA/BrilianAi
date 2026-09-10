import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { embedTexts } from '../ai/embeddingClient';
import {
  listChunks,
  insertCuratedInsights,
  listCuratedInsights,
  updateCuratedInsight,
  deduplicateCuratedInsights,
  CuratedInsight,
  CuratedInsightInput,
  DocumentChunk,
} from '../db/vectorStore';

export interface CurationResultPayload {
  title: string;
  content: string;
  importance: 'high' | 'medium' | 'low';
  category: string;
  tags: string[];
}

export const SYSTEM_CURATION_PROMPT = `Anda adalah pakar kurasi data dan analis dokumen profesional.
Tugas Anda: Mengubah potongan teks mentah (raw chunk) hasil ekstraksi dokumen menjadi "Insight Kurasi" yang valid, bersih dari noise ekstraksi/OCR, terstruktur, dan bernilai tinggi.

PANDUAN KURASI:
1. Perbaiki kesalahan ejaan, tanda baca, atau pemenggalan kata akibat OCR.
2. Jika potongan teks memuat tabel atau daftar angka, susun menjadi tabel Markdown yang rapi atau daftar poin yang mudah dipahami.
3. Buat judul spesifik dan padat yang mewakili inti isi informasi (contoh: "Realisasi Dana Hibah Pembinaan Kemitraan", "Hasil Kinerja Pengawasan Layanan (Service Quality Index)", "Rincian Penyelesaian Keluhan Nasabah 2018").
4. Tetapkan importance:
   - "high" jika berisi data finansial utama, metrik laba/rugi, kepatuhan hukum, atau keputusan strategis.
   - "medium" jika berisi rincian operasional, program kerja, survey, atau kegiatan.
   - "low" jika hanya berupa penjelasan umum, pengantar, atau definisi standar.
5. Berikan kategori (contoh: "track1_financial", "governance", "operasional", "csr", "layanan").
6. Berikan 2 sampai 4 tags kata kunci ringkas (contoh: ["CSR", "Dana Hibah"]).

OUTPUT WAJIB:
Hasilkan HANYA output JSON valid tanpa teks penjelasan tambahan dengan skema:
{
  "title": "string",
  "content": "string",
  "importance": "high" | "medium" | "low",
  "category": "string",
  "tags": ["string"]
}`;

/**
 * Curates a raw text chunk into clean, structured insight(s).
 * Bisa menghasilkan 1 atau lebih insight jika dalam 1 chunk terdapat beberapa topik/tabel berbeda.
 */
export async function curateRawTextMultiple(
  rawContent: string,
  pageRange: string = ''
): Promise<CurationResultPayload[]> {
  const openAiApiKey = process.env.OPENAI_API_KEY;

  const prompt = `Berikut potongan teks mentah dari dokumen${pageRange ? ` (${pageRange})` : ''}:
"""
${rawContent}
"""

Ubah menjadi JSON Insight Kurasi. Jika teks memuat 2 atau lebih topik/tabel penting yang berbeda, ekstrak masing-masing menjadi insight terpisah dalam array "insights". Jika hanya 1 topik, kembalikan 1 insight.
Format output JSON:
{
  "insights": [
    {
      "title": "string",
      "content": "string",
      "importance": "high" | "medium" | "low",
      "category": "string",
      "tags": ["string"]
    }
  ]
}`;

  if (openAiApiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_CURATION_PROMPT },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const rawOutput = data?.choices?.[0]?.message?.content;
        if (rawOutput) {
          const parsed = JSON.parse(rawOutput);
          const rawItems = Array.isArray(parsed.insights)
            ? parsed.insights
            : parsed.title
            ? [parsed]
            : [];

          if (rawItems.length > 0) {
            return rawItems.map((item: any) => ({
              title: item.title || 'Insight Dokumen',
              content: item.content || rawContent,
              importance: ['high', 'medium', 'low'].includes(item.importance) ? item.importance : 'medium',
              category: item.category || 'track1_financial',
              tags: Array.isArray(item.tags) && item.tags.length > 0 ? item.tags : ['Umum'],
            }));
          }
        }
      }
    } catch (err: any) {
      console.warn('[CurationService] OpenAI curation error:', err?.message);
    }
  }

  // Fallback
  const firstLine = rawContent.split('\n')[0].replace(/[^a-zA-Z0-9\s]/g, '').trim();
  return [
    {
      title: firstLine.length > 5 ? firstLine.substring(0, 45) : 'Ringkasan Informasi Dokumen',
      content: rawContent.trim(),
      importance: 'medium',
      category: 'track1_financial',
      tags: ['Dokumen', 'Mentah'],
    },
  ];
}

/**
 * Curates a single raw text chunk using OpenAI GPT-4o-mini into clean, structured insight.
 * Kompatibel dengan unit test yang menguji single insight.
 */
export async function curateRawText(
  rawContent: string,
  pageRange: string = ''
): Promise<CurationResultPayload> {
  const items = await curateRawTextMultiple(rawContent, pageRange);
  return items[0];
}

// Track active batches being curated to prevent parallel race conditions
const activeCurationBatches = new Set<string>();
const abortedBatches = new Set<string>();

/**
 * Membatalkan proses kurasi yang sedang berjalan untuk batch tertentu
 * (misalnya saat dokumen dihapus oleh pengguna).
 */
export function abortCuration(batchId: string): void {
  abortedBatches.add(batchId);
  activeCurationBatches.delete(batchId);
  progressMap.delete(batchId);
  console.log(`[CurationService] Sinyal pembatalan kurasi dikirim untuk batch ${batchId}.`);
}

export interface CurationProgress {
  batchId: string;
  totalChunks: number;
  processedChunks: number;
  curatedChunks: number; // alias untuk backward compatibility dengan frontend
  curatedInsightsCount: number;
  currentPercent: number;
  status: 'idle' | 'running' | 'completed' | 'error';
  currentChunkTitle?: string;
  error?: string;
  updatedAt: number;
}

const progressMap = new Map<string, CurationProgress>();

/**
 * Mendapatkan progres kurasi dokumen secara real-time.
 * Dokumen dianggap 100% selesai jika seluruh raw chunk telah diproses,
 * terlepas dari apakah jumlah Curated Insights lebih banyak atau lebih sedikit dari Raw Chunks.
 */
export async function getCurationProgress(batchId: string): Promise<CurationProgress> {
  const existing = progressMap.get(batchId);
  const isRunning = activeCurationBatches.has(batchId);

  if (existing && isRunning) {
    return existing;
  }

  // Ambil hitungan aktual dari DB
  try {
    const rawChunks = await listChunks(batchId);
    const existingInsights = await listCuratedInsights(batchId);
    const totalChunks = rawChunks.length;

    // Hitung berapa raw chunk unik yang sudah selesai diproses
    const processedChunkIds = new Set(
      existingInsights
        .map((i) => (i.source_chunk_id ? String(i.source_chunk_id) : null))
        .filter(Boolean)
    );
    const processedChunks = processedChunkIds.size;
    const curatedInsightsCount = existingInsights.length;

    const currentPercent =
      totalChunks > 0 ? Math.min(100, Math.round((processedChunks / totalChunks) * 100)) : 100;

    const isCompleted = totalChunks > 0 && processedChunks >= totalChunks;
    const status: 'idle' | 'running' | 'completed' | 'error' = isRunning
      ? 'running'
      : isCompleted
      ? 'completed'
      : processedChunks > 0
      ? 'idle'
      : 'idle';

    const progress: CurationProgress = {
      batchId,
      totalChunks,
      processedChunks,
      curatedChunks: processedChunks,
      curatedInsightsCount,
      currentPercent: isCompleted ? 100 : currentPercent,
      status,
      currentChunkTitle: existing?.currentChunkTitle || (status === 'completed' ? 'Kurasi Selesai 100%' : undefined),
      updatedAt: Date.now(),
    };
    progressMap.set(batchId, progress);
    return progress;
  } catch (err: any) {
    return {
      batchId,
      totalChunks: 0,
      processedChunks: 0,
      curatedChunks: 0,
      curatedInsightsCount: 0,
      currentPercent: 0,
      status: 'error',
      error: err?.message || 'Gagal memeriksa progres',
      updatedAt: Date.now(),
    };
  }
}

/**
 * Checks whether a batch is currently being curated.
 */
export function isBatchCurating(batchId: string): boolean {
  return activeCurationBatches.has(batchId);
}

/**
 * Internal logic to curate raw chunks incrementally for a batch.
 */
async function curateBatchInternal(
  batchId: string,
  limit: number = 25,
  onProgress?: (curatedChunk: CuratedInsight, processedIndex: number, totalToProcess: number) => void
): Promise<CuratedInsight[]> {
  const rawChunks = await listChunks(batchId);
  if (rawChunks.length === 0) {
    return [];
  }

  // Ambil ID chunk yang sudah pernah diproses agar tidak memproses ulang
  const existingInsights = await listCuratedInsights(batchId);
  const processedChunkIds = new Set(
    existingInsights
      .map((i) => (i.source_chunk_id ? String(i.source_chunk_id) : null))
      .filter(Boolean)
  );

  const uncuratedChunks = rawChunks
    .filter((c) => !processedChunkIds.has(String(c.id)))
    .slice(0, limit);

  if (uncuratedChunks.length === 0) {
    return [];
  }

  const results: CuratedInsight[] = [];
  let processedIndex = 0;

  for (const chunk of uncuratedChunks) {
    if (abortedBatches.has(batchId)) {
      console.log(`[CurationService] Kurasi batch ${batchId} dihentikan karena batch dibatalkan/dihapus.`);
      break;
    }

    const pageLabel =
      chunk.source_page_start === chunk.source_page_end
        ? `Halaman ${chunk.source_page_start}`
        : `Halaman ${chunk.source_page_start}-${chunk.source_page_end}`;

    // Ekstrak 1 atau lebih insight dari chunk ini
    const curatedItems = await curateRawTextMultiple(chunk.content, pageLabel);

    if (abortedBatches.has(batchId)) {
      break;
    }

    for (const curated of curatedItems) {
      // Embed immediately with BGE-M3 (1024-dim)
      let embedding: number[] = new Array(1024).fill(0);
      try {
        const embs = await embedTexts([`${curated.title}\n${curated.content}`]);
        if (embs && embs[0]) {
          embedding = embs[0];
        }
      } catch (embErr) {
        console.warn('[CurationService] Embedding warning, using zero-vector fallback:', embErr);
      }

      try {
        const inserted = await insertCuratedInsights(batchId, [
          {
            title: curated.title,
            content: curated.content,
            importance: curated.importance,
            category: curated.category,
            tags: curated.tags,
            sourcePages: pageLabel,
            sourceChunkId: chunk.id,
            embedding,
          },
        ]);

        if (inserted.length > 0) {
          results.push(inserted[0]);
        }
      } catch (insertErr: any) {
        // Tangani jika batch dihapus saat kurasi masih berjalan di background
        if (
          insertErr?.code === '23503' ||
          String(insertErr?.message).includes('violates foreign key constraint')
        ) {
          console.warn(
            `[CurationService] Batch ${batchId} telah dihapus dari database saat kurasi berlangsung. Menghentikan kurasi secara aman.`
          );
          abortedBatches.add(batchId);
          return results;
        }
        throw insertErr;
      }
    }

    processedIndex++;
    if (onProgress && results.length > 0) {
      onProgress(results[results.length - 1], processedIndex, uncuratedChunks.length);
    }
  }

  return results;
}

/**
 * Curates raw chunks incrementally for a given upload batch ID (default limit: 25).
 * Uses batch lock to prevent parallel duplicate execution.
 */
export async function curateBatch(batchId: string, limit: number = 25): Promise<CuratedInsight[]> {
  if (activeCurationBatches.has(batchId)) {
    console.log(`[CurationService] Batch ${batchId} sedang dalam proses kurasi aktif. Mengabaikan pemicu duplikat.`);
    return [];
  }

  activeCurationBatches.add(batchId);
  try {
    return await curateBatchInternal(batchId, limit);
  } finally {
    activeCurationBatches.delete(batchId);
  }
}

/**
 * Continuously curates ALL raw chunks for a batch in iterative safe micro-batches (default: 20)
 * until 100% of raw chunks are evaluated and converted into curated insights.
 */
export async function curateAllChunks(
  batchId: string,
  microBatchSize: number = 20
): Promise<number> {
  if (activeCurationBatches.has(batchId)) {
    console.log(`[CurationService] Batch ${batchId} sedang dalam proses kurasi aktif. Mengabaikan pemicu duplikat.`);
    return 0;
  }

  activeCurationBatches.add(batchId);

  // Inisialisasi status progres
  const rawChunks = await listChunks(batchId);
  const initialInsights = await listCuratedInsights(batchId);
  const totalChunks = rawChunks.length;

  const processedChunkIds = new Set(
    initialInsights
      .map((i) => (i.source_chunk_id ? String(i.source_chunk_id) : null))
      .filter(Boolean)
  );
  let processedChunks = processedChunkIds.size;
  let curatedInsightsCount = initialInsights.length;

  const initialPercent = totalChunks > 0 ? Math.round((processedChunks / totalChunks) * 100) : 100;
  progressMap.set(batchId, {
    batchId,
    totalChunks,
    processedChunks,
    curatedChunks: processedChunks,
    curatedInsightsCount,
    currentPercent: Math.max(1, initialPercent),
    status: 'running',
    currentChunkTitle: 'Menyiapkan proses kurasi...',
    updatedAt: Date.now(),
  });

  let totalNewCurated = 0;
  console.log(`[CurationService] Memulai kurasi AI untuk batch ${batchId} (${totalChunks} chunks total, ${processedChunks} sudah terproses)...`);

  try {
    while (true) {
      if (abortedBatches.has(batchId)) {
        console.log(`[CurationService] Kurasi batch ${batchId} dibatalkan.`);
        break;
      }

      const newlyCurated = await curateBatchInternal(
        batchId,
        microBatchSize,
        (insight) => {
          if (abortedBatches.has(batchId)) return;
          processedChunks = Math.min(totalChunks, processedChunks + 1);
          curatedInsightsCount++;
          const percent = totalChunks > 0 ? Math.min(100, Math.round((processedChunks / totalChunks) * 100)) : 100;
          progressMap.set(batchId, {
            batchId,
            totalChunks,
            processedChunks,
            curatedChunks: processedChunks,
            curatedInsightsCount,
            currentPercent: Math.max(1, percent),
            status: 'running',
            currentChunkTitle: insight.title,
            updatedAt: Date.now(),
          });
        }
      );

      if (abortedBatches.has(batchId)) {
        break;
      }

      if (newlyCurated.length === 0) {
        break;
      }
      totalNewCurated += newlyCurated.length;
      console.log(
        `[CurationService] Progres batch ${batchId}: +${newlyCurated.length} insight baru (total chunk diproses: ${processedChunks}/${totalChunks})`
      );
    }

    if (abortedBatches.has(batchId)) {
      progressMap.delete(batchId);
      return totalNewCurated;
    }

    // Bersihkan duplikat identik bila ada
    await deduplicateCuratedInsights(batchId);
    const finalInsights = await listCuratedInsights(batchId);

    // Selesai 100%
    progressMap.set(batchId, {
      batchId,
      totalChunks,
      processedChunks: totalChunks,
      curatedChunks: totalChunks,
      curatedInsightsCount: finalInsights.length,
      currentPercent: 100,
      status: 'completed',
      currentChunkTitle: 'Kurasi AI selesai 100%',
      updatedAt: Date.now(),
    });
  } catch (err: any) {
    if (
      abortedBatches.has(batchId) ||
      err?.code === '23503' ||
      String(err?.message).includes('violates foreign key constraint')
    ) {
      console.warn(
        `[CurationService] Kurasi batch ${batchId} dihentikan karena batch telah dihapus atau dibatalkan.`
      );
      progressMap.delete(batchId);
      return totalNewCurated;
    }
    console.error(`[CurationService] Error saat kurasi batch ${batchId}:`, err);
    progressMap.set(batchId, {
      batchId,
      totalChunks,
      processedChunks,
      curatedChunks: processedChunks,
      curatedInsightsCount,
      currentPercent: totalChunks > 0 ? Math.round((processedChunks / totalChunks) * 100) : 0,
      status: 'error',
      error: err?.message || 'Terjadi kesalahan saat kurasi',
      updatedAt: Date.now(),
    });
    throw err;
  } finally {
    activeCurationBatches.delete(batchId);
    abortedBatches.delete(batchId);
  }

  console.log(
    `[CurationService] Sukses: Seluruh ${totalChunks} chunks diproses. Dihasilkan total ${totalNewCurated} insights baru untuk batch ${batchId}.`
  );
  return totalNewCurated;
}
