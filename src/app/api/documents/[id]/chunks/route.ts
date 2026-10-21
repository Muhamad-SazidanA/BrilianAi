import { NextRequest, NextResponse } from 'next/server';
import { listChunks, getBatchById } from '@lib/db/vectorStore';
import { getAuthenticatedUser, canUserAccessDocumentAsync } from '@lib/auth/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Document batch ID is required.' },
        { status: 400 }
      );
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Format ID dokumen tidak valid.' }, { status: 400 });
    }

    const user = await getAuthenticatedUser(req);
    const isAdmin = user?.role_id === 'superadmin' || user?.role_id === 'admin';

    if (!isAdmin && isUuid) {
      const batch = await getBatchById(id);
      if (!batch) {
        return NextResponse.json(
          { error: 'Dokumen tidak ditemukan atau akses ditolak.' },
          { status: 404 }
        );
      }
      const { canAccess } = await canUserAccessDocumentAsync(user, batch);
      if (!canAccess) {
        return NextResponse.json(
          { error: 'Dokumen tidak ditemukan atau akses ditolak.' },
          { status: 404 }
        );
      }
    }

    const chunks = await listChunks(id);
    return NextResponse.json(chunks, { status: 200 });
  } catch (error) {
    console.error(`[API /api/documents/${params?.id}/chunks] Error:`, error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Failed to retrieve document chunks: ${message}` },
      { status: 500 }
    );
  }
}
