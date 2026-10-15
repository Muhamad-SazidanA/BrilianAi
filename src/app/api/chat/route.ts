import { NextRequest, NextResponse } from 'next/server';
import { askDocumentChat } from '@lib/chat/chatService';
import { saveAuditLog } from '@lib/db/auditLogStore';
import { getAuthenticatedUser, hasServerPermission, getAllowedClassificationsForRole, canUserAccessDocument } from '@lib/auth/serverAuth';
import { getBatchById } from '@lib/db/vectorStore';
import { listUserGrantedBatchIds } from '@lib/db/documentGrantStore';

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
    const { query, documentId, allowPublicKnowledge, topK, minSimilarity, bypassCache, sessionId } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Field "query" is required and must not be empty.' },
        { status: 400 }
      );
    }

    const isSuperOrAdmin = authenticatedUser.role_id === 'superadmin' || authenticatedUser.role_id === 'admin';
    const allowedClassifications = getAllowedClassificationsForRole(authenticatedUser.role_id);
    const userDivision = isSuperOrAdmin ? 'all' : (authenticatedUser.department || 'General');

    // Retrieve explicit user access grants from database
    const grantedBatchIds = await listUserGrantedBatchIds(authenticatedUser.id);

    // If specific document target is selected, verify user clearance
    if (documentId) {
      const targetBatch = await getBatchById(documentId);
      if (targetBatch && !canUserAccessDocument(authenticatedUser, targetBatch, grantedBatchIds)) {
        return NextResponse.json(
          {
            answer: 'Data tidak ditemukan di dalam dokumen yang dapat Anda akses.',
            sources: [],
            allowPublicKnowledge: Boolean(allowPublicKnowledge),
            retrievedCount: 0,
          },
          { status: 200 }
        );
      }
    }

    const result = await askDocumentChat(query, {
      documentId: documentId || undefined,
      allowPublicKnowledge: Boolean(allowPublicKnowledge),
      topK: typeof topK === 'number' ? topK : undefined,
      minSimilarity: typeof minSimilarity === 'number' ? minSimilarity : undefined,
      bypassCache: Boolean(bypassCache),
      userId: authenticatedUser.id,
      divisionId: userDivision,
      allowedClassifications: allowedClassifications as any,
      grantedBatchIds,
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
