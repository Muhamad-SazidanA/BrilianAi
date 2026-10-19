import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, hasServerPermission } from '@lib/auth/serverAuth';
import { getBatchById } from '@lib/db/vectorStore';
import {
  listDocumentGrants,
  grantDocumentAccess,
  revokeDocumentAccess,
} from '@lib/db/documentGrantStore';
import { getUserById } from '@lib/db/userStore';

export const dynamic = 'force-dynamic';

async function canManageDocumentAccess(
  user: { id?: string; role_id?: string } | null,
  batch: { owner_id?: string | null } | null
): Promise<boolean> {
  if (!user || !batch) return false;
  // Superadmin & Admin can manage any document access
  if (user.role_id === 'superadmin' || user.role_id === 'admin') return true;
  // Document owner can manage access to their own document
  if (batch.owner_id && user.id && batch.owner_id === user.id) return true;
  // Editor role can manage document access
  if (user.role_id === 'editor') return true;
  return false;
}

/**
 * GET: Lists all users who have explicit access grants to this document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const user = await getAuthenticatedUser(request);
    const batch = await getBatchById(id);

    if (!batch) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });
    }

    const canManage = await canManageDocumentAccess(user, batch);
    if (!canManage) {
      return NextResponse.json(
        { error: 'Forbidden: Anda tidak memiliki izin mengelola hak akses dokumen ini.' },
        { status: 403 }
      );
    }

    let grants: any[] = [];
    try {
      grants = await listDocumentGrants(id);
    } catch (dbErr) {
      console.warn(`[API /api/documents/${id}/grants GET] fallback to empty grants:`, dbErr);
      grants = [];
    }
    return NextResponse.json({ grants }, { status: 200 });
  } catch (error) {
    console.error(`[API /api/documents/${params?.id}/grants GET] Error:`, error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST: Grant or update user access to this document
 * Body: { userId: string, accessLevel: 'viewer' | 'editor' }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const user = await getAuthenticatedUser(request);
    const batch = await getBatchById(id);

    if (!batch) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });
    }

    const canManage = await canManageDocumentAccess(user, batch);
    if (!canManage) {
      return NextResponse.json(
        { error: 'Forbidden: Anda tidak memiliki izin mengelola hak akses dokumen ini.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, accessLevel } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Field "userId" wajib disertakan.' },
        { status: 400 }
      );
    }

    const targetUser = await getUserById(userId);
    if (!targetUser) {
      return NextResponse.json(
        { error: 'Pengguna yang dipilih tidak terdaftar di sistem.' },
        { status: 404 }
      );
    }

    const level: 'viewer' | 'editor' = accessLevel === 'editor' ? 'editor' : 'viewer';

    await grantDocumentAccess(id, userId, level, user?.id);

    return NextResponse.json(
      {
        message: `Hak akses "${level}" berhasil diberikan kepada ${targetUser.name}.`,
        grant: {
          userId,
          accessLevel: level,
          userName: targetUser.name,
          userEmail: targetUser.email,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[API /api/documents/${params?.id}/grants POST] Error:`, error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE: Revoke user access from this document
 * Query or Body: { userId: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const user = await getAuthenticatedUser(request);
    const batch = await getBatchById(id);

    if (!batch) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 });
    }

    const canManage = await canManageDocumentAccess(user, batch);
    if (!canManage) {
      return NextResponse.json(
        { error: 'Forbidden: Anda tidak memiliki izin mengelola hak akses dokumen ini.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    let targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      try {
        const body = await request.json();
        targetUserId = body.userId;
      } catch {
        // no json body
      }
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Parameter "userId" diperlukan untuk mencabut akses.' },
        { status: 400 }
      );
    }

    const revoked = await revokeDocumentAccess(id, targetUserId);

    return NextResponse.json(
      {
        message: revoked
          ? 'Hak akses pengguna berhasil dicabut.'
          : 'Pengguna tidak memiliki hak akses khusus pada dokumen ini.',
        revoked,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[API /api/documents/${params?.id}/grants DELETE] Error:`, error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
