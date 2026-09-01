import { NextRequest, NextResponse } from 'next/server';
import { queuePdfIngestion } from '@/../lib/queue/ingestQueue';

export const dynamic = 'force-dynamic';

// Standard PDF 4-byte magic signature: %PDF (0x25, 0x50, 0x44, 0x46)
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string' || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'No PDF file uploaded. Please attach a file under the "file" field.' },
        { status: 400 }
      );
    }

    const filename = (file as File).name || 'document.pdf';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate PDF magic bytes (%PDF)
    if (buffer.length < 4 || !buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES)) {
      return NextResponse.json(
        { error: 'Invalid file format: File does not have a valid PDF header signature (%PDF-).' },
        { status: 400 }
      );
    }

    // Process ingestion via BullMQ queue
    const result = await queuePdfIngestion(buffer, filename);

    return NextResponse.json(
      {
        upload_batch_id: result.uploadBatchId,
        original_filename: result.originalFilename,
        page_count: result.pageCount,
        chunk_count: result.chunkCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /api/documents/upload] Ingestion error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Ingestion failed: ${message}` },
      { status: 500 }
    );
  }
}
