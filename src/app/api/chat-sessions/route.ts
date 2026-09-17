import { NextRequest, NextResponse } from 'next/server';
import { createChatSession, listUserChatSessions } from '@lib/db/chatSessionStore';
import { getAuthenticatedUser, hasServerPermission } from '@lib/auth/serverAuth';
import type { ChatMessage } from '@/types/chat';

export const dynamic = 'force-dynamic';

/** Helper: ambil user_id dari cookie request */
/**
 * GET /api/chat-sessions
 * List semua sesi chat milik user yang sedang login.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await hasServerPermission(request, 'chat:query'))) {
    return NextResponse.json({ error: 'Forbidden: AI Assistant access required.' }, { status: 403 });
  }

  try {
    const sessions = await listUserChatSessions(user.id, 30);
    return NextResponse.json({ sessions }, { status: 200 });
  } catch (err) {
    console.error('[API /api/chat-sessions GET] Error:', err);
    return NextResponse.json({ error: 'Gagal memuat riwayat chat' }, { status: 500 });
  }
}

/**
 * POST /api/chat-sessions
 * Buat sesi chat baru untuk user yang login.
 * Body: { messages: ChatMessage[] }
 *
 * Sesi sengaja tidak dapat dibuat tanpa pesan pertama.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await hasServerPermission(request, 'chat:query'))) {
    return NextResponse.json({ error: 'Forbidden: AI Assistant access required.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const firstUserMessage = messages.find(
      (message: unknown): message is Partial<ChatMessage> =>
        Boolean(
          message &&
            typeof message === 'object' &&
            'sender' in message &&
            'text' in message &&
            (message as { sender?: unknown }).sender === 'user' &&
            typeof (message as { text?: unknown }).text === 'string' &&
            (message as { text: string }).text.trim()
        )
    );

    if (!firstUserMessage) {
      return NextResponse.json(
        { error: 'Pesan pertama wajib diisi sebelum sesi chat dibuat.' },
        { status: 400 }
      );
    }

    const firstMessage: ChatMessage = {
      id:
        typeof firstUserMessage.id === 'string' && firstUserMessage.id
          ? firstUserMessage.id
          : `user-${Date.now()}`,
      sender: 'user',
      text: firstUserMessage.text!.trim(),
      timestamp:
        typeof firstUserMessage.timestamp === 'string' && firstUserMessage.timestamp
          ? firstUserMessage.timestamp
          : new Date().toISOString(),
    };

    const titleToUse =
      typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : undefined;
    const session = await createChatSession(
      user.id,
      messages.length > 1 ? messages : [firstMessage],
      titleToUse
    );
    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    console.error('[API /api/chat-sessions POST] Error:', err);
    return NextResponse.json({ error: 'Gagal membuat sesi chat' }, { status: 500 });
  }
}
