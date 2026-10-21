import { NextRequest, NextResponse } from 'next/server';
import { getDashboardById, updateDashboardData } from '@lib/db/dashboardStore';
import { getAuthenticatedUser } from '@lib/auth/serverAuth';
import { checkRateLimit, recordRateLimitHit } from '@lib/security/rateLimiter';
import { DashboardData } from '@/types/dashboard';

export const dynamic = 'force-dynamic';

const ALLOWED_WIDGET_TYPES: Set<string> = new Set([
  'stat_card',
  'bar_chart',
  'line_chart',
  'pie_chart',
  'area_chart',
  'list',
  'table',
  'timeline',
  'comparison',
  'text_summary',
]);

const MAX_WIDGETS = 50;
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

    return NextResponse.json({
      dashboardId: record.dashboard_id,
      userId: record.user_id,
      title: record.title,
      data: record.data,
      viewsCount: record.views_count,
      createdAt: record.created_at,
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

    const { data, title } = body as { data: DashboardData; title?: string };

    if (!data || !Array.isArray(data.widgets)) {
      return NextResponse.json({ error: 'Data dashboard tidak valid.' }, { status: 400 });
    }

    if (data.widgets.length > MAX_WIDGETS) {
      return NextResponse.json(
        { error: `Jumlah widget melebihi batas aman (maksimal ${MAX_WIDGETS} widget).` },
        { status: 400 }
      );
    }

    // Validate widget types against whitelist
    for (const w of data.widgets) {
      if (!w || typeof w !== 'object' || !ALLOWED_WIDGET_TYPES.has(w.type)) {
        return NextResponse.json(
          { error: `Tipe widget "${(w as any)?.type}" tidak valid atau tidak diizinkan.` },
          { status: 400 }
        );
      }
    }

    const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 200) : undefined;

    // Record rate limit hit
    recordRateLimitHit(rateLimitKey, RATE_LIMIT_WINDOW_SECONDS);

    const updated = await updateDashboardData(dashboardId, data, cleanTitle);
    if (!updated) {
      return NextResponse.json({ error: 'Dashboard tidak ditemukan untuk diperbarui.' }, { status: 404 });
    }

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
