import { NextRequest, NextResponse } from 'next/server';
import { listBatches, activateAllBatches } from '@lib/db/vectorStore';
import { getAuthenticatedUser, canUserAccessDocument } from '@lib/auth/serverAuth';
import { listUserGrantedBatchIds } from '@lib/db/documentGrantStore';

export const dynamic = 'force-dynamic';

export async function GET(request?: NextRequest) {
  try {
    const allBatches = await listBatches();
    if (!request) {
      return NextResponse.json(allBatches, { status: 200 });
    }

    const user = await getAuthenticatedUser(request);
    const grantedBatchList = user?.id ? await listUserGrantedBatchIds(user.id) : [];
    const grantedBatchSet = new Set(grantedBatchList);

    // Enterprise ABAC + User Grant filter
    const visibleBatches = allBatches
      .filter((batch) => canUserAccessDocument(user, batch, grantedBatchSet))
      .map((batch) => ({
        ...batch,
        has_user_grant: grantedBatchSet.has(batch.id),
      }));

    return NextResponse.json(visibleBatches, { status: 200 });
  } catch (error) {
    console.error('[API /api/documents] Error fetching batches:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Failed to retrieve upload batches: ${message}` },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { activateAll } = body;
    if (typeof activateAll === 'boolean') {
      const count = await activateAllBatches(activateAll);
      return NextResponse.json(
        {
          message: activateAll
            ? `Berhasil mengaktifkan seluruh ${count} dokumen untuk AI Chatbot.`
            : `Seluruh dokumen dinonaktifkan dari AI Chatbot.`,
          count,
        },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { error: 'Field "activateAll" diperlukan.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API /api/documents PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
