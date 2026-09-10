import { NextRequest, NextResponse } from 'next/server';
import { listCuratedInsights, deduplicateCuratedInsights } from '@lib/db/vectorStore';
import { curateBatch, curateAllChunks, isBatchCurating, getCurationProgress } from '@lib/curation/curationService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const insights = await listCuratedInsights(id);
    return NextResponse.json(insights, { status: 200 });
  } catch (error) {
    console.error('[API /api/documents/[id]/curate GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Gagal mengambil insight kurasi: ${message}` },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const syncParam = searchParams.get('sync');
    const limitParam = searchParams.get('limit');

    // Bersihkan duplikat bila ada
    await deduplicateCuratedInsights(id);

    // Mode synchronous legacy (jika diminta via query param ?sync=true)
    if (syncParam === 'true') {
      const limit = limitParam ? parseInt(limitParam, 10) : 25;
      const curated = await curateBatch(id, limit);
      return NextResponse.json(
        {
          message: 'Kurasi AI berhasil diselesaikan.',
          count: curated.length,
          data: curated,
        },
        { status: 200 }
      );
    }

    // Cek jika proses kurasi sedang berlangsung
    if (isBatchCurating(id)) {
      const progress = await getCurationProgress(id);
      return NextResponse.json(
        {
          message: 'Kurasi AI untuk dokumen ini sedang berjalan.',
          progress,
        },
        { status: 200 }
      );
    }

    // Jalankan kurasi menyeluruh dengan update progres 1-100%
    curateAllChunks(id).catch((err) => {
      console.error(`[API /curate POST] Background curateAllChunks error for batch ${id}:`, err);
    });

    const initialProgress = await getCurationProgress(id);
    return NextResponse.json(
      {
        message: 'Kurasi AI berhasil dimulai.',
        progress: initialProgress,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[API /api/documents/[id]/curate POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Gagal menjalankan kurasi AI: ${message}` },
      { status: 500 }
    );
  }
}
