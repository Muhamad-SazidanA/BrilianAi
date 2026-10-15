import { NextRequest, NextResponse } from 'next/server';
import { listChunks, getBatchById } from '@lib/db/vectorStore';
import { getAuthenticatedUser, canUserAccessDocument } from '@lib/auth/serverAuth';

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

    const user = await getAuthenticatedUser(req);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isUuid) {
      const batch = await getBatchById(id);
      if (batch && !canUserAccessDocument(user, batch)) {
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
