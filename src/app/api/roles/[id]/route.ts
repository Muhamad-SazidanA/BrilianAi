import { NextRequest, NextResponse } from 'next/server';
import { getRoleById, updateRole, deleteRole } from '@/../lib/db/userStore';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
