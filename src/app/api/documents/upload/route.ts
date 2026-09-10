import { NextRequest, NextResponse } from 'next/server';
import { queuePdfIngestion } from '@lib/queue/ingestQueue';
import { getIngestProgress, clearIngestProgress, setIngestProgress } from '@lib/ingest/ingestProgress';

export const dynamic = 'force-dynamic';

// Standard PDF 4-byte magic signature: %PDF (0x25, 0x50, 0x44, 0x46)
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return NextResponse.json(
      { error: 'clientId is required' },
      { status: 400 }
    );
  }

  const progress = getIngestProgress(clientId);
  if (!progress) {
    return NextResponse.json(
      { status: 'idle', message: 'Tidak ada proses ingest aktif.', progressPercent: 0 },
      { status: 200 }
    );
  }

  return NextResponse.json(progress, { status: 200 });
}

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

    const clientId =
      (formData.get('clientId') as string | null) || `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    clearIngestProgress(clientId);
    setIngestProgress(clientId, {
      clientId,
      status: 'queued',
      message: 'Antrian ingest dibuat, menunggu eksekusi pipeline...',
      progressPercent: 5,
    });

    const result = await queuePdfIngestion(buffer, filename, undefined, clientId);
    clearIngestProgress(clientId);

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
