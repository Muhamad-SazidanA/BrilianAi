import { renderPdfPagesToImages } from '../pdf/renderPages';
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
}

/**
 * Executes the complete end-to-end PDF ingestion pipeline:
 * 1. Render all PDF pages to in-memory PNG image buffers (mupdf).
 * 2. Extract substantive text per page using AI Vision (qwen2.5vl:7b via ChatOllama, concurrency limited).
 * 3. Split combined text into sliding-window chunks while tracking source page ranges.
 * 4. Generate 1024-dimension embeddings for all chunks in batch (bge-m3 via OllamaEmbeddings).
 * 5. Create an upload batch record in PostgreSQL.
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

  const visionConcurrency = options?.visionConcurrency ?? 3;
  const chunkSize = options?.chunkSize ?? 800;
  const chunkOverlap = options?.chunkOverlap ?? 150;

  // 1. Render all PDF pages to PNG image buffers
  const pageImages = await renderPdfPagesToImages(fileBuffer);
  const pageCount = pageImages.length;

  if (pageCount === 0) {
    throw new Error('PDF document contains 0 renderable pages.');
  }

  // 2. Extract text for each page with concurrency limit (e.g. 3 at a time)
  const pagesText: PageText[] = [];

  for (let i = 0; i < pageImages.length; i += visionConcurrency) {
    const slice = pageImages.slice(i, i + visionConcurrency);
    const extractedBatch = await Promise.all(
      slice.map(async (imageBuffer, sliceIndex) => {
        const pageNumber = i + sliceIndex + 1;
        const text = await extractPageText(imageBuffer);
        return {
          pageNumber,
          text,
        };
      })
    );
    pagesText.push(...extractedBatch);
  }

  // 3. Sliding-window chunking with source page range tracking
  const chunks = await chunkWithPageOffsets(pagesText, chunkSize, chunkOverlap);
  const chunkCount = chunks.length;

  // 4. Batch generate embeddings for all chunks
  let embeddings: number[][] = [];
  if (chunkCount > 0) {
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

  // 7. Return complete upload result
  return {
    uploadBatchId: batchId,
    originalFilename: filename,
    pageCount,
    chunkCount,
  };
}
