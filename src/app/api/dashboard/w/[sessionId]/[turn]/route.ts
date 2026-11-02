import { NextRequest, NextResponse } from 'next/server';
import {
  getDashboardBySessionAndTurn,
  updateDashboardData,
  validateDashboardPayload,
  ALLOWED_WIDGET_TYPES,
  MAX_WIDGETS,
} from '@lib/db/dashboardStore';
import { recordAuditEvent } from '@lib/db/auditLogStore';
import { getAuthenticatedUser } from '@lib/auth/serverAuth';
import { verifyDashboardShareToken, generateDashboardShareToken } from '@lib/security/dashboardShareToken';
import { isValidChatSessionId } from '@lib/auth/uuid';
import { DashboardData } from '@/types/dashboard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/w/[sessionId]/[turn]
 * Fetch dashboard data by session UUID and turn index (1-indexed).
 *
 * Security:
 * - Session Owner or Admin can access freely.
 * - Non-owner / unauthenticated guest MUST provide valid signed HMAC `?share=[token]`.
 * - If token is missing, invalid, or forged, access is blocked (403 Forbidden).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string; turn: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { sessionId, turn } = resolvedParams;

    if (!sessionId || !isValidChatSessionId(sessionId)) {
      return NextResponse.json({ error: 'Identifier sesi chat tidak valid.' }, { status: 400 });
    }

    const turnIndex = parseInt(turn, 10);
    if (isNaN(turnIndex) || turnIndex < 1) {
      return NextResponse.json({ error: 'Nomor pertanyaan tidak valid (harus angka positif).' }, { status: 400 });
    }

    const record = await getDashboardBySessionAndTurn(sessionId, turnIndex);
    if (!record) {
      return NextResponse.json(
        { error: `Dashboard untuk pertanyaan ke-${turnIndex} tidak ditemukan.` },
        { status: 404 }
      );
    }

    // ── Security & Ownership Validation ──
    const user = await getAuthenticatedUser(request);
    const isAdmin = Boolean(
      user &&
      (user.role_id === 'admin' ||
       user.role_id === 'superadmin' ||
       user.role?.id === 'admin' ||
       user.role?.id === 'superadmin')
    );
    const isOwner = Boolean(user && record.user_id && record.user_id === user.id);

    const shareTokenParam = request.nextUrl.searchParams.get('share');
    const isShareTokenValid = verifyDashboardShareToken(
      sessionId,
      turnIndex,
      record.dashboard_id,
      shareTokenParam
    );

    // If caller is neither owner nor admin, they MUST provide a valid HMAC share token
    if (!isOwner && !isAdmin && !isShareTokenValid) {
      const actorIp =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        '127.0.0.1';

      await recordAuditEvent({
        eventCategory: 'DASHBOARD',
        action: 'dashboard.view_unauthorized',
        actorId: user?.id || null,
        actorName: user?.name || 'Unauthorized Visitor',
        actorEmail: user?.email || 'unauthorized@brilian.ai',
        actorDepartment: user?.department || 'External',
        actorIp,
        resourceType: 'dashboard',
        resourceId: record.dashboard_id,
        resourceName: record.title,
        status: 'warning',
        details: {
          sessionId,
          turnIndex,
          reason: 'Invalid or missing share token',
        },
      }).catch((err) => console.warn('[AuditLog] Failed to log unauthorized view:', err));

      return NextResponse.json(
        {
          error:
            'Akses Ditolak: Anda tidak memiliki izin untuk melihat dashboard ini. Link mungkin telah kedaluwarsa atau tidak valid.',
        },
        { status: 403 }
      );
    }

    const canEdit = Boolean(user && (isAdmin || isOwner));
    const activeShareToken = generateDashboardShareToken(sessionId, turnIndex, record.dashboard_id);

    const host =
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      '';
    const proto =
      request.headers.get('x-forwarded-proto') ||
      (host.includes('localhost') ? 'http' : 'https');

    let origin = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
    if (!origin || origin.includes('0.0.0.0')) {
      if (host && !host.includes('0.0.0.0')) {
        origin = `${proto}://${host}`;
      } else {
        origin = request.nextUrl.origin.replace('0.0.0.0', 'localhost');
      }
    }
    origin = origin.replace(/\/+$/, '');

    const shareUrl = `${origin}/dashboard/w/${sessionId}/${turnIndex}?share=${activeShareToken}`;

    const actorIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    await recordAuditEvent({
      eventCategory: 'DASHBOARD',
      action: 'dashboard.view',
      actorId: user?.id || null,
      actorName: user?.name || (isShareTokenValid ? 'Guest (Shared Link)' : 'Anonymous User'),
      actorEmail: user?.email || (isShareTokenValid ? 'guest@shared.link' : 'anonymous@brilian.ai'),
      actorDepartment: user?.department || (user ? 'General' : 'External'),
      actorIp,
      resourceType: 'dashboard',
      resourceId: record.dashboard_id,
      resourceName: record.title,
      status: 'success',
      details: {
        sessionId,
        turnIndex,
        isOwner,
        isAdmin,
        isSharedLink: Boolean(!isOwner && !isAdmin && isShareTokenValid),
        viewsCount: record.views_count + 1,
      },
    }).catch((err) => console.warn('[AuditLog] Failed to log dashboard view:', err));

    return NextResponse.json({
      dashboardId: record.dashboard_id,
      sessionId: record.session_id,
      turnIndex: record.turn_index,
      userId: record.user_id,
      title: record.title,
      data: record.data,
      viewsCount: record.views_count,
      createdAt: record.created_at,
      canEdit,
      shareToken: activeShareToken,
      shareUrl,
    });
  } catch (err: any) {
    console.error('[GET /api/dashboard/w/:sessionId/:turn] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Gagal memuat dashboard.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/dashboard/w/[sessionId]/[turn]
 * Update dashboard layout/widgets by session UUID and turn index.
 * Only owner or admin may update.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { sessionId: string; turn: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { sessionId, turn } = resolvedParams;

    if (!sessionId || !isValidChatSessionId(sessionId)) {
      return NextResponse.json({ error: 'Identifier sesi chat tidak valid.' }, { status: 400 });
    }

    const turnIndex = parseInt(turn, 10);
    if (isNaN(turnIndex) || turnIndex < 1) {
      return NextResponse.json({ error: 'Nomor pertanyaan tidak valid.' }, { status: 400 });
    }

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Harap login terlebih dahulu untuk menyimpan perubahan dashboard.' },
        { status: 401 }
      );
    }

    const record = await getDashboardBySessionAndTurn(sessionId, turnIndex);
    if (!record) {
      return NextResponse.json(
        { error: `Dashboard untuk pertanyaan ke-${turnIndex} tidak ditemukan.` },
        { status: 404 }
      );
    }

    const isOwner = Boolean(record.user_id && record.user_id === user.id);
    const isAdmin = Boolean(
      user.role_id === 'admin' ||
      user.role_id === 'superadmin' ||
      user.role?.id === 'admin' ||
      user.role?.id === 'superadmin'
    );

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Anda tidak memiliki izin untuk mengedit layout dashboard ini.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 });
    }

    const { data: updatedData, title } = body as { data?: DashboardData; title?: string };
    const validation = validateDashboardPayload(updatedData);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updated = await updateDashboardData(record.dashboard_id, updatedData as DashboardData, title);
    if (!updated) {
      return NextResponse.json({ error: 'Gagal memperbarui dashboard.' }, { status: 500 });
    }

    const actorIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    await recordAuditEvent({
      eventCategory: 'DASHBOARD',
      action: 'dashboard.update',
      actorId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      actorDepartment: user.department || 'General',
      actorIp,
      resourceType: 'dashboard',
      resourceId: updated.dashboard_id,
      resourceName: updated.title,
      status: 'success',
      details: {
        sessionId,
        turnIndex,
        widgetCount: updated.data?.widgets?.length || 0,
      },
    }).catch((err) => console.warn('[AuditLog] Failed to log dashboard update:', err));

    return NextResponse.json({
      success: true,
      dashboardId: updated.dashboard_id,
      title: updated.title,
      data: updated.data,
      updatedAt: updated.updated_at,
    });
  } catch (err: any) {
    console.error('[PATCH /api/dashboard/w/:sessionId/:turn] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Gagal memperbarui dashboard.' },
      { status: 500 }
    );
  }
}
