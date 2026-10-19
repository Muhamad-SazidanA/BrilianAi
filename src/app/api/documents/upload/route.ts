import { NextRequest, NextResponse } from 'next/server';
import { queuePdfIngestion } from '@lib/queue/ingestQueue';
import { getIngestProgress, clearIngestProgress, setIngestProgress } from '@lib/ingest/ingestProgress';
import { getAuthenticatedUser, hasServerPermission } from '@lib/auth/serverAuth';

export const dynamic = 'force-dynamic';

// Standard PDF 4-byte magic signature: %PDF (0x25, 0x50, 0x44, 0x46)
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]);
// Maximum allowed file size for ingestion: 50 MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

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
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const canUpload = await hasServerPermission(req, 'documents:upload');
    if (!canUpload) {
      return NextResponse.json(
        { error: 'Forbidden: Hak akses documents:upload diperlukan.' },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string' || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'No PDF file uploaded. Please attach a file under the "file" field.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Ukuran file terlalu besar. Batas maksimum dokumen adalah 50 MB.' },
        { status: 413 }
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
    
    setIngestProgress(clientId, {
      clientId,
      filename,
      status: 'queued',
      message: 'Dokumen diantrekan ke pipeline ingestion...',
      progressPercent: 5,
    });

    const ownerId = (formData.get('ownerId') as string) || authUser.id;
    const divisionId = (formData.get('divisionId') as string) || 'General';
    const classification = (formData.get('classification') as any) || 'Internal';
    const status = (formData.get('status') as any) || 'Aktif';
    const version = (formData.get('version') as string) || '1.0';
    const reviewDueDate = (formData.get('reviewDueDate') as string) || null;

    const userGrantsRaw = formData.get('userGrants') as string | null;
    let userGrants: Array<{ userId: string; accessLevel: 'viewer' | 'editor' }> = [];
    if (userGrantsRaw) {
      try {
        userGrants = JSON.parse(userGrantsRaw);
      } catch {
        // quiet fallback
      }
    }

    const options = {
      ownerId,
      divisionId,
      classification,
      status,
      version,
      reviewDueDate,
    };

    const isAsync = req.nextUrl.searchParams.get('async') === 'true' || formData.get('async') === 'true';

    const runBackgroundIngestion = async () => {
      try {
        const result = await queuePdfIngestion(buffer, filename, options, clientId);

        if (Array.isArray(userGrants) && userGrants.length > 0) {
          const { bulkGrantDocumentAccess } = await import('@lib/db/documentGrantStore');
          await bulkGrantDocumentAccess(result.uploadBatchId, userGrants, ownerId);
        }

        setIngestProgress(clientId, {
          clientId,
          filename,
          status: 'completed',
          message: `Selesai: ${result.pageCount} halaman dan ${result.chunkCount} chunks berhasil di-ingest.`,
          progressPercent: 100,
          totalPages: result.pageCount,
          currentPage: result.pageCount,
          totalChunks: result.chunkCount,
          processedChunks: result.chunkCount,
          result: {
            upload_batch_id: result.uploadBatchId,
            original_filename: result.originalFilename,
            page_count: result.pageCount,
            chunk_count: result.chunkCount,
          },
        });
      } catch (err: any) {
        console.error(`[Background Ingestion Error] ${filename} (clientId: ${clientId}):`, err);
        setIngestProgress(clientId, {
          clientId,
          filename,
          status: 'error',
          message: err.message || 'Gagal memproses dokumen',
          progressPercent: 100,
          error: err.message || 'Gagal memproses dokumen',
        });
      }
    };

    if (isAsync) {
      // Fire and forget in Node.js background lifecycle
      setImmediate(runBackgroundIngestion);

      return NextResponse.json(
        {
          status: 'queued',
          clientId,
          original_filename: filename,
          message: 'Dokumen diterima dan sedang diproses di background.',
        },
        { status: 202 }
      );
    }

    // Synchronous execution fallback
    const result = await queuePdfIngestion(buffer, filename, options, clientId);
    if (Array.isArray(userGrants) && userGrants.length > 0) {
      const { bulkGrantDocumentAccess } = await import('@lib/db/documentGrantStore');
      await bulkGrantDocumentAccess(result.uploadBatchId, userGrants, ownerId);
    }

    setIngestProgress(clientId, {
      clientId,
      filename,
      status: 'completed',
      message: `Selesai: ${result.pageCount} halaman dan ${result.chunkCount} chunks berhasil di-ingest.`,
      progressPercent: 100,
      totalPages: result.pageCount,
      currentPage: result.pageCount,
      totalChunks: result.chunkCount,
      processedChunks: result.chunkCount,
      result: {
        upload_batch_id: result.uploadBatchId,
        original_filename: result.originalFilename,
        page_count: result.pageCount,
        chunk_count: result.chunkCount,
      },
    });

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
