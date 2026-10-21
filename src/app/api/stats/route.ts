import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/../lib/db/dbClient';
import { getAuthenticatedUser } from '@lib/auth/serverAuth';
import { ensureSessionsTable } from '@/../lib/db/sessionStore';
import { ensureAuditLogsTable } from '@/../lib/db/auditLogStore';
import { getKnowledgeGapStats } from '@/../lib/db/knowledgeGapStore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const pool = getPool();
    const authenticatedUser = await getAuthenticatedUser(req);
    if (!authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const isAdminOrAuditor =
      authenticatedUser.role_id === 'admin' ||
      authenticatedUser.role_id === 'superadmin' ||
      Boolean(authenticatedUser.role?.permissions.includes('audit:read')) ||
      Boolean(authenticatedUser.role?.permissions.includes('users:manage'));

    // Ensure all optional tables exist before querying
    await Promise.all([
      ensureSessionsTable().catch(() => {}),
      ensureAuditLogsTable().catch(() => {}),
    ]);

    // 1. Fetch Aggregated Document & Vector Metrics
    const statsQuery = `
      SELECT 
        COUNT(*)::int AS total_documents,
        COALESCE(SUM(chunk_count), 0)::int AS total_chunks,
        COALESCE(SUM(page_count), 0)::int AS total_pages,
        COUNT(CASE WHEN is_active_knowledge = TRUE THEN 1 END)::int AS active_knowledge_count
      FROM upload_batches;
    `;
    const statsResult = await pool.query(statsQuery);
    const row = statsResult.rows[0] || {
      total_documents: 0,
      total_chunks: 0,
      total_pages: 0,
      active_knowledge_count: 0,
    };

    // 2. Fetch Recent Batches (up to 5)
    const recentQuery = `
      SELECT 
        id, 
        original_filename, 
        chunk_count, 
        page_count, 
        uploaded_at, 
        is_active_knowledge
      FROM upload_batches
      ORDER BY uploaded_at DESC
      LIMIT 5;
    `;
    const recentResult = await pool.query(recentQuery);

    // 3. Multi-Agent Cloud status
    const geminiActive = Boolean(process.env.GEMINI_API_KEY);
    const openAiActive = Boolean(process.env.OPENAI_API_KEY);
    const deepseekActive = Boolean(process.env.DEEPSEEK_API_KEY);
    const allAiOnline = geminiActive && openAiActive && deepseekActive;

    // 4. Fetch Recent Logins (Last 5 sessions with user details) - restricted to admins/auditors
    let recentLogins: any[] = [];
    if (isAdminOrAuditor) {
      try {
        const loginsRes = await pool.query(`
          SELECT 
            s.id,
            s.user_id,
            s.ip_address,
            s.user_agent,
            s.created_at,
            COALESCE(u.name, 'Pengguna') as user_name,
            COALESCE(u.email, '-') as user_email,
            COALESCE(u.avatar_color, '#2563EB') as avatar_color,
            COALESCE(r.name, 'Member') as user_role
          FROM user_sessions s
          LEFT JOIN users u ON s.user_id = u.id
          LEFT JOIN roles r ON u.role_id = r.id
          ORDER BY s.created_at DESC
          LIMIT 5;
        `);
        recentLogins = loginsRes.rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          userName: r.user_name,
          userEmail: r.user_email,
          userRole: r.user_role,
          avatarColor: r.avatar_color,
          ipAddress: r.ip_address,
          userAgent: r.user_agent,
          createdAt: r.created_at,
        }));
      } catch (err) {
        console.warn('[API /api/stats] Error querying recentLogins:', err);
      }
    }

    // 5. Fetch Attention Items (Pending users, open gaps, negative feedback)
    let pendingUsers: any[] = [];
    let pendingUsersCount = 0;
    if (isAdminOrAuditor) {
      try {
        const pendingRes = await pool.query(`
          SELECT id, name, email, created_at
          FROM users
          WHERE status = 'pending_approval'
          ORDER BY created_at DESC
          LIMIT 5;
        `);
        pendingUsers = pendingRes.rows.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          createdAt: u.created_at,
        }));

        const countRes = await pool.query(`
          SELECT COUNT(*)::int as count FROM users WHERE status = 'pending_approval';
        `);
        pendingUsersCount = countRes.rows[0]?.count || 0;
      } catch (err) {
        console.warn('[API /api/stats] Error querying pending users:', err);
      }
    }

    let recentGaps: any[] = [];
    let knowledgeGapsCount = 0;
    try {
      const gapsRes = await pool.query(`
        SELECT id, query_text, created_at
        FROM knowledge_gaps
        WHERE status = 'open'
        ORDER BY created_at DESC
        LIMIT 5;
      `);
      recentGaps = gapsRes.rows.map((g) => ({
        id: g.id,
        queryText: g.query_text,
        createdAt: g.created_at,
      }));

      const gapsCountRes = await pool.query(`
        SELECT COUNT(*)::int as count FROM knowledge_gaps WHERE status = 'open';
      `);
      knowledgeGapsCount = gapsCountRes.rows[0]?.count || 0;
    } catch (err) {
      console.warn('[API /api/stats] Error querying knowledge gaps:', err);
    }

    let negativeFeedbackCount = 0;
    try {
      const feedbackRes = await pool.query(`
        SELECT COUNT(*)::int as count
        FROM answer_feedback
        WHERE rating IN ('incorrect', 'outdated');
      `);
      negativeFeedbackCount = feedbackRes.rows[0]?.count || 0;
    } catch (err) {
      console.warn('[API /api/stats] Error querying feedback:', err);
    }

    // 6. Fetch 14-day Activity Trend & Top Topics
    let points: any[] = [];
    let totalCurrent = 0;
    let totalPrevious = 0;
    let topTopics: any[] = [];

    try {
      // Query daily counts for past 14 days
      const trendRes = await pool.query(`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM-DD') as day_key,
          COUNT(*)::int as query_count
        FROM chat_audit_logs
        WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
        ORDER BY day_key ASC;
      `);

      const countMap = new Map<string, number>();
      for (const r of trendRes.rows) {
        countMap.set(r.day_key, r.query_count);
      }

      // Generate 7 days points (Day 6 ago ... Day 0 ago) vs (Day 13 ago ... Day 7 ago)
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const currentDate = new Date(now);
        currentDate.setDate(now.getDate() - i);
        const currentKey = currentDate.toISOString().split('T')[0];

        const previousDate = new Date(now);
        previousDate.setDate(now.getDate() - (i + 7));
        const previousKey = previousDate.toISOString().split('T')[0];

        const currCount = countMap.get(currentKey) || 0;
        const prevCount = countMap.get(previousKey) || 0;

        totalCurrent += currCount;
        totalPrevious += prevCount;

        const dayName = currentDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

        points.push({
          date: currentKey,
          label: dayName,
          current: currCount,
          previous: prevCount,
        });
      }

      // Query top topics
      const topicsRes = await pool.query(`
        SELECT topic, COUNT(*)::int as count
        FROM chat_audit_logs
        WHERE topic IS NOT NULL AND topic != ''
        GROUP BY topic
        ORDER BY count DESC
        LIMIT 5;
      `);

      const totalTopicQueries = topicsRes.rows.reduce((acc, t) => acc + t.count, 0) || 1;
      topTopics = topicsRes.rows.map((t) => ({
        topic: t.topic,
        count: t.count,
        percentage: Math.round((t.count / totalTopicQueries) * 100),
      }));
    } catch (err) {
      console.warn('[API /api/stats] Error querying activity trend:', err);
    }

    const changePercentage =
      totalPrevious > 0
        ? Math.round(((totalCurrent - totalPrevious) / totalPrevious) * 100)
        : totalCurrent > 0
        ? 100
        : 0;

    // 7. Personal Stats for the current user
    let personalStats = undefined;
    if (authenticatedUser?.id) {
      try {
        const personalSessionRes = await pool.query(
          `SELECT COUNT(*)::int as count FROM chat_sessions WHERE user_id = $1;`,
          [authenticatedUser.id]
        );
        const personalQueryRes = await pool.query(
          `SELECT COUNT(*)::int as count FROM chat_audit_logs WHERE user_id = $1;`,
          [authenticatedUser.id]
        );
        const lastSessionRes = await pool.query(
          `SELECT id, title, updated_at FROM chat_sessions WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1;`,
          [authenticatedUser.id]
        );

        personalStats = {
          totalSessions: personalSessionRes.rows[0]?.count || 0,
          totalQueries: personalQueryRes.rows[0]?.count || 0,
          lastActiveSession: lastSessionRes.rows[0]
            ? {
                id: lastSessionRes.rows[0].id,
                title: lastSessionRes.rows[0].title || 'Percakapan AI',
                updatedAt: lastSessionRes.rows[0].updated_at,
              }
            : undefined,
        };
      } catch (err) {
        console.warn('[API /api/stats] Error querying personal stats:', err);
      }
    }

    return NextResponse.json({
      totalDocuments: row.total_documents,
      totalChunks: row.total_chunks,
      totalPages: row.total_pages,
      activeKnowledgeCount: row.active_knowledge_count,
      systemHealth: {
        postgres: true,
        ollama: allAiOnline,
        visionModel: 'Brilian Vision OCR Engine',
        embeddingModel: 'Dense Vector Embedding (1024-dim)',
        multiAgent: {
          geminiVision: geminiActive,
          openAiEmbedding: openAiActive,
          deepseekSynthesizer: deepseekActive,
        },
      },
      recentBatches: recentResult.rows,
      recentLogins,
      attention: {
        pendingUsersCount,
        pendingUsers,
        knowledgeGapsCount,
        recentGaps,
        negativeFeedbackCount,
        errorCount: 0,
      },
      trend: {
        points,
        totalCurrent,
        totalPrevious,
        changePercentage,
        topTopics,
      },
      personal: personalStats,
    });
  } catch (error: any) {
    console.warn('[API /api/stats] Database offline/not ready:', error?.message);

    const geminiActive = Boolean(process.env.GEMINI_API_KEY);
    const openAiActive = Boolean(process.env.OPENAI_API_KEY);
    const deepseekActive = Boolean(process.env.DEEPSEEK_API_KEY);
    const allAiOnline = geminiActive && openAiActive && deepseekActive;

    return NextResponse.json({
      totalDocuments: 0,
      totalChunks: 0,
      totalPages: 0,
      activeKnowledgeCount: 0,
      systemHealth: {
        postgres: false,
        ollama: allAiOnline,
        visionModel: 'Brilian Vision OCR Engine',
        embeddingModel: 'Dense Vector Embedding (1024-dim)',
        multiAgent: {
          geminiVision: geminiActive,
          openAiEmbedding: openAiActive,
          deepseekSynthesizer: deepseekActive,
        },
      },
      recentBatches: [],
      recentLogins: [],
      attention: {
        pendingUsersCount: 0,
        pendingUsers: [],
        knowledgeGapsCount: 0,
        recentGaps: [],
        negativeFeedbackCount: 0,
        errorCount: 0,
      },
      trend: {
        points: [],
        totalCurrent: 0,
        totalPrevious: 0,
        changePercentage: 0,
        topTopics: [],
      },
      error: error.message || 'Database error',
    });
  }
}
