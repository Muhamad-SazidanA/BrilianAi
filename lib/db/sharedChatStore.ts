import { getPool } from './dbClient';
import { ChatMessage } from '@/types/chat';
import { generateNanoId } from '@lib/utils/nanoid';

export interface SharedChatRecord {
  share_id: string;
  session_id: string | null;
  user_id?: string | null;
  title: string;
  messages: ChatMessage[];
  views_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Pastikan tabel shared_chats dan kolom penanda last_shared_message_id ada di database.
 */
async function ensureTableExists() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shared_chats (
      share_id VARCHAR(64) PRIMARY KEY,
      session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      title VARCHAR(255) NOT NULL DEFAULT 'Percakapan AI',
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      views_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_shared_chats_session_id ON shared_chats(session_id);

    -- Pastikan kolom last_shared_message_id tersedia di chat_sessions
    ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS last_shared_message_id VARCHAR(64);
  `);
}

/**
 * Buat link share publik baru menggunakan metode Snapshot Statis dan Database Transaction.
 * 
 * - Menyalin riwayat percakapan hingga detik ini ke tabel shared_chats dengan NanoID 11 karakter.
 * - Mengupdate last_shared_message_id pada sesi chat asal.
 * - Menyertakan Try-Catch Loop untuk mengantisipasi collision NanoID pada database secara aman.
 */
export async function createSnapshotShare(params: {
  sessionId?: string | null;
  userId?: string | null;
  title?: string;
  messages: ChatMessage[];
  maxRetries?: number;
}): Promise<{ record: SharedChatRecord; lastSharedMessageId: string | null }> {
  await ensureTableExists();
  const pool = getPool();

  const { sessionId, userId, title = 'Percakapan AI', messages, maxRetries = 5 } = params;

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Percakapan kosong tidak dapat dibagikan.');
  }

  // Snapshot statis pesan hingga saat ini
  const snapshot = messages.map((m) => ({
    id: m.id,
    sender: m.sender,
    text: m.text,
    sources: m.sources,
    timestamp: m.timestamp,
    variants: m.variants,
    currentVariantIndex: m.currentVariantIndex,
  }));

  // Cari ID pesan terakhir yang ikut dibagikan
  const lastMessage = snapshot[snapshot.length - 1];
  const lastSharedMessageId = lastMessage ? lastMessage.id : null;

  let attempts = 0;
  let savedRecord: SharedChatRecord | null = null;

  while (attempts < maxRetries) {
    attempts++;
    const candidateNanoId = generateNanoId(11); // Contoh: "gfxEn46wwaZZ"
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Simpan snapshot statis ke tabel shared_chats
      const insertQuery = `
        INSERT INTO shared_chats (share_id, session_id, user_id, title, messages, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())
        RETURNING *;
      `;
      const insertRes = await client.query(insertQuery, [
        candidateNanoId,
        sessionId || null,
        userId || null,
        title.slice(0, 200),
        JSON.stringify(snapshot),
      ]);

      // 2. Update kolom last_shared_message_id pada tabel chat_sessions asli
      if (sessionId && lastSharedMessageId) {
        await client.query(
          `UPDATE chat_sessions 
           SET last_shared_message_id = $1, updated_at = now() 
           WHERE id = $2`,
          [lastSharedMessageId, sessionId]
        );
      }

      await client.query('COMMIT');

      const row = insertRes.rows[0];
      savedRecord = {
        share_id: row.share_id,
        session_id: row.session_id,
        user_id: row.user_id || null,
        title: row.title,
        messages: Array.isArray(row.messages) ? row.messages : [],
        views_count: Number(row.views_count) || 0,
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      };

      break; // Transaksi sukses, keluar dari loop
    } catch (err: any) {
      await client.query('ROLLBACK');

      // Kode error PostgreSQL 23505: unique_violation (bentrok Primary Key share_id)
      if (err?.code === '23505') {
        console.warn(`[NanoID Collision] ID '${candidateNanoId}' bentrok. Mencoba ulang (${attempts}/${maxRetries})...`);
        if (attempts >= maxRetries) {
          throw new Error('Gagal menghasilkan ID tautan unik setelah beberapa kali percobaan.');
        }
        continue;
      }

      // Jika error lain (bukan collision), lempar langsung
      throw err;
    } finally {
      client.release();
    }
  }

  if (!savedRecord) {
    throw new Error('Gagal membuat snapshot percakapan publik.');
  }

  return { record: savedRecord, lastSharedMessageId };
}

/**
 * Simpan atau perbarui snapshot percakapan untuk link publik.
 */
export async function saveSharedChat(params: {
  shareId: string;
  sessionId?: string | null;
  userId?: string | null;
  title: string;
  messages: ChatMessage[];
}): Promise<SharedChatRecord> {
  await ensureTableExists();
  const pool = getPool();

  const query = `
    INSERT INTO shared_chats (share_id, session_id, user_id, title, messages, updated_at)
    VALUES ($1, $2, $3, $4, $5::jsonb, now())
    ON CONFLICT (share_id) DO UPDATE
    SET title = EXCLUDED.title,
        messages = EXCLUDED.messages,
        updated_at = now()
    RETURNING *;
  `;

  const res = await pool.query(query, [
    params.shareId,
    params.sessionId || null,
    params.userId || null,
    params.title || 'Percakapan AI',
    JSON.stringify(params.messages),
  ]);

  const row = res.rows[0];
  return {
    share_id: row.share_id,
    session_id: row.session_id,
    user_id: row.user_id || null,
    title: row.title,
    messages: Array.isArray(row.messages) ? row.messages : [],
    views_count: Number(row.views_count) || 0,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

/**
 * Ambil percakapan publik berdasarkan share_id (tanpa perlu autentikasi)
 * dan tambahkan views_count secara atomic.
 */
export async function getSharedChat(shareId: string): Promise<SharedChatRecord | null> {
  await ensureTableExists();
  const pool = getPool();

  // Increment views count and return
  const query = `
    UPDATE shared_chats
    SET views_count = views_count + 1
    WHERE share_id = $1
    RETURNING *;
  `;

  const res = await pool.query(query, [shareId]);
  if (!res.rows[0]) return null;

  const row = res.rows[0];
  return {
    share_id: row.share_id,
    session_id: row.session_id,
    user_id: row.user_id || null,
    title: row.title,
    messages: Array.isArray(row.messages) ? row.messages : [],
    views_count: Number(row.views_count) || 0,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

/**
 * Cari existing share_id untuk suatu session_id jika sudah pernah dishare.
 */
export async function findShareIdBySessionId(sessionId: string): Promise<string | null> {
  await ensureTableExists();
  const pool = getPool();

  const res = await pool.query(
    `SELECT share_id FROM shared_chats WHERE session_id = $1 ORDER BY updated_at DESC LIMIT 1`,
    [sessionId]
  );
  return res.rows[0]?.share_id || null;
}
