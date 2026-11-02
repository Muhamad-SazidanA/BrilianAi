import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@lib/auth/serverAuth';
import {
  getUserAuthByEmailOrUsername,
  updateUserPassword,
} from '@lib/db/userStore';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from '@lib/security/passwordHasher';
import { recordAuditEvent } from '@lib/db/auditLogStore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Sesi login diperlukan untuk mengganti password.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json(
        { error: 'Password baru wajib diisi.' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'Konfirmasi password baru tidak cocok.' },
        { status: 400 }
      );
    }

    const strengthCheck = validatePasswordStrength(newPassword);
    if (!strengthCheck.valid) {
      return NextResponse.json(
        { error: strengthCheck.error || 'Password baru tidak memenuhi standar keamanan.' },
        { status: 400 }
      );
    }

    // Retrieve user's current authentication credentials
    const userAuth = await getUserAuthByEmailOrUsername(user.email);
    if (!userAuth) {
      return NextResponse.json(
        { error: 'Akun pengguna tidak ditemukan.' },
        { status: 404 }
      );
    }

    // Verify current password
    let isCurrentValid = false;
    if (userAuth.password_hash) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Password saat ini wajib diisi.' },
          { status: 400 }
        );
      }
      isCurrentValid = await verifyPassword(currentPassword, userAuth.password_hash);
    } else {
      // First time setting password: verify against default env password
      const envSuperadminPassword = (process.env.SUPERADMIN_PASSWORD || 'admin123').trim();
      isCurrentValid =
        !currentPassword ||
        currentPassword === envSuperadminPassword ||
        currentPassword === 'admin123';
    }

    if (!isCurrentValid) {
      return NextResponse.json(
        { error: 'Password saat ini yang Anda masukkan salah.' },
        { status: 400 }
      );
    }

    // Hash new password and update
    const newHash = await hashPassword(newPassword);
    const success = await updateUserPassword(user.id, newHash);

    if (!success) {
      return NextResponse.json(
        { error: 'Gagal memperbarui password di database.' },
        { status: 500 }
      );
    }

    // Record audit event
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    await recordAuditEvent({
      eventCategory: 'AUTH',
      action: 'auth.password_changed',
      actorId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      actorDepartment: user.department,
      actorIp: clientIp,
      resourceType: 'user',
      resourceId: user.id,
      resourceName: user.name,
      status: 'success',
      details: {
        method: 'self_service',
      },
    }).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        message: 'Password akun Anda berhasil diperbarui dengan aman.',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API /api/auth/change-password] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Terjadi kesalahan sistem saat memperbarui password.' },
      { status: 500 }
    );
  }
}

