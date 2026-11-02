import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@lib/auth/serverAuth';
import { saveDashboard, getDashboardByMessageId } from '@lib/db/dashboardStore';
import { recordAuditEvent } from '@lib/db/auditLogStore';
import { generateDashboardData } from '@lib/ai/dashboardClient';
import { checkRateLimit, recordRateLimitHit } from '@lib/security/rateLimiter';
import { checkDashboardEligibility } from '@lib/utils/dashboardEligibility';
import { generateDashboardShareToken } from '@lib/security/dashboardShareToken';
import { getPool } from '@lib/db/dbClient';
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
 * Body: { messageId, sessionId?, turnIndex?, answerText, queryText, forceRegenerate? }
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

    const { messageId, sessionId, turnIndex: rawTurnIndex, answerText, queryText, forceRegenerate } = body as {
      messageId?: string;
      sessionId?: string;
      turnIndex?: number;
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

    // Compute turnIndex if not explicitly provided
    let turnIndex: number | null = typeof rawTurnIndex === 'number' && rawTurnIndex > 0 ? rawTurnIndex : null;
    if (!turnIndex && sessionId) {
      try {
        const pool = getPool();
        const sessionRes = await pool.query<{ messages: any[] }>(
          `SELECT messages FROM chat_sessions WHERE id = $1 LIMIT 1`,
          [sessionId]
        );
        if (sessionRes.rows[0]?.messages && Array.isArray(sessionRes.rows[0].messages)) {
          const msgs = sessionRes.rows[0].messages;
          let count = 0;
          for (let i = 0; i < msgs.length; i++) {
            if (msgs[i].sender === 'user') {
              count++;
            }
            if (msgs[i].id === messageId) {
              turnIndex = count;
              break;
            }
          }
        }
      } catch (err) {
        console.warn('[POST /api/chat/dashboard] Error computing turnIndex:', err);
      }
    }
    if (!turnIndex) {
      turnIndex = 1;
    }

    // Return existing dashboard if already created and user didn't request forceRegenerate
    if (!forceRegenerate) {
      const existing = await getDashboardByMessageId(messageId);
      if (existing) {
        const existingData: DashboardData =
          typeof existing.data === 'string' ? JSON.parse(existing.data) : (existing.data as DashboardData);
        // Backfill turn_index and session_id if missing
        if (!existing.turn_index && turnIndex) {
          existing.turn_index = turnIndex;
        }
        if (!existing.session_id && sessionId) {
          existing.session_id = sessionId;
        }

        const actorIp =
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') ||
          '127.0.0.1';

        await recordAuditEvent({
          eventCategory: 'DASHBOARD',
          action: 'dashboard.reuse_existing',
          actorId: user.id,
          actorName: user.name,
          actorEmail: user.email,
          actorDepartment: user.department || 'General',
          actorIp,
          resourceType: 'dashboard',
          resourceId: existing.dashboard_id,
          resourceName: existing.title || existingData.title,
          status: 'success',
          details: {
            messageId,
            sessionId: existing.session_id,
            turnIndex: existing.turn_index,
            widgetCount: existingData.widgets?.length || 0,
          },
        }).catch((err) => console.warn('[AuditLog] Failed to log existing dashboard reuse:', err));

        return buildShareResponse(request, existing, existingData);
      }
    }

    // Validate eligibility (must contain quantifiable or structured data)
    const eligibility = checkDashboardEligibility(answerText);
    if (!eligibility.eligible && !forceRegenerate) {
      return NextResponse.json(
        {
          error:
            'Teks jawaban ini tidak memenuhi syarat untuk dijadikan dashboard: ' +
            (eligibility.reason || 'Data metrik, tabel, atau list terstruktur tidak mencukupi.'),
          eligibility,
        },
        { status: 422 }
      );
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
      turnIndex,
      userId: user.id,
      title: dashboardData.title,
      data: dashboardData,
    });

    const actorIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    await recordAuditEvent({
      eventCategory: 'DASHBOARD',
      action: 'dashboard.create',
      actorId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      actorDepartment: user.department || 'General',
      actorIp,
      resourceType: 'dashboard',
      resourceId: record.dashboard_id,
      resourceName: record.title || dashboardData.title,
      status: 'success',
      details: {
        messageId,
        sessionId: record.session_id,
        turnIndex: record.turn_index,
        widgetCount: dashboardData.widgets.length,
        forceRegenerate: Boolean(forceRegenerate),
      },
    }).catch((err) => console.warn('[AuditLog] Failed to log dashboard creation:', err));

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

  const hasSessionAndTurn = Boolean(record.session_id && record.turn_index);
  let shareToken = '';
  let dashboardUrl = `${origin}/dashboard/w/${record.session_id || 'default'}/${record.turn_index || 1}`;
  let shareUrl = `${origin}/dashboard/w/${record.session_id || 'default'}/${record.turn_index || 1}`;
  let directUrl = `/dashboard/w/${record.session_id || 'default'}/${record.turn_index || 1}`;

  if (hasSessionAndTurn) {
    shareToken = generateDashboardShareToken(record.session_id, record.turn_index, record.dashboard_id);
    dashboardUrl = `${origin}/dashboard/w/${record.session_id}/${record.turn_index}`;
    shareUrl = `${origin}/dashboard/w/${record.session_id}/${record.turn_index}?share=${shareToken}`;
    directUrl = `/dashboard/w/${record.session_id}/${record.turn_index}`;
  }

  return NextResponse.json({
    success: true,
    dashboardId: record.dashboard_id,
    sessionId: record.session_id || null,
    turnIndex: record.turn_index || null,
    dashboardUrl,
    shareUrl,
    shareToken,
    directUrl,
    title: data.title,
    widgetCount: data.widgets.length,
    createdAt: record.created_at,
  });
}
