import { NextRequest, NextResponse } from 'next/server';
import { listChunks, listCuratedInsights, listBatches } from '@lib/db/vectorStore';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const batches = await listBatches();
    const batch = batches.find((b) => b.id === id);

    const rawChunks = await listChunks(id);
    const curatedInsights = await listCuratedInsights(id);

    const exportData = {
      batch: batch || { id },
      exportedAt: new Date().toISOString(),
      rawChunksCount: rawChunks.length,
      curatedInsightsCount: curatedInsights.length,
      rawChunks: rawChunks.map((c) => ({
        chunkIndex: c.chunk_index,
        pages: `Halaman ${c.source_page_start}-${c.source_page_end}`,
        content: c.content,
      })),
      curatedInsights: curatedInsights.map((i) => ({
        id: i.id,
        title: i.title,
        content: i.content,
        importance: i.importance,
        category: i.category,
        tags: i.tags,
        sourcePages: i.source_pages,
      })),
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="knowledge_${id.substring(0, 8)}.json"`,
      },
    });
  } catch (error) {
    console.error('[API /api/documents/[id]/export] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Gagal mengekspor data: ${message}` },
      { status: 500 }
    );
  }
}
