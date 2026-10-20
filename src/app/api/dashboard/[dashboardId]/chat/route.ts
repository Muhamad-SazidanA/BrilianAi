import { NextRequest, NextResponse } from 'next/server';
import { askDashboardCopilot, DashboardCopilotInput } from '@lib/ai/dashboardClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/dashboard/[dashboardId]/chat
 * Interactive Q&A and real-time visualization manipulation copilot for dashboards.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { dashboardId: string } }
) {
  try {
    const { dashboardId } = params;
    if (!dashboardId) {
      return NextResponse.json({ error: 'Dashboard ID diperlukan.' }, { status: 400 });
    }

    const body = await request.json();
    const { message, dashboard, history } = body as DashboardCopilotInput;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Pesan pertanyaan tidak boleh kosong.' }, { status: 400 });
    }

    if (!dashboard || !Array.isArray(dashboard.widgets)) {
      return NextResponse.json({ error: 'Data dashboard tidak valid.' }, { status: 400 });
    }

    const response = await askDashboardCopilot({
      message: message.trim(),
      dashboard,
      history,
    });

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('[POST /api/dashboard/:id/chat] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Gagal memproses interaksi dashboard copilot.' },
      { status: 500 }
    );
  }
}
