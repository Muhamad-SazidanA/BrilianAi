import * as mupdf from 'mupdf';

/**
 * Renders all pages of a PDF from an in-memory buffer into an array of PNG image buffers.
 * The entire process is executed in-memory without writing any files to disk.
 *
 * @param buffer - In-memory Buffer of the PDF file
 * @returns Promise<Buffer[]> - Array of PNG image buffers (one per page)
 * @throws Error if the buffer is invalid or corrupt
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
    try {
      const page = doc.loadPage(i);
      // Scale by 2x for optimal AI Vision OCR / reading clarity
      const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB);
      const pngBytes = pixmap.asPNG();
      imageBuffers.push(Buffer.from(pngBytes));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to render PDF page ${i + 1}: ${message}`);
    }
  }

  return imageBuffers;
}
