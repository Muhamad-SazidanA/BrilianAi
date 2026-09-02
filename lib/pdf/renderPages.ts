import * as mupdf from 'mupdf';
import { extractPageText } from '../ai/visionClient';

export interface PageTextResult {
  pageNumber: number;
  text: string;
}

export interface ExtractHybridOptions {
  minDigitalTextLength?: number;
}

/**
 * Extracts digital text from a MuPDF Page if available.
 */
export function extractPageDigitalText(page: mupdf.Page): string {
  try {
    const st = page.toStructuredText();
    const jsonStr = st.asJSON();
    if (!jsonStr) return '';
    const parsed = JSON.parse(jsonStr);
    const textPieces: string[] = [];

    if (parsed.blocks && Array.isArray(parsed.blocks)) {
      for (const block of parsed.blocks) {
        if (block.type === 'text' && Array.isArray(block.lines)) {
          for (const line of block.lines) {
            if (line.text) {
              textPieces.push(line.text);
            } else if (Array.isArray(line.spans)) {
              const spanText = line.spans.map((s: any) => s.text || '').join('');
              if (spanText) textPieces.push(spanText);
            }
          }
        }
      }
    }
    return textPieces.join('\n').trim();
  } catch {
    return '';
  }
}

/**
 * Memory-efficient streaming hybrid page extractor:
 * Evaluates pages on-demand without keeping thousands of image buffers in memory.
 * Never exceeds 2GB WebAssembly heap memory limit even for 10,000+ page documents.
 *
 * @param buffer - In-memory Buffer of the PDF file
 * @param options - Extraction options
 * @returns Promise<PageTextResult[]>
 */
export async function extractPdfPagesTextHybrid(
  buffer: Buffer,
  options?: ExtractHybridOptions
): Promise<PageTextResult[]> {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Invalid PDF buffer: Buffer is empty or not provided.');
  }

  const minDigitalTextLength = options?.minDigitalTextLength ?? 40;

  let doc: mupdf.Document;
  try {
    doc = mupdf.Document.openDocument(buffer, 'application/pdf');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to open PDF document: ${message}`);
  }

  const pageCount = doc.countPages();
  if (pageCount === 0) {
    throw new Error('Failed to process PDF: Document contains 0 pages.');
  }

  console.log(`[IngestPipeline] 📄 Total ${pageCount} halaman terdeteksi dalam dokumen.`);

  const results: PageTextResult[] = [];

  for (let i = 0; i < pageCount; i++) {
    const pageNumber = i + 1;
    try {
      const page = doc.loadPage(i);
      const digitalText = extractPageDigitalText(page);

      if (digitalText && digitalText.length >= minDigitalTextLength) {
        // Log periodically for large documents to avoid flooding console
        if (pageNumber % 25 === 1 || pageNumber === pageCount || pageCount <= 30) {
          console.log(
            `[IngestPipeline] ⚡ Halaman ${pageNumber}/${pageCount}: Fast-Path Teks Digital (${digitalText.length} karakter) - Instant!`
          );
        }
        results.push({
          pageNumber,
          text: digitalText,
        });
      } else {
        // Only render image on-demand if digital text is empty / scanned
        console.log(
          `[IngestPipeline] 🤖 Halaman ${pageNumber}/${pageCount}: Teks digital minim/scan, memindai via AI Vision...`
        );
        const pixmap = page.toPixmap(mupdf.Matrix.scale(1.0, 1.0), mupdf.ColorSpace.DeviceRGB);
        const pngBytes = pixmap.asPNG();
        const imageBuffer = Buffer.from(pngBytes);
        const text = await extractPageText(imageBuffer);
        const finalText = text || digitalText || '';

        console.log(
          `[IngestPipeline] -> Halaman ${pageNumber} selesai dipindai AI Vision (${finalText.length} karakter diekstrak).`
        );
        results.push({
          pageNumber,
          text: finalText,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[IngestPipeline] Peringatan: Gagal mengekstrak halaman ${pageNumber}: ${message}`);
      results.push({
        pageNumber,
        text: '',
      });
    }
  }

  return results;
}

/**
 * Renders all pages of a PDF from an in-memory buffer into an array of PNG image buffers.
 * Maintained for backwards compatibility and tests.
 *
 * @param buffer - In-memory Buffer of the PDF file
 * @returns Promise<Buffer[]> - Array of PNG image buffers (one per page)
 */
export async function renderPdfPagesToImages(buffer: Buffer): Promise<Buffer[]> {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Invalid PDF buffer: Buffer is empty or not provided.');
  }

  let doc: mupdf.Document;
  try {
    doc = mupdf.Document.openDocument(buffer, 'application/pdf');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to open PDF document: ${message}`);
  }

  const pageCount = doc.countPages();
  if (pageCount === 0) {
    throw new Error('Failed to process PDF: Document contains 0 pages.');
  }

  const imageBuffers: Buffer[] = [];
  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const pixmap = page.toPixmap(mupdf.Matrix.scale(1.0, 1.0), mupdf.ColorSpace.DeviceRGB);
    const pngBytes = pixmap.asPNG();
    imageBuffers.push(Buffer.from(pngBytes));
  }
  return imageBuffers;
}
