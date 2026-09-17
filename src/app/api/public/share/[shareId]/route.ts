import { NextRequest, NextResponse } from 'next/server';
import { getSharedChat } from '@lib/db/sharedChatStore';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { shareId: string } }
) {
  const { shareId } = params;
  if (!shareId || shareId.length > 64) {
    return NextResponse.json({ error: 'Invalid share ID' }, { status: 400 });
  }

  try {
    const record = await getSharedChat(shareId);
    if (!record) {
      return NextResponse.json(
        { error: 'Percakapan yang dibagikan tidak ditemukan atau telah kedaluwarsa.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      shareId: record.share_id,
      sessionId: record.session_id,
      userId: record.user_id,
      title: record.title,
      messages: record.messages,
      viewsCount: record.views_count,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    });
  } catch (err) {
    console.error('[GET /api/public/share/[shareId]] Error:', err);
    return NextResponse.json(
      { error: 'Gagal memuat percakapan publik.' },
      { status: 500 }
    );
  }
}
