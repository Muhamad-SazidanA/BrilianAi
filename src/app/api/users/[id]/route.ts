import { NextRequest, NextResponse } from 'next/server';
import { getUserById, updateUser, deleteUser } from '@/../lib/db/userStore';
import { getAuthenticatedUser, hasServerPermission } from '@lib/auth/serverAuth';
import { recordAuditEvent } from '@/../lib/db/auditLogStore';

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

    const canManage = await hasServerPermission(req, 'users:manage');
    const isSelf = authUser.id === params.id;
    if (!canManage && !isSelf) {
      return NextResponse.json({ error: 'Forbidden: Akses ditolak.' }, { status: 403 });
    }

    const user = await getUserById(params.id);
    if (!user) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ user });
  } catch (err: any) {
    console.error('[API User GET by ID] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Gagal memuat pengguna' },
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

    const canManage = await hasServerPermission(req, 'users:manage');
    const isSelf = authUser.id === params.id;
    if (!canManage && !isSelf) {
      return NextResponse.json({ error: 'Forbidden: Hak akses users:manage diperlukan.' }, { status: 403 });
    }

    const body = await req.json();

    // Regular users cannot escalate their own role or change their own approval status
    if (!canManage && (body.role_id !== undefined || body.status !== undefined)) {
      return NextResponse.json(
        { error: 'Forbidden: Hanya administrator yang dapat mengubah role atau status akun.' },
        { status: 403 }
      );
    }

    const updated = await updateUser(params.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    try {
      await recordAuditEvent({
        eventCategory: 'USER_MGMT',
        action: body.status === 'active' && updated.status === 'active' ? 'user.approve' : 'user.update',
        actorId: authUser.id,
        actorName: authUser.name,
        actorEmail: authUser.email,
        actorDepartment: authUser.department,
        resourceType: 'user',
        resourceId: updated.id,
        resourceName: `${updated.name} (${updated.email})`,
        status: 'success',
        details: { updates: body },
      });
    } catch {}

    return NextResponse.json({ user: updated });
  } catch (err: any) {
    console.error('[API User PATCH] Error:', err);
    const isDuplicate = err.message?.includes('duplicate key') || err.message?.includes('users_email_key');
    return NextResponse.json(
      { error: isDuplicate ? 'Alamat email sudah digunakan' : err.message || 'Gagal memperbarui pengguna' },
      { status: isDuplicate ? 409 : 500 }
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

    const canManage = await hasServerPermission(req, 'users:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden: Hak akses users:manage diperlukan.' }, { status: 403 });
    }

    if (authUser.id === params.id) {
      return NextResponse.json(
        { error: 'Tidak dapat menghapus akun Anda sendiri saat sedang login.' },
        { status: 400 }
      );
    }

    const targetUser = await getUserById(params.id).catch(() => null);
    const success = await deleteUser(params.id);
    if (!success) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    try {
      await recordAuditEvent({
        eventCategory: 'USER_MGMT',
        action: 'user.delete',
        actorId: authUser.id,
        actorName: authUser.name,
        actorEmail: authUser.email,
        actorDepartment: authUser.department,
        resourceType: 'user',
        resourceId: params.id,
        resourceName: targetUser ? `${targetUser.name} (${targetUser.email})` : `User ${params.id}`,
        status: 'success',
      });
    } catch {}

    return NextResponse.json({ success: true, message: 'Pengguna berhasil dihapus' });
  } catch (err: any) {
    console.error('[API User DELETE] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Gagal menghapus pengguna' },
      { status: 400 }
    );
  }
}
