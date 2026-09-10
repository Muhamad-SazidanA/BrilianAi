import { getPool } from './dbClient';
import { ChatAuditLog, AuditAnalyticsSummary, TopActiveUser } from '@/types/user';

let isAuditTableInitialized = false;

export function _resetAuditTableInitializedForTesting(): void {
  isAuditTableInitialized = false;
}

/**
 * Ekstraksi topik percakapan secara cerdas dari teks pertanyaan pengguna.
 */
export function extractTopicFromQuery(query: string, answer?: string): string {
  const q = query.toLowerCase();

  // Fisioterapi domain
  if (q.includes('fisioterapi') || q.includes('physiotherapy')) {
    if (q.includes('sejarah') || q.includes('asal') || q.includes('evolusi') || q.includes('hippocrates') || q.includes('galen')) {
      return 'Sejarah & Evolusi Fisioterapi';
    }
    if (q.includes('filosofi') || q.includes('visi') || q.includes('ruang lingkup') || q.includes('prinsip')) {
      return 'Filosofi & Ruang Lingkup FT';
    }
    if (q.includes('permenkes') || q.includes('regulasi') || q.includes('hukum') || q.includes('undang')) {
      return 'Regulasi & Permenkes Fisioterapi';
    }
    if (q.includes('metode') || q.includes('terapi') || q.includes('massage') || q.includes('latihan')) {
      return 'Metode & Intervensi Fisioterapi';
    }
    return 'Konsep & Definisi Fisioterapi';
  }

  // Audit, SOC2, Compliance domain
  if (q.includes('audit') || q.includes('laporan keuangan') || q.includes('financial')) {
    return 'Audit Operasional & Keuangan';
  }
  if (q.includes('soc2') || q.includes('compliance') || q.includes('kepatuhan') || q.includes('iso')) {
    return 'Kepatuhan & Standar SOC2';
  }
  if (q.includes('kebijakan') || q.includes('policy') || q.includes('sop') || q.includes('prosedur')) {
    return 'Kebijakan & SOP Perusahaan';
  }

  // General questions: take first meaningful phrase
  const clean = query
    .replace(/^(apakah|bagaimana|apa itu|jelaskan|terangkan|sebutkan|buatkan)\s+/i, '')
    .trim();

  if (clean.length > 3) {
    const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
    return capitalized.length > 40 ? `${capitalized.substring(0, 37)}...` : capitalized;
  }

  return 'Diskusi Dokumen Umum';
}

/**
 * Memastikan tabel chat_audit_logs ada di PostgreSQL.
 */
export async function ensureAuditLogsTable(): Promise<void> {
  if (isAuditTableInitialized) return;

  try {
    const pool = getPool();
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      CREATE TABLE IF NOT EXISTS chat_audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id VARCHAR(100) NOT NULL,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          user_name VARCHAR(120),
          user_email VARCHAR(150),
          user_department VARCHAR(100),
          query_text TEXT NOT NULL,
          topic VARCHAR(200),
          answer_excerpt TEXT,
          sources_used JSONB NOT NULL DEFAULT '[]',
          retrieved_count INT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_audit_user_id ON chat_audit_logs (user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_audit_created_at ON chat_audit_logs (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_audit_topic ON chat_audit_logs (topic);
      CREATE INDEX IF NOT EXISTS idx_chat_audit_session ON chat_audit_logs (session_id);
    `);
    isAuditTableInitialized = true;
  } catch (err) {
    console.warn('[AuditLogStore] ensureAuditLogsTable warning:', err);
  }
}

export interface CreateAuditLogInput {
  sessionId: string;
  userId?: string | null;
  userName: string;
  userEmail: string;
  userDepartment?: string | null;
  queryText: string;
  answerText?: string | null;
  sources?: any[];
  retrievedCount?: number;
  topic?: string;
}

/**
 * Menyimpan satu entri log audit percakapan ke database.
 */
export async function saveAuditLog(entry: CreateAuditLogInput): Promise<ChatAuditLog> {
  await ensureAuditLogsTable();
  const pool = getPool();

  const detectedTopic = entry.topic || extractTopicFromQuery(entry.queryText, entry.answerText || undefined);
  const excerpt = entry.answerText ? entry.answerText.slice(0, 300) : '';

  const res = await pool.query(
    `
    INSERT INTO chat_audit_logs (
      session_id, user_id, user_name, user_email, user_department,
      query_text, topic, answer_excerpt, sources_used, retrieved_count, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, now())
    RETURNING *
    `,
    [
      entry.sessionId,
      entry.userId || null,
      entry.userName || 'Anonymous User',
      entry.userEmail || 'user@brilian.ai',
      entry.userDepartment || 'General',
      entry.queryText,
      detectedTopic,
      excerpt,
      JSON.stringify(entry.sources || []),
      entry.retrievedCount || (entry.sources ? entry.sources.length : 0),
    ]
  );

  const row = res?.rows?.[0];
  if (!row) {
    return {
      id: 'mock-log-id',
      session_id: entry.sessionId,
      user_id: entry.userId || null,
      user_name: entry.userName || 'Anonymous User',
      user_email: entry.userEmail || 'user@brilian.ai',
      user_department: entry.userDepartment || 'General',
      query_text: entry.queryText,
      topic: detectedTopic,
      answer_excerpt: excerpt,
      sources_used: entry.sources || [],
      retrieved_count: entry.retrievedCount || 0,
      created_at: new Date().toISOString(),
    };
  }

  return {
    id: row.id,
    session_id: row.session_id,
    user_id: row.user_id,
    user_name: row.user_name,
    user_email: row.user_email,
    user_department: row.user_department,
    query_text: row.query_text,
    topic: row.topic,
    answer_excerpt: row.answer_excerpt,
    sources_used: Array.isArray(row.sources_used) ? row.sources_used : [],
    retrieved_count: row.retrieved_count,
    created_at: row.created_at,
  };
}

export interface ListAuditLogsOptions {
  userId?: string;
  search?: string;
  topic?: string;
  dateRange?: 'today' | '7d' | '30d' | 'all';
  page?: number;
  limit?: number;
}

export interface ListAuditLogsResult {
  logs: ChatAuditLog[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Mengambil daftar log percakapan dengan filter pencarian dan paginasi.
 */
export async function listAuditLogs(options?: ListAuditLogsOptions): Promise<ListAuditLogsResult> {
  await ensureAuditLogsTable();
  const pool = getPool();

  const page = Math.max(1, options?.page || 1);
  const limit = Math.min(100, Math.max(1, options?.limit || 20));
  const offset = (page - 1) * limit;

  let whereClauses: string[] = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (options?.userId && options.userId !== 'all') {
    whereClauses.push(`l.user_id = $${paramIdx++}`);
    params.push(options.userId);
  }

  if (options?.search) {
    whereClauses.push(
      `(l.query_text ILIKE $${paramIdx} OR l.topic ILIKE $${paramIdx} OR l.user_name ILIKE $${paramIdx} OR l.user_email ILIKE $${paramIdx})`
    );
    params.push(`%${options.search}%`);
    paramIdx++;
  }

  if (options?.topic && options.topic !== 'all') {
    whereClauses.push(`l.topic = $${paramIdx++}`);
    params.push(options.topic);
  }

  if (options?.dateRange === 'today') {
    whereClauses.push(`l.created_at >= date_trunc('day', now())`);
  } else if (options?.dateRange === '7d') {
    whereClauses.push(`l.created_at >= now() - INTERVAL '7 days'`);
  } else if (options?.dateRange === '30d') {
    whereClauses.push(`l.created_at >= now() - INTERVAL '30 days'`);
  }

  const whereString = whereClauses.join(' AND ');

  // Total count
  const countRes = await pool.query(
    `SELECT COUNT(*) as total FROM chat_audit_logs l WHERE ${whereString}`,
    params
  );
  const total = parseInt(countRes.rows[0].total, 10) || 0;

  // Paginated logs
  const logsRes = await pool.query(
    `
    SELECT 
      l.id, l.session_id, l.user_id, l.user_name, l.user_email, l.user_department,
      l.query_text, l.topic, l.answer_excerpt, l.sources_used, l.retrieved_count, l.created_at
    FROM chat_audit_logs l
    WHERE ${whereString}
    ORDER BY l.created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `,
    [...params, limit, offset]
  );

  const logs: ChatAuditLog[] = logsRes.rows.map((row) => ({
    id: row.id,
    session_id: row.session_id,
    user_id: row.user_id,
    user_name: row.user_name,
    user_email: row.user_email,
    user_department: row.user_department,
    query_text: row.query_text,
    topic: row.topic,
    answer_excerpt: row.answer_excerpt,
    sources_used: Array.isArray(row.sources_used) ? row.sources_used : [],
    retrieved_count: row.retrieved_count,
    created_at: row.created_at,
  }));

  return {
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Mengambil ringkasan analitik audit: Pengguna Teraktif (Leaderboard), Distribusi Topik, dan Total Percakapan.
 */
export async function getAuditAnalytics(): Promise<AuditAnalyticsSummary> {
  await ensureAuditLogsTable();
  const pool = getPool();

  // 1. Total conversations & unique active users
  const totalsRes = await pool.query(`
    SELECT 
      COUNT(*) as total_conversations,
      COUNT(DISTINCT user_id) as total_active_users
    FROM chat_audit_logs
  `);

  const total_conversations = parseInt(totalsRes.rows[0]?.total_conversations, 10) || 0;
  const total_active_users = parseInt(totalsRes.rows[0]?.total_active_users, 10) || 0;

  // 2. Top Topics
  const topicsRes = await pool.query(`
    SELECT topic, COUNT(*) as count
    FROM chat_audit_logs
    WHERE topic IS NOT NULL AND topic != ''
    GROUP BY topic
    ORDER BY count DESC
    LIMIT 6
  `);

  const top_topics = topicsRes.rows.map((r) => ({
    topic: r.topic,
    count: parseInt(r.count, 10) || 0,
  }));

  // 3. Top Active Users Leaderboard
  const usersRes = await pool.query(`
    SELECT 
      l.user_id,
      COALESCE(u.name, l.user_name, 'Anonymous') as name,
      COALESCE(u.email, l.user_email, '-') as email,
      COALESCE(u.department, l.user_department, 'General') as department,
      u.avatar_color,
      r.name as role_name,
      COUNT(*) as total_queries,
      MAX(l.created_at) as last_active,
      ARRAY_AGG(DISTINCT l.topic) FILTER (WHERE l.topic IS NOT NULL AND l.topic != '') as topics
    FROM chat_audit_logs l
    LEFT JOIN users u ON l.user_id = u.id
    LEFT JOIN roles r ON u.role_id = r.id
    GROUP BY l.user_id, u.name, l.user_name, u.email, l.user_email, u.department, l.user_department, u.avatar_color, r.name
    ORDER BY total_queries DESC
    LIMIT 5
  `);

  const top_users: TopActiveUser[] = usersRes.rows.map((row) => ({
    user_id: row.user_id || 'unassigned',
    name: row.name,
    email: row.email,
    department: row.department,
    avatar_color: row.avatar_color || '#2563EB',
    role_name: row.role_name || 'Member',
    total_queries: parseInt(row.total_queries, 10) || 0,
    last_active: row.last_active,
    top_topics: (row.topics || []).slice(0, 3),
  }));

  return {
    total_conversations,
    total_active_users,
    top_topics,
    top_users,
  };
}
