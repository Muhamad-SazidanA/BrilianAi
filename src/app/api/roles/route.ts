import { NextRequest, NextResponse } from 'next/server';
import { listRoles, createRole } from '@/../lib/db/userStore';
import { PERMISSIONS_CATALOG } from '@/types/user';
import { getAuthenticatedUser, hasServerPermission } from '@lib/auth/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const roles = await listRoles();
    return NextResponse.json({
      roles,
      catalog: PERMISSIONS_CATALOG,
    });
  } catch (err: any) {
    console.error('[API Roles GET] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Gagal mengambil daftar role' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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
    const { id, name, description, permissions } = body;

    if (!id || !name) {
      return NextResponse.json(
        { error: 'ID Role dan Nama Role wajib diisi' },
        { status: 400 }
      );
    }

    const newRole = await createRole({
      id,
      name,
      description: description || '',
      permissions: Array.isArray(permissions) ? permissions : [],
    });

    return NextResponse.json({ role: newRole }, { status: 201 });
  } catch (err: any) {
    console.error('[API Roles POST] Error:', err);
    const isDuplicate = err.message?.includes('duplicate key') || err.message?.includes('roles_pkey');
    return NextResponse.json(
      { error: isDuplicate ? 'ID Role tersebut sudah digunakan' : err.message || 'Gagal membuat role' },
      { status: isDuplicate ? 409 : 500 }
    );
  }
}
