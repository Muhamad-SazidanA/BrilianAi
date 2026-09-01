import { NextResponse } from 'next/server';
import { listBatches } from '@/../lib/db/vectorStore';

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
