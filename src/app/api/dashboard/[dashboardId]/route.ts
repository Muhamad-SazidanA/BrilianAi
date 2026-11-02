import { NextRequest, NextResponse } from 'next/server';
import {
  getDashboardById,
  updateDashboardData,
  validateDashboardPayload,
  ALLOWED_WIDGET_TYPES,
  MAX_WIDGETS,
} from '@lib/db/dashboardStore';
import { recordAuditEvent } from '@lib/db/auditLogStore';
import { getAuthenticatedUser } from '@lib/auth/serverAuth';
import { checkRateLimit, recordRateLimitHit } from '@lib/security/rateLimiter';
import { DashboardData } from '@/types/dashboard';

export const dynamic = 'force-dynamic';

const RATE_LIMIT_ATTEMPTS = 30;
const RATE_LIMIT_WINDOW_SECONDS = 60;

/**
 * GET /api/dashboard/[dashboardId]
 * Fetch dashboard data by ID (public access - no auth required).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { dashboardId: string } }
) {
  try {
    const { dashboardId } = params;

    if (!dashboardId || typeof dashboardId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(dashboardId)) {
      return NextResponse.json({ error: 'Dashboard ID tidak valid.' }, { status: 400 });
    }

    const record = await getDashboardById(dashboardId);

    if (!record) {
      return NextResponse.json({ error: 'Dashboard tidak ditemukan.' }, { status: 404 });
    }

    // ── Security & Authorization Check ──
    const user = await getAuthenticatedUser(request);
    const isAdmin = Boolean(
      user &&
      (user.role_id === 'admin' ||
       user.role_id === 'superadmin' ||
       user.role?.id === 'admin' ||
       user.role?.id === 'superadmin')
    );
    const isOwner = Boolean(user && (!record.user_id || record.user_id === user.id));

    const { verifyDashboardShareToken, generateDashboardShareToken } = await import('@lib/security/dashboardShareToken');

    const shareTokenParam = request.nextUrl.searchParams.get('share');
    let isShareTokenValid = false;
    if (record.session_id && record.turn_index) {
      isShareTokenValid = verifyDashboardShareToken(
        record.session_id,
        record.turn_index,
        record.dashboard_id,
        shareTokenParam
      );
    }

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

    let shareToken: string | undefined;
    let shareUrl: string | undefined;

    if (record.session_id && record.turn_index) {
      shareToken = generateDashboardShareToken(record.session_id, record.turn_index, record.dashboard_id);

      const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
      const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
      let origin = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
      if (!origin || origin.includes('0.0.0.0')) {
        origin = host && !host.includes('0.0.0.0') ? `${proto}://${host}` : request.nextUrl.origin.replace('0.0.0.0', 'localhost');
      }
      shareUrl = `${origin.replace(/\/+$/, '')}/dashboard/w/${record.session_id}/${record.turn_index}?share=${shareToken}`;
    }

    const actorIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    await recordAuditEvent({
      eventCategory: 'DASHBOARD',
      action: 'dashboard.view',
      actorId: user?.id || null,
      actorName: user?.name || 'Guest (Public View)',
      actorEmail: user?.email || 'guest@public.link',
      actorDepartment: user?.department || (user ? 'General' : 'External'),
      actorIp,
      resourceType: 'dashboard',
      resourceId: record.dashboard_id,
      resourceName: record.title,
      status: 'success',
      details: {
        sessionId: record.session_id,
        turnIndex: record.turn_index,
        viewsCount: record.views_count + 1,
      },
    }).catch((err) => console.warn('[AuditLog] Failed to log public dashboard view:', err));

    return NextResponse.json({
      dashboardId: record.dashboard_id,
      sessionId: record.session_id || null,
      turnIndex: record.turn_index || null,
      userId: record.user_id,
      title: record.title,
      data: record.data,
      viewsCount: record.views_count,
      createdAt: record.created_at,
      canEdit,
      shareToken,
      shareUrl,
    });
  } catch (err: any) {
    console.error('[GET /api/dashboard/:id] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Gagal memuat dashboard.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/dashboard/[dashboardId]
 * Update dashboard widgets and data.
 * Protected with authentication, owner/admin authorization, rate limiting, and widget whitelist.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { dashboardId: string } }
) {
  try {
    const { dashboardId } = params;
    if (!dashboardId || typeof dashboardId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(dashboardId)) {
      return NextResponse.json({ error: 'Dashboard ID tidak valid.' }, { status: 400 });
    }

    // 1. Authentication Check
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Harap login terlebih dahulu untuk menyimpan perubahan dashboard.' },
        { status: 401 }
      );
    }

    // 2. Fetch existing dashboard to check ownership & access
    const existing = await getDashboardById(dashboardId);
    if (!existing) {
      return NextResponse.json({ error: 'Dashboard tidak ditemukan.' }, { status: 404 });
    }

    const isAdmin =
      user.role_id === 'admin' ||
      user.role_id === 'superadmin' ||
      user.role?.id === 'admin' ||
      user.role?.id === 'superadmin';
    const isOwner = !existing.user_id || Boolean(existing.user_id === user.id);

    // Only owner or admin can persist modifications to database
    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: 'Forbidden: Hanya pembuat dashboard atau administrator yang dapat menyimpan perubahan ke database.' },
        { status: 403 }
      );
    }

    // 3. Rate Limiting (30 update / menit)
    const rateLimitKey = `dashboard_patch:${user.id}:${dashboardId}`;
    const rateCheck = checkRateLimit(rateLimitKey, {
      maxAttempts: RATE_LIMIT_ATTEMPTS,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak permintaan update dashboard. Silakan tunggu ${rateCheck.retryAfterSeconds} detik.`,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.retryAfterSeconds),
          },
        }
      );
    }

    // 4. Input & Widget Validation
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 });
    }

    const { data, title } = body as { data?: DashboardData; title?: string };

    const validation = validateDashboardPayload(data);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 200) : undefined;

    // Record rate limit hit
    recordRateLimitHit(rateLimitKey, RATE_LIMIT_WINDOW_SECONDS);

    const updated = await updateDashboardData(dashboardId, data as DashboardData, cleanTitle);
    if (!updated) {
      return NextResponse.json({ error: 'Dashboard tidak ditemukan untuk diperbarui.' }, { status: 404 });
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
    console.error('[PATCH /api/dashboard/:id] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Gagal memperbarui dashboard.' },
      { status: 500 }
    );
  }
}
