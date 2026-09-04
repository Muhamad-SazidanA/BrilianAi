import { NextRequest, NextResponse } from 'next/server';
import { askDocumentChat } from '@lib/chat/chatService';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 menit batas eksekusi untuk CPU inference di VPS

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, documentId, allowPublicKnowledge, topK, minSimilarity } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Field "query" is required and must not be empty.' },
        { status: 400 }
      );
    }

    const result = await askDocumentChat(query, {
      documentId: documentId || undefined,
      allowPublicKnowledge: Boolean(allowPublicKnowledge),
      topK: typeof topK === 'number' ? topK : undefined,
      minSimilarity: typeof minSimilarity === 'number' ? minSimilarity : undefined,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API /api/chat] Error generating chat response:', error);
    const causeMsg = error instanceof Error && (error as any).cause ? ` (${(error as any).cause})` : '';
    const message = error instanceof Error ? `${error.message}${causeMsg}` : 'Internal server error';
    return NextResponse.json(
      { error: `Gagal memproses pesan chat: ${message}` },
      { status: 500 }
    );
  }
}
