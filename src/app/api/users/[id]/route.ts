import { NextRequest, NextResponse } from 'next/server';
import { getUserById, updateUser, deleteUser } from '@/../lib/db/userStore';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    const body = await req.json();
    const updated = await updateUser(params.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }
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
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const success = await deleteUser(params.id);
    if (!success) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Pengguna berhasil dihapus' });
  } catch (err: any) {
    console.error('[API User DELETE] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Gagal menghapus pengguna' },
      { status: 400 }
    );
  }
}
