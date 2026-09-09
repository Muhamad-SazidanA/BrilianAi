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
 * Ensures the WASM StructuredText pointer is explicitly destroyed to prevent memory leaks.
 */
export function extractPageDigitalText(page: any): string {
  let st: any = null;
  try {
    st = page.toStructuredText();
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
  } finally {
    if (st && typeof st.destroy === 'function') {
      try { st.destroy(); } catch { /* ignore */ }
    }
  }
}

/**
 * Memory-efficient streaming hybrid page extractor.
 * Uses dynamic import for mupdf to avoid Next.js build-time ESM/WASM require() errors.
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

  // Dynamic import — avoids Next.js requiring ESM+WASM module at build/collection time
  const mupdf = await import('mupdf');

  const minDigitalTextLength = options?.minDigitalTextLength ?? 40;

  let doc: any;
  try {
    doc = mupdf.Document.openDocument(buffer, 'application/pdf');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to open PDF document: ${message}`);
  }

  const pageCount = doc.countPages();
  if (pageCount === 0) {
    try { doc.destroy?.(); } catch {}
    throw new Error('Failed to process PDF: Document contains 0 pages.');
  }

  console.log(`[IngestPipeline] 📄 Total ${pageCount} halaman terdeteksi dalam dokumen.`);

  const results: PageTextResult[] = [];

  for (let i = 0; i < pageCount; i++) {
    const pageNumber = i + 1;
    let page: any = null;
    let pixmap: any = null;

    try {
      page = doc.loadPage(i);
      const digitalText = extractPageDigitalText(page);

      if (digitalText && digitalText.length >= minDigitalTextLength) {
        if (pageNumber % 50 === 1 || pageNumber === pageCount || pageCount <= 30) {
          console.log(
            `[IngestPipeline] ⚡ Halaman ${pageNumber}/${pageCount}: Fast-Path Teks Digital (${digitalText.length} karakter)`
          );
        }
        results.push({ pageNumber, text: digitalText });
      } else {
        console.log(
          `[IngestPipeline] 🤖 Halaman ${pageNumber}/${pageCount}: Teks digital minim/scan, memindai via AI Vision...`
        );
        pixmap = page.toPixmap(mupdf.Matrix.scale(1.0, 1.0), mupdf.ColorSpace.DeviceRGB);
        const pngBytes = pixmap.asPNG();
        const imageBuffer = Buffer.from(pngBytes);
        const text = await extractPageText(imageBuffer);
        const finalText = text || digitalText || '';

        console.log(
          `[IngestPipeline] -> Halaman ${pageNumber} selesai dipindai AI Vision (${finalText.length} karakter diekstrak).`
        );
        results.push({ pageNumber, text: finalText });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[IngestPipeline] Peringatan: Gagal mengekstrak halaman ${pageNumber}: ${message}`);
      results.push({ pageNumber, text: '' });
    } finally {
      if (pixmap && typeof pixmap.destroy === 'function') {
        try { pixmap.destroy(); } catch {}
      }
      if (page && typeof page.destroy === 'function') {
        try { page.destroy(); } catch {}
      }
    }
  }

  try { doc.destroy?.(); } catch {}
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

  // Dynamic import — avoids Next.js requiring ESM+WASM module at build/collection time
  const mupdf = await import('mupdf');

  let doc: any;
  try {
    doc = mupdf.Document.openDocument(buffer, 'application/pdf');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to open PDF document: ${message}`);
  }

  const pageCount = doc.countPages();
  if (pageCount === 0) {
    try { doc.destroy?.(); } catch {}
    throw new Error('Failed to process PDF: Document contains 0 pages.');
  }

  const imageBuffers: Buffer[] = [];
  for (let i = 0; i < pageCount; i++) {
    let page: any = null;
    let pixmap: any = null;
    try {
      page = doc.loadPage(i);
      pixmap = page.toPixmap(mupdf.Matrix.scale(1.0, 1.0), mupdf.ColorSpace.DeviceRGB);
      const pngBytes = pixmap.asPNG();
      imageBuffers.push(Buffer.from(pngBytes));
    } finally {
      if (pixmap && typeof pixmap.destroy === 'function') {
        try { pixmap.destroy(); } catch {}
      }
      if (page && typeof page.destroy === 'function') {
        try { page.destroy(); } catch {}
      }
    }
  }
  try { doc.destroy?.(); } catch {}
  return imageBuffers;
}
