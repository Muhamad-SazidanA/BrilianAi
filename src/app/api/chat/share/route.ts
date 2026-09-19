import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@lib/auth/serverAuth';
import { createSnapshotShare } from '@lib/db/sharedChatStore';
import { ChatMessage } from '@/types/chat';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized: Harap login terlebih dahulu.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sessionId, title, messages } = body as {
      sessionId?: string;
      title?: string;
      messages?: ChatMessage[];
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Percakapan kosong tidak dapat dibagikan.' },
        { status: 400 }
      );
    }

    const cleanTitle = (title || 'Percakapan AI').trim().slice(0, 200);

    // Snapshot riwayat percakapan statis hingga detik ini dengan NanoID 11 karakter
    // dan update last_shared_message_id pada chat session via atomic transaction
    const { record, lastSharedMessageId } = await createSnapshotShare({
      sessionId: sessionId || null,
      userId: user.id,
      title: cleanTitle,
      messages,
      maxRetries: 5,
    });

    const host =
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      '';
    const proto =
      request.headers.get('x-forwarded-proto') ||
      (host.includes('localhost') ? 'http' : 'https');

    let origin = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
    if (!origin || origin.includes('0.0.0.0')) {
      if (host && !host.includes('0.0.0.0')) {
        origin = `${proto}://${host}`;
      } else {
        origin = request.nextUrl.origin.replace('0.0.0.0', 'localhost');
      }
    }
    origin = origin.replace(/\/+$/, '');

    const publicShareUrl = `${origin}/share/w/${record.share_id}`;
    const directUrl = `/share/w/${record.share_id}`;

    return NextResponse.json({
      success: true,
      shareId: record.share_id,
      shareUrl: publicShareUrl,
      directUrl,
      lastSharedMessageId,
      title: record.title,
      createdAt: record.created_at,
    });
  } catch (err: any) {
    console.error('[POST /api/chat/share] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Gagal memproses pembuatan tautan share.' },
      { status: 500 }
    );
  }
}
