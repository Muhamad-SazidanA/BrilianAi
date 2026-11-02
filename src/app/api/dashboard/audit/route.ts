import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@lib/auth/serverAuth';
import { recordAuditEvent } from '@lib/db/auditLogStore';

export const dynamic = 'force-dynamic';

const ALLOWED_ACTIONS = new Set([
  'dashboard.export_pdf',
  'dashboard.share',
  'dashboard.view',
]);

/**
 * POST /api/dashboard/audit
 * Record client-triggered dashboard audit events (e.g. PDF Export, Share).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 });
    }

    const { action, dashboardId, sessionId, turnIndex, title, details } = body as {
      action?: string;
      dashboardId?: string;
      sessionId?: string;
      turnIndex?: number;
      title?: string;
      details?: Record<string, any>;
    };

    if (!action || !ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json({ error: 'Aksi audit tidak didukung.' }, { status: 400 });
    }

    if (!dashboardId || typeof dashboardId !== 'string') {
      return NextResponse.json({ error: 'dashboardId wajib diisi.' }, { status: 400 });
    }

    const user = await getAuthenticatedUser(request);
    const actorIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    await recordAuditEvent({
      eventCategory: 'DASHBOARD',
      action,
      actorId: user?.id || null,
      actorName: user?.name || 'Guest (Shared Link)',
      actorEmail: user?.email || 'guest@shared.link',
      actorDepartment: user?.department || (user ? 'General' : 'External'),
      actorIp,
      resourceType: 'dashboard',
      resourceId: dashboardId,
      resourceName: title || 'Interactive Dashboard',
      status: 'success',
      details: {
        ...(details || {}),
        sessionId: sessionId || null,
        turnIndex: typeof turnIndex === 'number' ? turnIndex : null,
        isGuest: !user,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[POST /api/dashboard/audit] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Gagal mencatat audit event dashboard.' },
      { status: 500 }
    );
  }
}
