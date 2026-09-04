import { NextRequest, NextResponse } from 'next/server';
import {
  deleteUploadBatch,
  updateUploadBatchFilename,
  toggleBatchKnowledgeBase,
  listChunks,
  listCuratedInsights,
} from '@lib/db/vectorStore';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
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
    const body = await request.json();
    const { filename, isActiveKnowledge } = body;

    // 1. Aktivasi / Nonaktifkan dokumen sebagai Basis Pengetahuan AI Chatbot
    if (typeof isActiveKnowledge === 'boolean') {
      if (isActiveKnowledge) {
        const rawChunks = await listChunks(id);
        const curated = await listCuratedInsights(id);
        if (rawChunks.length === 0 || curated.length < rawChunks.length) {
          return NextResponse.json(
            { error: 'Dokumen hanya dapat diaktifkan sebagai Basis Pengetahuan AI jika Kurasi Insight telah 100% selesai.' },
            { status: 400 }
          );
        }
      }

      const updated = await toggleBatchKnowledgeBase(id, isActiveKnowledge);
      return NextResponse.json(
        {
          message: isActiveKnowledge
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
