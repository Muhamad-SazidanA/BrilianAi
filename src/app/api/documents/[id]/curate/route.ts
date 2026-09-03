import { NextRequest, NextResponse } from 'next/server';
import { listCuratedInsights } from '@lib/db/vectorStore';
import { curateBatch } from '@lib/curation/curationService';

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
    const limitParam = searchParams.get('limit');
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
  } catch (error) {
    console.error('[API /api/documents/[id]/curate POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Gagal menjalankan kurasi AI: ${message}` },
      { status: 500 }
    );
  }
}
