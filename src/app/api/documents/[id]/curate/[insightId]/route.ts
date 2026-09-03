import { NextRequest, NextResponse } from 'next/server';
import { updateCuratedInsight } from '@lib/db/vectorStore';
import { embedTexts } from '@lib/ai/embeddingClient';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; insightId: string } }
) {
  try {
    const { insightId } = params;
    const body = await request.json();
    const { title, content, importance, category, tags } = body;

    let embedding: number[] | undefined = undefined;
    if (title || content) {
      const textToEmbed = `${title || ''}\n${content || ''}`.trim();
      if (textToEmbed) {
        const [vector] = await embedTexts([textToEmbed]);
        if (vector) embedding = vector;
      }
    }

    const updated = await updateCuratedInsight(insightId, {
      title,
      content,
      importance,
      category,
      tags,
      embedding,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('[API /api/documents/[id]/curate/[insightId] PUT] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Gagal memperbarui insight kurasi: ${message}` },
      { status: 500 }
    );
  }
}
