import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@lib/auth/serverAuth';
import { getUserById, updateUserPassword } from '@lib/db/userStore';
import { hashPassword, validatePasswordStrength } from '@lib/security/passwordHasher';
import { recordAuditEvent } from '@lib/db/auditLogStore';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const actor = await getAuthenticatedUser(req);
    if (!actor) {
      return NextResponse.json(
        { error: 'Unauthorized: Session required.' },
        { status: 401 }
      );
    }

    const isAdmin = actor.role_id === 'admin' || actor.role_id === 'superadmin';
    const canManageUsers = isAdmin || (actor.role?.permissions?.includes('users:manage') ?? false);

    if (!canManageUsers) {
      return NextResponse.json(
        { error: 'Forbidden: Hak akses users:manage diperlukan untuk mereset password pengguna.' },
        { status: 403 }
      );
    }

    const { id: targetUserId } = params;
    const targetUser = await getUserById(targetUserId);

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Pengguna tidak ditemukan.' },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    let newPassword = (body.newPassword || '').trim();

    // If no password provided, generate a readable 10-char secure temporary password
    const isGenerated = !newPassword;
    if (isGenerated) {
      newPassword = `Brilian#${crypto.randomBytes(3).toString('hex')}`;
    }

    const strengthCheck = validatePasswordStrength(newPassword);
    if (!strengthCheck.valid) {
      return NextResponse.json(
        { error: strengthCheck.error || 'Password tidak memenuhi standar keamanan.' },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(newPassword);
    const success = await updateUserPassword(targetUserId, newHash);

    if (!success) {
      return NextResponse.json(
        { error: 'Gagal memperbarui password pengguna di database.' },
        { status: 500 }
      );
    }

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    await recordAuditEvent({
      eventCategory: 'USER_MGMT',
      action: 'user.password_reset',
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      actorDepartment: actor.department,
      actorIp: clientIp,
      resourceType: 'user',
      resourceId: targetUser.id,
      resourceName: targetUser.name,
      status: 'success',
      details: {
        is_temporary_generated: isGenerated,
        target_email: targetUser.email,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Password untuk ${targetUser.name} berhasil direset.`,
      temporaryPassword: isGenerated ? newPassword : undefined,
    });
  } catch (error: any) {
    console.error('[API /api/users/:id/reset-password] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Terjadi kesalahan sistem saat mereset password.' },
      { status: 500 }
    );
  }
}
