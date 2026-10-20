import { NextRequest, NextResponse } from 'next/server';
import { updateCuratedInsight, deleteCuratedInsight } from '@lib/db/vectorStore';
import { embedTexts } from '@lib/ai/embeddingClient';
import { getAuthenticatedUser, hasServerPermission } from '@lib/auth/serverAuth';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; insightId: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const canEdit = await hasServerPermission(request, 'curation:edit');
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden: Hak akses curation:edit diperlukan.' },
        { status: 403 }
      );
    }

    const { insightId } = params;
    const body = await request.json();
    const { title, content, importance, category, tags } = body;

    let embedding: number[] | undefined = undefined;
    if (title || content) {
      const textToEmbed = `${title || ''}\n${content || ''}`.trim();
      if (textToEmbed) {
        const [vector] = await embedTexts([textToEmbed]);
        if (vector) embedding = vector;
      }
    }

    const updated = await updateCuratedInsight(insightId, {
      title,
      content,
      importance,
      category,
      tags,
      embedding,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error('[API /api/documents/[id]/curate/[insightId] PUT] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Gagal memperbarui insight kurasi: ${message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; insightId: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const canDelete = await hasServerPermission(request, 'curation:delete');
    if (!canDelete) {
      return NextResponse.json(
        { error: 'Forbidden: Hak akses curation:delete diperlukan.' },
        { status: 403 }
      );
    }

    const { insightId } = params;
    const result = await deleteCuratedInsight(insightId);

    if (!result.deleted) {
      return NextResponse.json(
        { error: 'Insight kurasi tidak ditemukan atau sudah dihapus.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: result.wasDeactivated
          ? 'Insight berhasil dihapus. Seluruh insight telah habis sehingga status dokumen otomatis dinonaktifkan ke "Menunggu Kurasi".'
          : 'Insight kurasi berhasil dihapus.',
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /api/documents/[id]/curate/[insightId] DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Gagal menghapus insight kurasi: ${message}` },
      { status: 500 }
    );
  }
}

