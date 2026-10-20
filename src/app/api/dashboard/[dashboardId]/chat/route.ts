import { NextRequest, NextResponse } from 'next/server';
import { askDashboardCopilot, DashboardCopilotInput } from '@lib/ai/dashboardClient';
import { getAuthenticatedUser } from '@lib/auth/serverAuth';
import { checkRateLimit, recordRateLimitHit } from '@lib/security/rateLimiter';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_TURNS = 10;
const MAX_WIDGETS = 50;
const RATE_LIMIT_ATTEMPTS = 15;
const RATE_LIMIT_WINDOW_SECONDS = 60;

/**
 * POST /api/dashboard/[dashboardId]/chat
 * Interactive Q&A and real-time visualization manipulation copilot for dashboards.
 * Protected with authentication, strict rate limiting, and input sanitization boundaries.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { dashboardId: string } }
) {
  try {
    const { dashboardId } = params;
    if (!dashboardId || typeof dashboardId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(dashboardId)) {
      return NextResponse.json({ error: 'Dashboard ID tidak valid.' }, { status: 400 });
    }

    // 1. Authentication Check (User must be logged in to prevent anonymous token abuse)
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Harap login terlebih dahulu untuk menggunakan AI Copilot dashboard.' },
        { status: 401 }
      );
    }

    // 2. Strict Rate Limiting (15 req / minute per user/IP)
    const rateLimitKey = `dashboard_copilot:${user.id}:${dashboardId}`;
    const rateCheck = checkRateLimit(rateLimitKey, {
      maxAttempts: RATE_LIMIT_ATTEMPTS,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Batas frekuensi Copilot tercapai (${RATE_LIMIT_ATTEMPTS} req/menit). Harap tunggu ${rateCheck.retryAfterSeconds} detik sebelum mencoba lagi.`,
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

    // 3. Payload and Input Boundaries
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Payload request tidak valid.' }, { status: 400 });
    }

    const { message, dashboard, history } = body as DashboardCopilotInput;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Pesan pertanyaan tidak boleh kosong.' }, { status: 400 });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Pesan terlalu panjang (maksimal ${MAX_MESSAGE_LENGTH} karakter).` },
        { status: 400 }
      );
    }

    if (!dashboard || !Array.isArray(dashboard.widgets)) {
      return NextResponse.json({ error: 'Data dashboard tidak valid.' }, { status: 400 });
    }

    if (dashboard.widgets.length > MAX_WIDGETS) {
      return NextResponse.json(
        { error: `Jumlah widget melebihi batas aman (maksimal ${MAX_WIDGETS} widget).` },
        { status: 400 }
      );
    }

    // Sanitize conversation history
    const sanitizedHistory = Array.isArray(history)
      ? history
          .slice(-MAX_HISTORY_TURNS)
          .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
          .map((h) => ({
            role: h.role,
            content: h.content.trim().slice(0, MAX_MESSAGE_LENGTH),
          }))
      : [];

    // Increment rate limiter counter
    recordRateLimitHit(rateLimitKey, RATE_LIMIT_WINDOW_SECONDS);

    const response = await askDashboardCopilot({
      message: trimmedMessage,
      dashboard: {
        ...dashboard,
        widgets: dashboard.widgets.slice(0, MAX_WIDGETS),
      },
      history: sanitizedHistory,
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
