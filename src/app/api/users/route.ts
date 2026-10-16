import { NextRequest, NextResponse } from 'next/server';
import { listUsers, createUser } from '@/../lib/db/userStore';
import { getAuthenticatedUser, hasServerPermission } from '@lib/auth/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const canManage = await hasServerPermission(req, 'users:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden: Hak akses users:manage diperlukan.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const roleId = searchParams.get('roleId') || undefined;
    const status = searchParams.get('status') || undefined;

    const users = await listUsers({ search, roleId, status });
    return NextResponse.json({
      users,
      total: users.length,
    });
  } catch (err: any) {
    console.error('[API Users GET] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Gagal mengambil daftar pengguna' },
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

    const canManage = await hasServerPermission(req, 'users:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden: Hak akses users:manage diperlukan.' }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, role_id, department, status, avatar_color } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Nama dan Email wajib diisi' },
        { status: 400 }
      );
    }

    const newUser = await createUser({
      name,
      email,
      role_id: role_id || 'member',
      department: department || 'General',
      status: status || 'active',
      avatar_color,
    });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (err: any) {
    console.error('[API Users POST] Error:', err);
    const isDuplicate = err.message?.includes('duplicate key') || err.message?.includes('users_email_key');
    return NextResponse.json(
      { error: isDuplicate ? 'Alamat email sudah terdaftar' : err.message || 'Gagal membuat pengguna baru' },
      { status: isDuplicate ? 409 : 500 }
    );
  }
}
