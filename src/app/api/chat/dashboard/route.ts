import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@lib/auth/serverAuth';
import { saveDashboard, getDashboardByMessageId } from '@lib/db/dashboardStore';
import { generateDashboardData } from '@lib/ai/dashboardClient';
import { checkRateLimit, recordRateLimitHit } from '@lib/security/rateLimiter';
import { DashboardData } from '@/types/dashboard';

export const dynamic = 'force-dynamic';

const MAX_ANSWER_LENGTH = 50000;
const MAX_QUERY_LENGTH = 2000;
const RATE_LIMIT_ATTEMPTS = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

/**
 * POST /api/chat/dashboard
 * Transform an AI answer text into a structured interactive dashboard.
 * Uses Multi-Tier Cloud API (Gemini Flash -> OpenAI -> DeepSeek -> Ollama fallback).
 *
 * Body: { messageId, sessionId?, answerText, queryText, forceRegenerate? }
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized: Harap login terlebih dahulu.' }, { status: 401 });
  }

  // Rate Limiting (10 pembuatan dashboard per menit per user)
  const rateLimitKey = `dashboard_build:${user.id}`;
  const rateCheck = checkRateLimit(rateLimitKey, {
    maxAttempts: RATE_LIMIT_ATTEMPTS,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  });

  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: `Batas pembuatan dashboard tercapai (${RATE_LIMIT_ATTEMPTS}/menit). Silakan tunggu ${rateCheck.retryAfterSeconds} detik.`,
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

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 });
    }

    const { messageId, sessionId, answerText, queryText, forceRegenerate } = body as {
      messageId?: string;
      sessionId?: string;
      answerText?: string;
      queryText?: string;
      forceRegenerate?: boolean;
    };

    if (!answerText || typeof answerText !== 'string' || !messageId || typeof messageId !== 'string') {
      return NextResponse.json(
        { error: 'Field answerText dan messageId wajib diisi.' },
        { status: 400 }
      );
    }

    if (answerText.length > MAX_ANSWER_LENGTH) {
      return NextResponse.json(
        { error: `Teks jawaban terlalu panjang (maksimal ${MAX_ANSWER_LENGTH} karakter).` },
        { status: 400 }
      );
    }

    const cleanQuery = typeof queryText === 'string' ? queryText.slice(0, MAX_QUERY_LENGTH) : undefined;

    // Return existing dashboard if already created and user didn't request forceRegenerate
    if (!forceRegenerate) {
      const existing = await getDashboardByMessageId(messageId);
      if (existing) {
        const existingData: DashboardData =
          typeof existing.data === 'string' ? JSON.parse(existing.data) : (existing.data as DashboardData);
        return buildShareResponse(request, existing, existingData);
      }
    }

    // Record rate limit hit on actual LLM generation
    recordRateLimitHit(rateLimitKey, RATE_LIMIT_WINDOW_SECONDS);

    // Generate dashboard using Multi-Tier Cloud API (Gemini -> OpenAI -> DeepSeek -> Ollama)
    const dashboardData = await generateDashboardData({
      queryText: cleanQuery,
      answerText,
      messageId,
    });

    const record = await saveDashboard({
      messageId,
      sessionId: sessionId || null,
      userId: user.id,
      title: dashboardData.title,
      data: dashboardData,
    });

    return buildShareResponse(request, record, dashboardData);
  } catch (err: any) {
    console.error('[POST /api/chat/dashboard] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Gagal membuat dashboard.' },
      { status: 500 }
    );
  }
}

function buildShareResponse(request: NextRequest, record: any, data: DashboardData) {
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

  const publicUrl = `${origin}/dashboard/${record.dashboard_id}`;
  const directUrl = `/dashboard/${record.dashboard_id}`;

  return NextResponse.json({
    success: true,
    dashboardId: record.dashboard_id,
    dashboardUrl: publicUrl,
    directUrl,
    title: data.title,
    widgetCount: data.widgets.length,
    createdAt: record.created_at,
  });
}
