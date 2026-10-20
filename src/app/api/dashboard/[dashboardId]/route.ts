import { NextRequest, NextResponse } from 'next/server';
import { getDashboardById, updateDashboardData } from '@lib/db/dashboardStore';
import { DashboardData } from '@/types/dashboard';

export const dynamic = 'force-dynamic';

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

    if (!dashboardId) {
      return NextResponse.json({ error: 'Dashboard ID tidak ditemukan.' }, { status: 400 });
    }

    const record = await getDashboardById(dashboardId);

    if (!record) {
      return NextResponse.json({ error: 'Dashboard tidak ditemukan.' }, { status: 404 });
    }

    return NextResponse.json({
      dashboardId: record.dashboard_id,
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
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { dashboardId: string } }
) {
  try {
    const { dashboardId } = params;
    if (!dashboardId) {
      return NextResponse.json({ error: 'Dashboard ID diperlukan.' }, { status: 400 });
    }

    const body = await request.json();
    const { data, title } = body as { data: DashboardData; title?: string };

    if (!data || !Array.isArray(data.widgets)) {
      return NextResponse.json({ error: 'Data dashboard tidak valid.' }, { status: 400 });
    }

    const updated = await updateDashboardData(dashboardId, data, title);
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
