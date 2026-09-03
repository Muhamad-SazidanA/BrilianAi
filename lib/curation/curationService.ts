import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { embedTexts } from '../ai/embeddingClient';
import {
  listChunks,
  insertCuratedInsights,
  listCuratedInsights,
  updateCuratedInsight,
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
 * Curates a single raw text chunk using Llama 3.2 (3B) into clean, structured insight.
 */
export async function curateRawText(
  rawContent: string,
  pageRange: string = ''
): Promise<CurationResultPayload> {
  const model =
    process.env.CURATION_MODEL_NAME ||
    process.env.CURATION_MODEL ||
    'llama3.2:3b';
  const baseUrl = process.env.OLLAMA_ENDPOINT || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

  const client = new ChatOllama({
    model,
    baseUrl,
    temperature: 0.1,
    format: 'json',
  });

  const prompt = `Berikut potongan teks mentah dari dokumen${pageRange ? ` (${pageRange})` : ''}:
"""
${rawContent}
"""

Ubah menjadi JSON Insight Kurasi sesuai format yang telah ditentukan.`;

  try {
    const response = await client.invoke([
      new SystemMessage(SYSTEM_CURATION_PROMPT),
      new HumanMessage(prompt),
    ]);

    const rawOutput = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    
    // Parse JSON safely
    const jsonStart = rawOutput.indexOf('{');
    const jsonEnd = rawOutput.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const parsed = JSON.parse(rawOutput.substring(jsonStart, jsonEnd + 1));
      return {
        title: parsed.title || 'Insight Dokumen',
        content: parsed.content || rawContent,
        importance: ['high', 'medium', 'low'].includes(parsed.importance) ? parsed.importance : 'medium',
        category: parsed.category || 'track1_financial',
        tags: Array.isArray(parsed.tags) && parsed.tags.length > 0 ? parsed.tags : ['Umum'],
      };
    }
  } catch (error) {
    console.warn('[CurationService] AI JSON parse fallback:', error);
  }

  // Fallback if AI fails or returns invalid format
  const firstLine = rawContent.split('\n')[0].replace(/[^a-zA-Z0-9\s]/g, '').trim();
  return {
    title: firstLine.length > 5 ? firstLine.substring(0, 45) : 'Ringkasan Informasi Dokumen',
    content: rawContent.trim(),
    importance: 'medium',
    category: 'track1_financial',
    tags: ['Dokumen', 'Mentah'],
  };
}

/**
 * Curates raw chunks incrementally for a given upload batch ID (default limit: 25)
 * and saves each insight immediately to avoid HTTP timeout and memory overload.
 */
export async function curateBatch(batchId: string, limit: number = 25): Promise<CuratedInsight[]> {
  const rawChunks = await listChunks(batchId);
  if (rawChunks.length === 0) {
    return [];
  }

  // Get already curated source chunk IDs to avoid re-curating
  const existingInsights = await listCuratedInsights(batchId);
  const curatedChunkIds = new Set(
    existingInsights
      .map((i) => (i.source_chunk_id ? String(i.source_chunk_id) : null))
      .filter(Boolean)
  );

  const uncuratedChunks = rawChunks
    .filter((c) => !curatedChunkIds.has(String(c.id)))
    .slice(0, limit);

  if (uncuratedChunks.length === 0) {
    return [];
  }

  const results: CuratedInsight[] = [];

  for (const chunk of uncuratedChunks) {
    const pageLabel =
      chunk.source_page_start === chunk.source_page_end
        ? `Halaman ${chunk.source_page_start}`
        : `Halaman ${chunk.source_page_start}-${chunk.source_page_end}`;

    const curated = await curateRawText(chunk.content, pageLabel);

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
  }

  return results;
}

/**
 * Continuously curates ALL raw chunks for a batch in iterative safe micro-batches (default: 20)
 * until 100% of chunks are converted into curated insights.
 */
export async function curateAllChunks(
  batchId: string,
  microBatchSize: number = 20
): Promise<number> {
  let totalCurated = 0;
  console.log(`[CurationService] Memulai kurasi AI otomatis menyeluruh untuk batch ${batchId}...`);

  while (true) {
    const newlyCurated = await curateBatch(batchId, microBatchSize);
    if (newlyCurated.length === 0) {
      break;
    }
    totalCurated += newlyCurated.length;
    console.log(
      `[CurationService] Progres batch ${batchId}: +${newlyCurated.length} chunks baru (total terkurasi: ${totalCurated})`
    );
  }

  console.log(
    `[CurationService] ✅ Selesai! Total ${totalCurated} chunks berhasil dikurasi menjadi insight untuk batch ${batchId}.`
  );
  return totalCurated;
}
