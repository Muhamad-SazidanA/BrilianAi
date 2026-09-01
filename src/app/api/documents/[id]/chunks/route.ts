import { NextRequest, NextResponse } from 'next/server';
import { listChunks } from '@/../lib/db/vectorStore';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Document batch ID is required.' },
        { status: 400 }
      );
    }

    const chunks = await listChunks(id);
    return NextResponse.json(chunks, { status: 200 });
  } catch (error) {
    console.error(`[API /api/documents/${params?.id}/chunks] Error:`, error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Failed to retrieve document chunks: ${message}` },
      { status: 500 }
    );
  }
}
