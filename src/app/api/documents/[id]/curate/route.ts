import { NextRequest, NextResponse } from 'next/server';
import { listCuratedInsights, deduplicateCuratedInsights, createManualCuratedInsight, getBatchById } from '@lib/db/vectorStore';
import { curateBatch, curateAllChunks, isBatchCurating, getCurationProgress } from '@lib/curation/curationService';
import { getAuthenticatedUser, hasServerPermission, canUserAccessDocumentAsync } from '@lib/auth/serverAuth';
import { embedTexts } from '@lib/ai/embeddingClient';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const authUser = await getAuthenticatedUser(request);
    if (!authUser && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const isAdmin = authUser?.role_id === 'superadmin' || authUser?.role_id === 'admin';
    if (!isAdmin && authUser) {
      const batch = await getBatchById(id);
      if (!batch) {
        return NextResponse.json(
          { error: 'Dokumen tidak ditemukan atau akses ditolak.' },
          { status: 404 }
        );
      }
      const { canAccess } = await canUserAccessDocumentAsync(authUser, batch);
      if (!canAccess) {
        return NextResponse.json(
          { error: 'Dokumen tidak ditemukan atau akses ditolak.' },
          { status: 404 }
        );
      }
    }

    const insights = await listCuratedInsights(id);
    return NextResponse.json(insights, { status: 200 });
  } catch (error) {
    console.error('[API /api/documents/[id]/curate GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Gagal mengambil insight kurasi: ${message}` },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const { id } = params;
    let body: any = null;
    try {
      body = await request.json();
    } catch {
      // optional body
    }

    // 1. Penambahan Manual Insight (dari modal "+ Tambah Manual")
    if (body?.manualInsight) {
      const canEdit = await hasServerPermission(request, 'curation:edit');
      if (!canEdit) {
        return NextResponse.json(
          { error: 'Forbidden: Hak akses curation:edit diperlukan untuk menambah insight manual.' },
          { status: 403 }
        );
      }

      const { title, content, importance, category, tags, sourcePages } = body.manualInsight;
      if (!title || !content) {
        return NextResponse.json(
          { error: 'Judul (title) dan intisari (content) wajib diisi.' },
          { status: 400 }
        );
      }

      let embedding: number[] | undefined = undefined;
      const textToEmbed = `${title}\n${content}`.trim();
      if (textToEmbed) {
        try {
          const [vector] = await embedTexts([textToEmbed]);
          if (vector) embedding = vector;
        } catch (embErr) {
          console.warn('[API /curate POST] embedTexts warning for manual insight:', embErr);
        }
      }

      const created = await createManualCuratedInsight(id, {
        title,
        content,
        importance,
        category,
        tags: Array.isArray(tags) ? tags : [],
        sourcePages: sourcePages || '',
        embedding,
      });

      return NextResponse.json(
        {
          message: 'Insight manual berhasil disimpan dan diindeks.',
          data: created,
        },
        { status: 201 }
      );
    }

    // 2. Trigger Kurasi AI Otomatis
    const canCurate = await hasServerPermission(request, 'curation:trigger');
    if (!canCurate) {
      return NextResponse.json(
        { error: 'Forbidden: Hak akses curation:trigger diperlukan.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const syncParam = searchParams.get('sync');
    const limitParam = searchParams.get('limit');
    const recurate = body?.recurate === true || searchParams.get('recurate') === 'true';

    // Bersihkan duplikat bila ada
    await deduplicateCuratedInsights(id);

    // Mode synchronous legacy (jika diminta via query param ?sync=true)
    if (syncParam === 'true') {
      const limit = limitParam ? parseInt(limitParam, 10) : 25;
      const curated = await curateBatch(id, limit);
      return NextResponse.json(
        {
          message: 'Kurasi AI berhasil diselesaikan.',
          count: curated.length,
          data: curated,
        },
        { status: 200 }
      );
    }

    // Cek jika proses kurasi sedang berlangsung
    if (isBatchCurating(id)) {
      const progress = await getCurationProgress(id);
      return NextResponse.json(
        {
          message: 'Kurasi AI untuk dokumen ini sedang berjalan.',
          progress,
        },
        { status: 200 }
      );
    }

    // Jalankan kurasi menyeluruh dengan update progres 1-100%
    curateAllChunks(id, 20, { recurate }).catch((err) => {
      console.error(`[API /curate POST] Background curateAllChunks error for batch ${id}:`, err);
    });

    const initialProgress = await getCurationProgress(id);
    return NextResponse.json(
      {
        message: recurate ? 'Kurasi ulang AI berhasil dimulai.' : 'Kurasi AI berhasil dimulai.',
        progress: initialProgress,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error('[API /api/documents/[id]/curate POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Gagal menjalankan kurasi AI: ${message}` },
      { status: 500 }
    );
  }
}
