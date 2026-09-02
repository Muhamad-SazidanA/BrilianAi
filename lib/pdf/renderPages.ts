import * as mupdf from 'mupdf';

export interface PageInspection {
  pageNumber: number;
  digitalText: string;
  imageBuffer: Buffer;
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
 * Inspects all pages of a PDF: extracts digital text and renders image buffer in-memory.
 *
 * @param buffer - In-memory Buffer of the PDF file
 * @returns Promise<PageInspection[]> - Array of inspected pages
 */
export async function inspectPdfPages(buffer: Buffer): Promise<PageInspection[]> {
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

  const results: PageInspection[] = [];

  for (let i = 0; i < pageCount; i++) {
    try {
      const page = doc.loadPage(i);
      const digitalText = extractPageDigitalText(page);
      // Scale 1.0x produces crisp ~595x842 px images (~800 visual tokens), perfectly fitting context & using minimum RAM
      const pixmap = page.toPixmap(mupdf.Matrix.scale(1.0, 1.0), mupdf.ColorSpace.DeviceRGB);
      const pngBytes = pixmap.asPNG();

      results.push({
        pageNumber: i + 1,
        digitalText,
        imageBuffer: Buffer.from(pngBytes),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to process PDF page ${i + 1}: ${message}`);
    }
  }

  return results;
}

/**
 * Renders all pages of a PDF from an in-memory buffer into an array of PNG image buffers.
 * Maintained for backwards compatibility.
 *
 * @param buffer - In-memory Buffer of the PDF file
 * @returns Promise<Buffer[]> - Array of PNG image buffers (one per page)
 */
export async function renderPdfPagesToImages(buffer: Buffer): Promise<Buffer[]> {
  const pages = await inspectPdfPages(buffer);
  return pages.map((p) => p.imageBuffer);
}
