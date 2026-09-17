import { NextRequest, NextResponse } from 'next/server';
import { askDocumentChat } from '@lib/chat/chatService';
import { saveAuditLog } from '@lib/db/auditLogStore';
import { getAuthenticatedUser, hasServerPermission } from '@lib/auth/serverAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 menit batas eksekusi untuk CPU inference di VPS

export async function POST(request: NextRequest) {
  try {
    const authenticatedUser = await getAuthenticatedUser(request);
    if (!authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!(await hasServerPermission(request, 'chat:query'))) {
      return NextResponse.json({ error: 'Forbidden: AI Assistant access required.' }, { status: 403 });
    }
    const body = await request.json();
    const { query, documentId, allowPublicKnowledge, topK, minSimilarity, bypassCache, user, sessionId } = body;

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
      bypassCache: Boolean(bypassCache),
    });

    // Record audit log asynchronously for enterprise monitoring & compliance
    saveAuditLog({
      sessionId: sessionId || `sess-${Date.now()}`,
      userId: authenticatedUser.id,
      userName: authenticatedUser.name,
      userEmail: authenticatedUser.email,
      userDepartment: authenticatedUser.department,
      queryText: query.trim(),
      answerText: result.answer,
      sources: result.sources,
      retrievedCount: result.retrievedCount,
    }).catch((err) => {
      console.warn('[API /api/chat] Failed to record audit log:', err);
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
