import { NextRequest, NextResponse } from 'next/server';
import { getRoleById, updateRole, deleteRole } from '@/../lib/db/userStore';
import { getAuthenticatedUser, hasServerPermission } from '@lib/auth/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const role = await getRoleById(params.id);
    if (!role) {
      return NextResponse.json({ error: 'Role tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ role });
  } catch (err: any) {
    console.error('[API Role GET by ID] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Gagal memuat role' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const canManageRoles = await hasServerPermission(req, 'roles:manage');
    if (!canManageRoles) {
      return NextResponse.json({ error: 'Forbidden: Hak akses roles:manage diperlukan.' }, { status: 403 });
    }

    const body = await req.json();
    const updated = await updateRole(params.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Role tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ role: updated });
  } catch (err: any) {
    console.error('[API Role PATCH] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Gagal memperbarui role' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const canManageRoles = await hasServerPermission(req, 'roles:manage');
    if (!canManageRoles) {
      return NextResponse.json({ error: 'Forbidden: Hak akses roles:manage diperlukan.' }, { status: 403 });
    }

    const success = await deleteRole(params.id);
    if (!success) {
      return NextResponse.json({ error: 'Role tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Role berhasil dihapus' });
  } catch (err: any) {
    console.error('[API Role DELETE] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Gagal menghapus role' },
      { status: 400 }
    );
  }
}
