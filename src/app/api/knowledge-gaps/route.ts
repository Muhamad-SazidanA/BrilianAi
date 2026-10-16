import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@lib/auth/serverAuth';
import { listKnowledgeGaps, resolveKnowledgeGap, getKnowledgeGapStats } from '@lib/db/knowledgeGapStore';
import { saveAuditLog } from '@lib/db/auditLogStore';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authenticatedUser = await getAuthenticatedUser(request);
    if (!authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'open';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const [gaps, stats] = await Promise.all([
      listKnowledgeGaps({ status, limit }),
      getKnowledgeGapStats(),
    ]);

    return NextResponse.json({ gaps, stats });
  } catch (error: any) {
    console.error('Error fetching knowledge gaps:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authenticatedUser = await getAuthenticatedUser(request);
    if (!authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, resolutionNote } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: 'Fields "id" and "status" are required.' },
        { status: 400 }
      );
    }

    const success = await resolveKnowledgeGap({
      id,
      status,
      resolvedBy: authenticatedUser.name || authenticatedUser.id,
      resolutionNote,
    });

    if (!success) {
      return NextResponse.json(
        { error: 'Gagal memperbarui status kesenjangan pengetahuan.' },
        { status: 404 }
      );
    }

    await saveAuditLog({
      sessionId: `gap-${id}`,
      userId: authenticatedUser.id,
      userName: authenticatedUser.name,
      userEmail: authenticatedUser.email,
      userDepartment: authenticatedUser.department,
      queryText: `[Knowledge Gap Status: ${status}] Note: ${resolutionNote || 'None'}`,
    }).catch(() => {});

    return NextResponse.json({ success: true, id, status });
  } catch (error: any) {
    console.error('Error updating knowledge gap:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
