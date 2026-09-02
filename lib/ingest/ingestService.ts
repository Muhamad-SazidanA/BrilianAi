import { inspectPdfPages } from '../pdf/renderPages';
import { extractPageText } from '../ai/visionClient';
import { chunkWithPageOffsets, PageText } from '../chunking/splitWithPageTracking';
import { embedTexts } from '../ai/embeddingClient';
import { createUploadBatch, insertChunks } from '../db/vectorStore';

export interface UploadResult {
  uploadBatchId: string;
  originalFilename: string;
  pageCount: number;
  chunkCount: number;
}

export interface IngestOptions {
  visionConcurrency?: number;
  chunkSize?: number;
  chunkOverlap?: number;
  minDigitalTextLength?: number;
}

/**
 * Executes the complete end-to-end Hybrid PDF ingestion pipeline:
 * 1. Inspect all PDF pages in-memory (extract digital text & render image buffers).
 * 2. Hybrid Text Extraction:
 *    - If a page contains substantive digital text (>= 40 chars) -> extract instantly (Fast-Path).
 *    - If a page has minimal/no digital text (scanned image, photo, chart) -> invoke Ollama AI Vision.
 * 3. Split combined text into sliding-window chunks with source page range tracking.
 * 4. Generate 1024-dimension embeddings for all chunks (bge-m3 via OllamaEmbeddings).
 * 5. Create upload batch record in PostgreSQL.
 * 6. Store all document chunks with pgvector embeddings in database within a single transaction.
 * 7. Return summary { uploadBatchId, originalFilename, pageCount, chunkCount }.
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

  const visionConcurrency = options?.visionConcurrency ?? 1;
  const chunkSize = options?.chunkSize ?? 800;
  const chunkOverlap = options?.chunkOverlap ?? 150;
  const minDigitalTextLength = options?.minDigitalTextLength ?? 40;

  console.log(`[IngestPipeline] 🚀 Memulai ingestion file "${filename}" (${(fileBuffer.length / 1024).toFixed(1)} KB)...`);

  // 1. Inspect all PDF pages in-memory
  console.log(`[IngestPipeline] 📄 1/4 Memeriksa halaman PDF (Hybrid Engine)...`);
  const pagesData = await inspectPdfPages(fileBuffer);
  const pageCount = pagesData.length;

  if (pageCount === 0) {
    throw new Error('PDF document contains 0 renderable pages.');
  }
  console.log(`[IngestPipeline] ✓ Berhasil memeriksa ${pageCount} halaman.`);

  // 2. Hybrid Text Extraction
  console.log(`[IngestPipeline] ⚡ 2/4 Memproses ekstraksi teks untuk ${pageCount} halaman...`);
  const pagesText: PageText[] = [];

  for (let i = 0; i < pagesData.length; i += visionConcurrency) {
    const slice = pagesData.slice(i, i + visionConcurrency);
    const extractedBatch = await Promise.all(
      slice.map(async (pageItem) => {
        const pageNumber = pageItem.pageNumber;

        // Check if digital text is available and substantive
        if (pageItem.digitalText && pageItem.digitalText.length >= minDigitalTextLength) {
          console.log(
            `[IngestPipeline] ⚡ Halaman ${pageNumber}/${pageCount}: Fast-Path Teks Digital (${pageItem.digitalText.length} karakter) - Instant!`
          );
          return {
            pageNumber,
            text: pageItem.digitalText,
          };
        }

        // Fallback to AI Vision (Qwen2.5-VL) for scanned/image pages
        console.log(
          `[IngestPipeline] 🤖 Halaman ${pageNumber}/${pageCount}: Teks digital minim/scan, memindai via AI Vision...`
        );
        const text = await extractPageText(pageItem.imageBuffer);
        const finalText = text || pageItem.digitalText || '';
        console.log(
          `[IngestPipeline] -> Halaman ${pageNumber} selesai dipindai (${finalText.length} karakter diekstrak).`
        );
        return {
          pageNumber,
          text: finalText,
        };
      })
    );
    pagesText.push(...extractedBatch);
  }

  // 3. Sliding-window chunking with source page range tracking
  console.log(`[IngestPipeline] ✂️ 3/4 Memotong teks menjadi Chunks dengan Sliding Window (size: ${chunkSize}, overlap: ${chunkOverlap})...`);
  const chunks = await chunkWithPageOffsets(pagesText, chunkSize, chunkOverlap);
  const chunkCount = chunks.length;
  console.log(`[IngestPipeline] ✓ Menghasilkan ${chunkCount} chunks dengan pelacakan halaman.`);

  // 4. Batch generate embeddings for all chunks
  let embeddings: number[][] = [];
  if (chunkCount > 0) {
    console.log(`[IngestPipeline] 🧠 4/4 Membuat embedding vector 1024-dim (BGE-M3)...`);
    const chunkContents = chunks.map((c) => c.content);
    embeddings = await embedTexts(chunkContents);
  }

  // 5. Create upload batch record in PostgreSQL
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
