import { NextRequest, NextResponse } from 'next/server';
import { askDocumentChat, askDocumentChatStream } from '@lib/chat/chatService';
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
    const { query, documentId, allowPublicKnowledge, topK, minSimilarity, bypassCache, sessionId, stream } = body;

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
        const notFoundPayload = {
          answer: 'Data tidak ditemukan di dalam dokumen yang dapat Anda akses.',
          sources: [],
          allowPublicKnowledge: Boolean(allowPublicKnowledge),
          retrievedCount: 0,
        };
        if (stream) {
          const encoder = new TextEncoder();
          const readable = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', ...notFoundPayload })}\n\n`));
              controller.close();
            },
          });
          return new Response(readable, {
            headers: {
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              'Connection': 'keep-alive',
            },
          });
        }
        return NextResponse.json(notFoundPayload, { status: 200 });
      }
    }

    const chatOptions = {
      documentId: documentId || undefined,
      allowPublicKnowledge: Boolean(allowPublicKnowledge),
      topK: typeof topK === 'number' ? topK : undefined,
      minSimilarity: typeof minSimilarity === 'number' ? minSimilarity : undefined,
      bypassCache: Boolean(bypassCache),
      userId: authenticatedUser.id,
      divisionId: userDivision,
      allowedClassifications: allowedClassifications as any,
      grantedBatchIds,
    };

    const isStreamingRequested = Boolean(stream) || request.headers.get('accept')?.includes('text/event-stream');

    if (isStreamingRequested) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          let isClosed = false;
          const sendEvent = (data: any) => {
            if (isClosed) return;
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            } catch {
              isClosed = true;
            }
          };

          try {
            await askDocumentChatStream(query, chatOptions, {
              onSources(sources) {
                sendEvent({ type: 'sources', sources });
              },
              onToken(token) {
                sendEvent({ type: 'token', token });
              },
              async onDone(result) {
                sendEvent({
                  type: 'done',
                  answer: result.answer,
                  sources: result.sources,
                  retrievedCount: result.retrievedCount,
                });

                // Record audit log with guaranteed delivery before stream shutdown
                try {
                  await saveAuditLog({
                    sessionId: sessionId || `sess-${Date.now()}`,
                    userId: authenticatedUser.id,
                    userName: authenticatedUser.name,
                    userEmail: authenticatedUser.email,
                    userDepartment: authenticatedUser.department,
                    queryText: query.trim(),
                    answerText: result.answer,
                    sources: result.sources,
                    retrievedCount: result.retrievedCount,
                  });
                } catch (err) {
                  console.warn('[API /api/chat] Failed to record audit log:', err);
                }

                if (!isClosed) {
                  isClosed = true;
                  try {
                    controller.close();
                  } catch {}
                }
              },
              onError(err) {
                sendEvent({ type: 'error', error: err.message });
                if (!isClosed) {
                  isClosed = true;
                  try {
                    controller.close();
                  } catch {}
                }
              },
            });
          } catch (streamErr: any) {
            sendEvent({ type: 'error', error: streamErr?.message || 'Gagal memproses streaming' });
            if (!isClosed) {
              isClosed = true;
              try {
                controller.close();
              } catch {}
            }
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // Default Non-Streaming Fallback
    const result = await askDocumentChat(query, chatOptions);

    // Record audit log with guaranteed delivery before response return
    try {
      await saveAuditLog({
        sessionId: sessionId || `sess-${Date.now()}`,
        userId: authenticatedUser.id,
        userName: authenticatedUser.name,
        userEmail: authenticatedUser.email,
        userDepartment: authenticatedUser.department,
        queryText: query.trim(),
        answerText: result.answer,
        sources: result.sources,
        retrievedCount: result.retrievedCount,
      });
    } catch (err) {
      console.warn('[API /api/chat] Failed to record audit log:', err);
    }

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
