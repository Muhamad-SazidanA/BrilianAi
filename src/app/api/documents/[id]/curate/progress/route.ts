import { NextRequest, NextResponse } from 'next/server';
import { getCurationProgress } from '@lib/curation/curationService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const progress = await getCurationProgress(id);
    return NextResponse.json(progress, { status: 200 });
  } catch (error) {
    console.error('[API /api/documents/[id]/curate/progress GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Gagal mengambil progres kurasi: ${message}` },
      { status: 500 }
    );
  }
}
