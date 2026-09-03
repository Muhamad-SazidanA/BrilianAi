import { NextRequest, NextResponse } from 'next/server';
import { deleteUploadBatch, updateUploadBatchFilename } from '@lib/db/vectorStore';

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
    const { filename } = body;

    if (!filename || typeof filename !== 'string' || filename.trim().length === 0) {
      return NextResponse.json(
        { error: 'Field "filename" tidak boleh kosong.' },
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
      { error: `Gagal memperbarui nama dokumen: ${message}` },
      { status: 500 }
    );
  }
}
