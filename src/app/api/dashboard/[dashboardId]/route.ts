import { NextRequest, NextResponse } from 'next/server';
import { getDashboardById } from '@lib/db/dashboardStore';

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
