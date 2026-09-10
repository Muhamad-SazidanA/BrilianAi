import { NextRequest, NextResponse } from 'next/server';
import { listBatches, activateAllBatches } from '@lib/db/vectorStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const batches = await listBatches();
    return NextResponse.json(batches, { status: 200 });
  } catch (error) {
    console.error('[API /api/documents] Error fetching batches:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Failed to retrieve upload batches: ${message}` },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { activateAll } = body;
    if (typeof activateAll === 'boolean') {
      const count = await activateAllBatches(activateAll);
      return NextResponse.json(
        {
          message: activateAll
            ? `Berhasil mengaktifkan seluruh ${count} dokumen untuk AI Chatbot.`
            : `Seluruh dokumen dinonaktifkan dari AI Chatbot.`,
          count,
        },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { error: 'Field "activateAll" diperlukan.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API /api/documents PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
