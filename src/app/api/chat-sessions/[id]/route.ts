import { NextRequest, NextResponse } from 'next/server';
import {
  getChatSession,
  updateChatSession,
  deleteChatSession,
} from '@lib/db/chatSessionStore';
import { getAuthenticatedUser, hasServerPermission } from '@lib/auth/serverAuth';
import { isUuidV4 } from '@lib/auth/uuid';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat-sessions/[id]
 * Muat satu sesi chat lengkap beserta messages.
 * Guard: session harus milik user yang login.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await hasServerPermission(request, 'chat:query'))) {
    return NextResponse.json({ error: 'Forbidden: AI Assistant access required.' }, { status: 403 });
  }
  if (!isUuidV4(params.id)) {
    return NextResponse.json({ error: 'Invalid chat session UUID.' }, { status: 400 });
  }

  try {
    const session = await getChatSession(params.id, user.id);
    if (!session) {
      return NextResponse.json(
        { error: 'Sesi chat tidak ditemukan atau akses ditolak.' },
        { status: 404 }
      );
    }
    return NextResponse.json(session, { status: 200 });
  } catch (err) {
    console.error('[API /api/chat-sessions/[id] GET] Error:', err);
    return NextResponse.json({ error: 'Gagal memuat sesi chat' }, { status: 500 });
  }
}

/**
 * PATCH /api/chat-sessions/[id]
 * Update title, messages, atau is_pinned.
 * Body: { title?: string; messages?: ChatMessage[]; is_pinned?: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await hasServerPermission(request, 'chat:query'))) {
    return NextResponse.json({ error: 'Forbidden: AI Assistant access required.' }, { status: 403 });
  }
  if (!isUuidV4(params.id)) {
    return NextResponse.json({ error: 'Invalid chat session UUID.' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const updates: { title?: string; messages?: any[]; is_pinned?: boolean } = {};

    if (typeof body.title === 'string') {
      updates.title = body.title.trim().slice(0, 200);
    }
    if (Array.isArray(body.messages)) {
      updates.messages = body.messages;
    }
    if (typeof body.is_pinned === 'boolean') {
      updates.is_pinned = body.is_pinned;
    }

    const updated = await updateChatSession(params.id, user.id, updates);
    if (!updated) {
      return NextResponse.json(
        { error: 'Sesi chat tidak ditemukan atau akses ditolak.' },
        { status: 404 }
      );
    }
    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    console.error('[API /api/chat-sessions/[id] PATCH] Error:', err);
    return NextResponse.json({ error: 'Gagal memperbarui sesi chat' }, { status: 500 });
  }
}

/**
 * DELETE /api/chat-sessions/[id]
 * Hapus sesi chat (hanya milik user sendiri).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await hasServerPermission(request, 'chat:query'))) {
    return NextResponse.json({ error: 'Forbidden: AI Assistant access required.' }, { status: 403 });
  }
  if (!isUuidV4(params.id)) {
    return NextResponse.json({ error: 'Invalid chat session UUID.' }, { status: 400 });
  }

  try {
    const deleted = await deleteChatSession(params.id, user.id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Sesi chat tidak ditemukan atau akses ditolak.' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('[API /api/chat-sessions/[id] DELETE] Error:', err);
    return NextResponse.json({ error: 'Gagal menghapus sesi chat' }, { status: 500 });
  }
}
