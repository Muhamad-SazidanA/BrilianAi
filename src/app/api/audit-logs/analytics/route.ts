import { NextRequest, NextResponse } from 'next/server';
import { getAuditAnalytics } from '@/../lib/db/auditLogStore';
import { getAuthenticatedUser, hasServerPermission } from '@lib/auth/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const canReadAudit = await hasServerPermission(req, 'audit:read');
    if (!canReadAudit) {
      return NextResponse.json(
        { error: 'Forbidden: Hak akses audit:read diperlukan untuk melihat analitik.' },
        { status: 403 }
      );
    }

    const summary = await getAuditAnalytics();
    return NextResponse.json(summary);
  } catch (err: any) {
    console.error('[API Audit Analytics GET] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Gagal memuat analitik percakapan pengguna' },
      { status: 500 }
    );
  }
}
