import { NextRequest, NextResponse } from 'next/server';
import {
  deleteUploadBatch,
  updateUploadBatchFilename,
  toggleBatchKnowledgeBase,
  updateBatchMetadata,
  listChunks,
  getBatchById,
} from '@lib/db/vectorStore';
import { abortCuration } from '@lib/curation/curationService';
import { getAuthenticatedUser, canUserAccessDocumentAsync } from '@lib/auth/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const user = await getAuthenticatedUser(request);
    const batch = await getBatchById(id);

    if (!batch) {
      return NextResponse.json(
        { error: 'Dokumen tidak ditemukan atau akses ditolak.' },
        { status: 404 }
      );
    }

    const { canAccess, canEdit, accessLevel } = await canUserAccessDocumentAsync(user, batch);
    if (!canAccess) {
      return NextResponse.json(
        { error: 'Dokumen tidak ditemukan atau akses ditolak.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ...batch, can_edit: canEdit, user_access_level: accessLevel }, { status: 200 });
  } catch (error) {
    console.error('[API /api/documents/[id] GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const user = await getAuthenticatedUser(request);
    const batch = await getBatchById(id);

    if (!batch) {
      return NextResponse.json(
        { error: 'Dokumen tidak ditemukan atau sudah dihapus.' },
        { status: 404 }
      );
    }

    const isOwner = batch.owner_id && user?.id && batch.owner_id === user.id;
    const isAdmin = user?.role_id === 'superadmin' || user?.role_id === 'admin';
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Hanya pemilik dokumen atau administrator yang dapat menghapus dokumen.' },
        { status: 403 }
      );
    }

    // Hentikan kurasi jika dokumen sedang diproses AI di background
    abortCuration(id);
    const success = await deleteUploadBatch(id);

    if (!success) {
      return NextResponse.json(
        { error: 'Dokumen tidak ditemukan atau sudah dihapus.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Dokumen beserta seluruh chunks dan insight berhasil dihapus.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /api/documents/[id] DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Gagal menghapus dokumen: ${message}` },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const user = await getAuthenticatedUser(request);
    const batch = await getBatchById(id);

    if (!batch) {
      return NextResponse.json(
        { error: 'Dokumen tidak ditemukan atau akses ditolak.' },
        { status: 404 }
      );
    }

    const { canEdit } = await canUserAccessDocumentAsync(user, batch);
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden: Anda hanya memiliki izin melihat (Viewer) untuk dokumen ini.' },
        { status: 403 }
      );
    }
    const body = await request.json();
    const { filename, status, classification, divisionId, version, reviewDueDate } = body;
    const targetActiveKnowledge =
      typeof body.isActiveKnowledge === 'boolean'
        ? body.isActiveKnowledge
        : typeof body.is_active_knowledge === 'boolean'
        ? body.is_active_knowledge
        : undefined;

    // 1. Update lifecycle status atau metadata ABAC jika ada
    if (status || classification || divisionId || version || reviewDueDate !== undefined) {
      if (status === 'Aktif') {
        const batch = await getBatchById(id);
        if (!batch) {
          return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });
        }
        if ((batch.curated_count || 0) === 0) {
          return NextResponse.json(
            { error: 'Dokumen belum memiliki insight terkurasi. Lakukan kurasi dokumen terlebih dahulu sebelum menyetel status Aktif.' },
            { status: 400 }
          );
        }
      }

      const updated = await updateBatchMetadata(id, {
        status,
        classification,
        divisionId,
        version,
        reviewDueDate,
      });
      return NextResponse.json(
        {
          message: 'Metadata dokumen berhasil diperbarui.',
          data: updated,
        },
        { status: 200 }
      );
    }

    // 2. Aktivasi / Nonaktifkan dokumen sebagai Basis Pengetahuan AI Chatbot
    if (typeof targetActiveKnowledge === 'boolean') {
      if (targetActiveKnowledge) {
        const batch = await getBatchById(id);
        if (!batch) {
          return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });
        }
        if ((batch.chunk_count || 0) === 0) {
          return NextResponse.json(
            { error: 'Dokumen tidak memiliki potongan teks (chunk) yang valid untuk diaktifkan.' },
            { status: 400 }
          );
        }
        if ((batch.curated_count || 0) === 0) {
          return NextResponse.json(
            { error: 'Dokumen belum memiliki insight terkurasi. Lakukan kurasi dokumen terlebih dahulu sebelum mengaktifkannya sebagai Basis Pengetahuan AI.' },
            { status: 400 }
          );
        }
      }

      const updated = await toggleBatchKnowledgeBase(id, targetActiveKnowledge);
      return NextResponse.json(
        {
          message: targetActiveKnowledge
            ? 'Dokumen berhasil diaktifkan sebagai Basis Pengetahuan AI Chatbot.'
            : 'Dokumen dinonaktifkan dari Basis Pengetahuan AI Chatbot.',
          data: updated,
        },
        { status: 200 }
      );
    }

    // 2. Rename nama dokumen
    if (!filename || typeof filename !== 'string' || filename.trim().length === 0) {
      return NextResponse.json(
        { error: 'Field "filename" atau "isActiveKnowledge" diperlukan.' },
        { status: 400 }
      );
    }

    const updated = await updateUploadBatchFilename(id, filename.trim());
    return NextResponse.json(
      { message: 'Nama dokumen berhasil diperbarui.', data: updated },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /api/documents/[id] PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Gagal memperbarui status dokumen: ${message}` },
      { status: 500 }
    );
  }
}
