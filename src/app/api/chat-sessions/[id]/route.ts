import { NextRequest, NextResponse } from 'next/server';
import {
  getChatSession,
  updateChatSession,
  deleteChatSession,
} from '@lib/db/chatSessionStore';
import { getAuthenticatedUser, hasServerPermission } from '@lib/auth/serverAuth';
import { isValidChatSessionId } from '@lib/auth/uuid';

export const dynamic = 'force-dynamic';

function checkIsAdmin(user: { role_id?: string; id?: string }): boolean {
  return (
    user.role_id === 'admin' ||
    user.role_id === 'superadmin' ||
    user.id === 'a0000000-0000-0000-0000-000000000001'
  );
}

/**
 * GET /api/chat-sessions/[id]
 * Muat satu sesi chat lengkap beserta messages.
 * Guard: session milik user yang login atau user adalah admin.
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
  if (!isValidChatSessionId(params.id)) {
    return NextResponse.json({ error: 'Invalid chat session identifier.' }, { status: 400 });
  }

  const isAdmin = checkIsAdmin(user);

  try {
    const session = await getChatSession(params.id, user.id, isAdmin);
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
  if (!isValidChatSessionId(params.id)) {
    return NextResponse.json({ error: 'Invalid chat session identifier.' }, { status: 400 });
  }

  const isAdmin = checkIsAdmin(user);

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

    const updated = await updateChatSession(params.id, user.id, updates, isAdmin);
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
 * Hapus sesi chat (hanya milik user sendiri atau admin).
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
  if (!isValidChatSessionId(params.id)) {
    return NextResponse.json({ error: 'Invalid chat session identifier.' }, { status: 400 });
  }

  const isAdmin = checkIsAdmin(user);

  try {
    const deleted = await deleteChatSession(params.id, user.id, isAdmin);
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

