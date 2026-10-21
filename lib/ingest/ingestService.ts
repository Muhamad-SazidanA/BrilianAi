import { extractDocumentPages } from './documentExtractors';
import { chunkWithPageOffsets } from '../chunking/splitWithPageTracking';
import { embedTexts } from '../ai/embeddingClient';
import { createUploadBatch, insertChunks } from '../db/vectorStore';
import { setIngestProgress } from './ingestProgress';
import { autoCurateTabularBatch } from '../curation/curationService';

export interface UploadResult {
  uploadBatchId: string;
  originalFilename: string;
  pageCount: number;
  chunkCount: number;
}

import type { DocumentClassification, DocumentStatus } from '@/types/document';

export interface IngestOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  minDigitalTextLength?: number;
  // PRD v2.0 A5 Metadata Wajib:
  ownerId?: string | null;
  divisionId?: string;
  classification?: DocumentClassification;
  status?: DocumentStatus;
  version?: string;
  reviewDueDate?: Date | string | null;
}

function resolveClientId(clientId?: string): string {
  return clientId || `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Executes the complete end-to-end multi-format document ingestion pipeline (PDF, Excel, CSV, Word):
 * 1. Extract text and structured tables from document (PDF Hybrid OCR, Excel/CSV Markdown tables, Word Markdown).
 * 2. Split combined text into sliding-window chunks with source page range tracking.
 * 3. Generate 1024-dimension embeddings for all chunks in batches (bge-m3 via OllamaEmbeddings).
 * 4. Create upload batch record in PostgreSQL.
 * 5. Store all document chunks with pgvector embeddings in database within a single transaction.
 * 6. Return summary { uploadBatchId, originalFilename, pageCount, chunkCount }.
 *
 * All operations run 100% in-memory with zero temporary files written to disk.
 *
 * @param fileBuffer - In-memory Buffer of the uploaded file
 * @param filename - Original filename of the document
 * @param options - Optional pipeline configuration
 * @returns Promise<UploadResult>
 */
export async function ingestPdf(
  fileBuffer: Buffer,
  filename: string,
  options?: IngestOptions,
  clientId?: string
): Promise<UploadResult> {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new Error('Invalid PDF file buffer: Buffer is empty or not provided.');
  }

  const chunkSize = options?.chunkSize ?? 800;
  const chunkOverlap = options?.chunkOverlap ?? 150;
  const minDigitalTextLength = options?.minDigitalTextLength ?? 40;
  const resolvedClientId = resolveClientId(clientId);

  console.log(`[IngestPipeline] Memulai ingestion file "${filename}" (${(fileBuffer.length / 1024).toFixed(1)} KB)...`);
  setIngestProgress(resolvedClientId, {
    clientId: resolvedClientId,
    status: 'extracting',
    message: `Memulai ekstraksi berkas "${filename}"...`,
    progressPercent: 0,
  });

  // 1 & 2. Multi-Format Text & Table Extraction
  console.log(`[IngestPipeline] [1/4] Memproses ekstraksi teks/tabel multi-format...`);
  const { pagesText, detectedType } = await extractDocumentPages(fileBuffer, filename, { minDigitalTextLength });
  const pageCount = pagesText.length;

  const unitLabel = detectedType === 'xlsx' || detectedType === 'xls' ? 'sheet/halaman' : 'halaman';

  setIngestProgress(resolvedClientId, {
    clientId: resolvedClientId,
    status: 'extracting',
    message: `Mengekstrak ${pageCount} ${unitLabel} dari ${detectedType.toUpperCase()}...`,
    totalPages: pageCount,
    currentPage: pageCount,
    progressPercent: 25,
  });

  if (pageCount === 0) {
    throw new Error(`Dokumen ${filename} tidak memiliki konten yang dapat diproses.`);
  }
  console.log(`[IngestPipeline] Selesai mengekstrak seluruh ${pageCount} ${unitLabel} (${detectedType.toUpperCase()}).`);

  // 3. Sliding-window chunking with source page range tracking
  console.log(`[IngestPipeline] [2/4] Memotong teks menjadi Chunks dengan Sliding Window (size: ${chunkSize}, overlap: ${chunkOverlap})...`);
  setIngestProgress(resolvedClientId, {
    clientId: resolvedClientId,
    status: 'chunking',
    message: `Memotong teks menjadi chunks dengan sliding window (${chunkSize} / ${chunkOverlap})...`,
    totalPages: pageCount,
    currentPage: pageCount,
    progressPercent: 45,
  });
  const chunks = await chunkWithPageOffsets(pagesText, chunkSize, chunkOverlap);
  const chunkCount = chunks.length;
  console.log(`[IngestPipeline] Menghasilkan ${chunkCount} chunks dengan pelacakan halaman.`);
  setIngestProgress(resolvedClientId, {
    clientId: resolvedClientId,
    status: 'chunking',
    message: `Selesai membuat ${chunkCount} chunks dari halaman PDF...`,
    totalPages: pageCount,
    currentPage: pageCount,
    totalChunks: chunkCount,
    processedChunks: 0,
    progressPercent: 50,
  });

  // 4. Batch generate embeddings for all chunks in safe micro-batches of 10
  let embeddings: number[][] = [];
  if (chunkCount > 0) {
    console.log(`[IngestPipeline] [3/4] Membuat embedding vector 1024-dim untuk ${chunkCount} chunks...`);
    setIngestProgress(resolvedClientId, {
      clientId: resolvedClientId,
      status: 'embedding',
      message: `Membuat embedding vector untuk ${chunkCount} chunks...`,
      totalPages: pageCount,
      currentPage: pageCount,
      totalChunks: chunkCount,
      processedChunks: 0,
      progressPercent: 55,
    });
    const chunkContents = chunks.map((c) => c.content);

    // Process embeddings in optimized batches of 100 chunks to maximize throughput and minimize network round-trips
    const EMBED_BATCH_SIZE = 100;
    for (let i = 0; i < chunkContents.length; i += EMBED_BATCH_SIZE) {
      const slice = chunkContents.slice(i, i + EMBED_BATCH_SIZE);
      const batchEmbeds = await embedTexts(slice);
      embeddings.push(...batchEmbeds);

      const processedCount = Math.min(i + slice.length, chunkCount);
      const percent = Number(((processedCount / chunkCount) * 100).toFixed(1));
      setIngestProgress(resolvedClientId, {
        clientId: resolvedClientId,
        status: 'embedding',
        message: `Embedding progress: ${processedCount}/${chunkCount} chunks (${percent}%)...`,
        totalPages: pageCount,
        currentPage: pageCount,
        totalChunks: chunkCount,
        processedChunks: processedCount,
        progressPercent: 55 + (percent * 0.35),
      });
      if (processedCount % 50 === 0 || processedCount === chunkCount || chunkCount <= 50) {
        console.log(`[IngestPipeline] -> Embedding progress: ${processedCount}/${chunkCount} chunks (${percent}%)...`);
      }
    }
  }

  // 5. Create upload batch record in PostgreSQL
  console.log(`[IngestPipeline] [4/4] Menyimpan batch & ${chunkCount} chunks ke pgvector...`);
  setIngestProgress(resolvedClientId, {
    clientId: resolvedClientId,
    status: 'storing',
    message: `Menyimpan batch dan ${chunkCount} chunks ke pgvector...`,
    totalPages: pageCount,
    currentPage: pageCount,
    totalChunks: chunkCount,
    processedChunks: chunkCount,
    progressPercent: 92,
  });
  const batchId = await createUploadBatch(filename, pageCount, {
    ownerId: options?.ownerId,
    divisionId: options?.divisionId,
    classification: options?.classification,
    status: options?.status,
    version: options?.version,
    reviewDueDate: options?.reviewDueDate,
  });

  // 6. Insert all document chunks with pgvector embeddings
  if (chunkCount > 0) {
    const chunkInputs = chunks.map((chunk, index) => ({
      content: chunk.content,
      sourcePageStart: chunk.sourcePageStart,
      sourcePageEnd: chunk.sourcePageEnd,
      embedding: embeddings[index] || new Array(1024).fill(0),
    }));

    await insertChunks(batchId, chunkInputs);
  } else {
    // If no text was extracted at all, ensure batch chunk_count is 0
    await insertChunks(batchId, []);
  }

  console.log(`[IngestPipeline] Sukses: Batch ID: ${batchId}, Total Halaman: ${pageCount}, Total Chunks: ${chunkCount} tersimpan di pgvector.`);
  setIngestProgress(resolvedClientId, {
    clientId: resolvedClientId,
    status: 'completed',
    message: `Selesai: ${pageCount} halaman dan ${chunkCount} chunks berhasil di-ingest.`,
    totalPages: pageCount,
    currentPage: pageCount,
    totalChunks: chunkCount,
    processedChunks: chunkCount,
    progressPercent: 100,
  });

  // 7. Kurasi: File tabular (Excel & CSV) dikurasi otomatis via Zero-Token Engine lokal
  // Dokumen naratif (PDF, Word) tetap berstatus 'Menunggu Kurasi' untuk kurasi terarah di Studio
  if (['xlsx', 'xls', 'csv'].includes(detectedType) && chunkCount > 0) {
    console.log(`[IngestPipeline] Menjalankan Zero-Token Curation Engine untuk file tabular ${filename} (${detectedType.toUpperCase()})...`);
    try {
      await autoCurateTabularBatch(batchId, filename, detectedType as 'xlsx' | 'xls' | 'csv');
      console.log(`[IngestPipeline] Zero-Token Auto-Curation selesai. Dokumen tabular langsung aktif (0 Token).`);
    } catch (curateErr) {
      console.warn(`[IngestPipeline] Peringatan: Auto-curation tabular gagal:`, curateErr);
    }
  } else {
    console.log(`[IngestPipeline] Dokumen siap. Status: Menunggu Kurasi (tersedia kurasi manual via Studio).`);
  }

  // 8. Return complete upload result
  return {
    uploadBatchId: batchId,
    originalFilename: filename,
    pageCount,
    chunkCount,
  };
}

export const ingestDocument = ingestPdf;
