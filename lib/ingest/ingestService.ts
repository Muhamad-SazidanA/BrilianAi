import { extractPdfPagesTextHybrid } from '../pdf/renderPages';
import { chunkWithPageOffsets } from '../chunking/splitWithPageTracking';
import { embedTexts } from '../ai/embeddingClient';
import { createUploadBatch, insertChunks } from '../db/vectorStore';

export interface UploadResult {
  uploadBatchId: string;
  originalFilename: string;
  pageCount: number;
  chunkCount: number;
}

export interface IngestOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  minDigitalTextLength?: number;
}

/**
 * Executes the complete end-to-end Hybrid PDF ingestion pipeline:
 * 1. Stream pages on-demand: extract digital text directly or invoke AI Vision for scan/images without accumulating images in memory.
 * 2. Split combined text into sliding-window chunks with source page range tracking.
 * 3. Generate 1024-dimension embeddings for all chunks in batches (bge-m3 via OllamaEmbeddings).
 * 4. Create upload batch record in PostgreSQL.
 * 5. Store all document chunks with pgvector embeddings in database within a single transaction.
 * 6. Return summary { uploadBatchId, originalFilename, pageCount, chunkCount }.
 *
 * All operations run 100% in-memory with zero temporary files written to disk.
 *
 * @param fileBuffer - In-memory Buffer of the uploaded PDF file
 * @param filename - Original filename of the document
 * @param options - Optional pipeline configuration
 * @returns Promise<UploadResult>
 */
export async function ingestPdf(
  fileBuffer: Buffer,
  filename: string,
  options?: IngestOptions
): Promise<UploadResult> {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new Error('Invalid PDF file buffer: Buffer is empty or not provided.');
  }

  const chunkSize = options?.chunkSize ?? 800;
  const chunkOverlap = options?.chunkOverlap ?? 150;
  const minDigitalTextLength = options?.minDigitalTextLength ?? 40;

  console.log(`[IngestPipeline] 🚀 Memulai ingestion file "${filename}" (${(fileBuffer.length / 1024).toFixed(1)} KB)...`);

  // 1 & 2. Streaming Hybrid Text Extraction
  console.log(`[IngestPipeline] ⚡ 1/4 Memproses ekstraksi teks (Streaming Hybrid Engine)...`);
  const pagesText = await extractPdfPagesTextHybrid(fileBuffer, { minDigitalTextLength });
  const pageCount = pagesText.length;

  if (pageCount === 0) {
    throw new Error('PDF document contains 0 renderable pages.');
  }
  console.log(`[IngestPipeline] ✓ Selesai mengekstrak seluruh ${pageCount} halaman.`);

  // 3. Sliding-window chunking with source page range tracking
  console.log(`[IngestPipeline] ✂️ 2/4 Memotong teks menjadi Chunks dengan Sliding Window (size: ${chunkSize}, overlap: ${chunkOverlap})...`);
  const chunks = await chunkWithPageOffsets(pagesText, chunkSize, chunkOverlap);
  const chunkCount = chunks.length;
  console.log(`[IngestPipeline] ✓ Menghasilkan ${chunkCount} chunks dengan pelacakan halaman.`);

  // 4. Batch generate embeddings for all chunks (in sub-batches of 50 to prevent huge single payload)
  let embeddings: number[][] = [];
  if (chunkCount > 0) {
    console.log(`[IngestPipeline] 🧠 3/4 Membuat embedding vector 1024-dim (BGE-M3) untuk ${chunkCount} chunks...`);
    const chunkContents = chunks.map((c) => c.content);
    
    // Process embeddings in batches of 50 chunks for safety
    const EMBED_BATCH_SIZE = 50;
    for (let i = 0; i < chunkContents.length; i += EMBED_BATCH_SIZE) {
      const slice = chunkContents.slice(i, i + EMBED_BATCH_SIZE);
      const batchEmbeds = await embedTexts(slice);
      embeddings.push(...batchEmbeds);
    }
  }

  // 5. Create upload batch record in PostgreSQL
  console.log(`[IngestPipeline] 💾 4/4 Menyimpan batch & ${chunkCount} chunks ke pgvector...`);
  const batchId = await createUploadBatch(filename, pageCount);

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

  console.log(`[IngestPipeline] ✅ SUKSES! Batch ID: ${batchId}, Total Halaman: ${pageCount}, Total Chunks: ${chunkCount} tersimpan di pgvector.`);

  // 7. Return complete upload result
  return {
    uploadBatchId: batchId,
    originalFilename: filename,
    pageCount,
    chunkCount,
  };
}
