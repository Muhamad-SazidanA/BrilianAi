import { Client as PgClient } from 'pg';
import mysql from 'mysql2/promise';
import { chunkWithPageOffsets, PageText } from '../chunking/splitWithPageTracking';
import { embedTexts } from '../ai/embeddingClient';
import { createUploadBatch, insertChunks } from '../db/vectorStore';
import { bulkGrantDocumentAccess } from '../db/documentGrantStore';
import { formatRowsToMarkdownTable } from '../ingest/documentExtractors';
import { encryptSecret, decryptSecret } from './credentialVault';
import type { DocumentClassification, DocumentStatus } from '@/types/document';

export type SupportedDbType = 'postgres' | 'mysql';

export interface DbConnectorConfig {
  dbType: SupportedDbType;
  sourceName: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  encryptedPassword?: string;
  ssl?: boolean;
  query: string;
  // ABAC & Metadata
  ownerId?: string | null;
  divisionId?: string;
  classification?: DocumentClassification;
  status?: DocumentStatus;
  version?: string;
  reviewDueDate?: Date | string | null;
  userGrants?: Array<{ userId: string; accessLevel: 'viewer' | 'editor' }>;
}

export interface DbTestResult {
  success: boolean;
  latencyMs: number;
  serverVersion?: string;
  error?: string;
}

export interface DbPreviewResult {
  success: boolean;
  sourceName: string;
  columnCount: number;
  rowCount: number;
  previewMarkdown: string;
  columns: string[];
}

/**
 * Validasi ketat bahwa query SQL adalah SELECT murni (Read-Only Guard).
 * Menolak instruksi mutasi data (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, EXEC, dll).
 */
export function validateReadOnlyQuery(query: string): { isValid: boolean; error?: string } {
  const clean = query.trim().replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '').trim();

  if (!clean) {
    return { isValid: false, error: 'Query SQL tidak boleh kosong.' };
  }

  // Cek apakah diawali dengan SELECT atau WITH (CTE)
  const isSelect = /^(\s*WITH\s+[\s\S]+?\s+)?\s*SELECT\b/i.test(clean);
  if (!isSelect) {
    return {
      isValid: false,
      error: 'Query ditolak: Hanya perintah kueri baca (SELECT) yang diizinkan demi keamanan database.',
    };
  }

  // Cek adanya kata kunci mutasi berbahaya
  const destructiveKeywords = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|EXEC|EXECUTE|CREATE|GRANT|REVOKE|RENAME)\b/i;
  if (destructiveKeywords.test(clean)) {
    return {
      isValid: false,
      error: 'Query ditolak: Terdeteksi kata kunci mutasi atau manipulasi struktur tabel berbahaya.',
    };
  }

  return { isValid: true };
}

/**
 * Mendapatkan password bersih (dekripsi jika berbentuk encrypted cipher).
 */
function resolvePassword(config: DbConnectorConfig): string {
  if (config.password) return config.password;
  if (config.encryptedPassword) return decryptSecret(config.encryptedPassword);
  return '';
}

/**
 * Menguji koneksi soket ke database target (handshake & ping).
 */
export async function testDbConnection(config: DbConnectorConfig): Promise<DbTestResult> {
  const start = Date.now();
  const password = resolvePassword(config);

  if (config.dbType === 'postgres') {
    const client = new PgClient({
      host: config.host,
      port: config.port || 5432,
      database: config.database,
      user: config.username,
      password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 7000,
    });

    try {
      await client.connect();
      const res = await client.query('SELECT version();');
      const latencyMs = Date.now() - start;
      const versionStr = res.rows[0]?.version || 'PostgreSQL';
      await client.end();
      return { success: true, latencyMs, serverVersion: versionStr.split(' on ')[0] };
    } catch (err: any) {
      try { await client.end(); } catch {}
      return { success: false, latencyMs: Date.now() - start, error: err.message || 'Koneksi PostgreSQL gagal' };
    }
  }

  if (config.dbType === 'mysql') {
    try {
      const connection = await mysql.createConnection({
        host: config.host,
        port: config.port || 3306,
        database: config.database,
        user: config.username,
        password,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
        connectTimeout: 7000,
      });

      const [rows] = await connection.query('SELECT VERSION() as v;');
      const latencyMs = Date.now() - start;
      const versionStr = Array.isArray(rows) && (rows[0] as any)?.v ? `MySQL ${(rows[0] as any).v}` : 'MySQL';
      await connection.end();
      return { success: true, latencyMs, serverVersion: versionStr };
    } catch (err: any) {
      return { success: false, latencyMs: Date.now() - start, error: err.message || 'Koneksi MySQL gagal' };
    }
  }

  return { success: false, latencyMs: 0, error: `Tipe database "${config.dbType}" belum didukung.` };
}

/**
 * Mengeksekusi query SELECT yang aman dan mengambil rows serta kolom.
 */
export async function executeSafeQuery(
  config: DbConnectorConfig,
  maxRows = 500
): Promise<{ rows: any[]; columns: string[] }> {
  const validation = validateReadOnlyQuery(config.query);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const password = resolvePassword(config);
  // Tambahkan limit jika belum memiliki limit eksplisit
  let limitedQuery = config.query.trim().replace(/;+$/, '');
  if (!/\bLIMIT\s+\d+/i.test(limitedQuery)) {
    limitedQuery = `${limitedQuery} LIMIT ${maxRows}`;
  }

  if (config.dbType === 'postgres') {
    const client = new PgClient({
      host: config.host,
      port: config.port || 5432,
      database: config.database,
      user: config.username,
      password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      statement_timeout: 15000,
    });

    try {
      await client.connect();
      const res = await client.query(limitedQuery);
      await client.end();
      const columns = res.fields ? res.fields.map(f => f.name) : Object.keys(res.rows[0] || {});
      return { rows: res.rows, columns };
    } catch (err) {
      try { await client.end(); } catch {}
      throw err;
    }
  }

  if (config.dbType === 'mysql') {
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port || 3306,
      database: config.database,
      user: config.username,
      password,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    });

    try {
      const [rows, fields] = await connection.query(limitedQuery);
      await connection.end();
      const rowList = Array.isArray(rows) ? (rows as any[]) : [];
      const columns = fields ? fields.map(f => f.name) : Object.keys(rowList[0] || {});
      return { rows: rowList, columns };
    } catch (err) {
      try { await connection.end(); } catch {}
      throw err;
    }
  }

  throw new Error(`Tipe database "${config.dbType}" tidak didukung.`);
}

/**
 * Preview query database ke format Markdown table.
 */
export async function testAndPreviewDb(config: DbConnectorConfig): Promise<DbPreviewResult> {
  const { rows, columns } = await executeSafeQuery(config, 20);

  if (rows.length === 0) {
    return {
      success: true,
      sourceName: config.sourceName,
      columnCount: columns.length,
      rowCount: 0,
      previewMarkdown: `*(Query berhasil dijalankan, namun tidak ada baris data yang dikembalikan)*`,
      columns,
    };
  }

  // Format ke 2D array
  const tableData: any[][] = [columns];
  for (const row of rows) {
    tableData.push(columns.map(col => row[col]));
  }

  const tableMd = formatRowsToMarkdownTable(tableData);
  return {
    success: true,
    sourceName: config.sourceName,
    columnCount: columns.length,
    rowCount: rows.length,
    previewMarkdown: tableMd,
    columns,
  };
}

/**
 * Sinkronisasi data dari Database Langsung ke pgvector.
 */
export async function syncDatabaseConnector(config: DbConnectorConfig): Promise<{
  uploadBatchId: string;
  sourceName: string;
  originalFilename: string;
  rowCount: number;
  chunkCount: number;
}> {
  const { rows, columns } = await executeSafeQuery(config, 500);

  if (rows.length === 0) {
    throw new Error('Query database tidak mengembalikan data. Pastikan tabel memiliki baris data.');
  }

  const sourceName = config.sourceName?.trim() || `${config.dbType.toUpperCase()} - ${config.database}`;
  const originalFilename = `[DB] ${sourceName} (${config.database})`;

  // Paginasi baris tabel menjadi halaman-halaman virtual (50 baris per halaman)
  const rowsPerPage = 50;
  const pagesText: PageText[] = [];
  const header = columns;

  const totalPages = Math.ceil(rows.length / rowsPerPage);
  for (let p = 0; p < totalPages; p++) {
    const startIdx = p * rowsPerPage;
    const endIdx = Math.min(startIdx + rowsPerPage, rows.length);
    const chunkRows = rows.slice(startIdx, endIdx);

    const tableData: any[][] = [header];
    for (const r of chunkRows) {
      tableData.push(columns.map(col => r[col]));
    }

    const tableMd = formatRowsToMarkdownTable(tableData);
    pagesText.push({
      pageNumber: p + 1,
      text: `## Tabel: ${sourceName} (Baris ${startIdx + 1} - ${endIdx} dari ${rows.length})\n\n${tableMd}`,
    });
  }

  // Chunking sliding window
  const chunks = await chunkWithPageOffsets(pagesText, 800, 150);
  const chunkCount = chunks.length;

  // Embedding
  const chunkContents = chunks.map(c => c.content);
  const embeddings = chunkCount > 0 ? await embedTexts(chunkContents) : [];

  // Create upload batch
  const batchId = await createUploadBatch(originalFilename, pagesText.length, {
    ownerId: config.ownerId || null,
    divisionId: config.divisionId || 'General',
    classification: config.classification || 'Internal',
    status: config.status || 'Draft',
    version: config.version || '1.0',
    reviewDueDate: config.reviewDueDate || null,
  });

  // Simpan chunks ke pgvector
  if (chunkCount > 0) {
    const chunkInputs = chunks.map((chunk, index) => ({
      content: chunk.content,
      sourcePageStart: chunk.sourcePageStart,
      sourcePageEnd: chunk.sourcePageEnd,
      embedding: embeddings[index] || new Array(1024).fill(0),
    }));
    await insertChunks(batchId, chunkInputs);
  } else {
    await insertChunks(batchId, []);
  }

  // User Grants ABAC
  if (Array.isArray(config.userGrants) && config.userGrants.length > 0 && config.ownerId) {
    await bulkGrantDocumentAccess(batchId, config.userGrants, config.ownerId);
  }

  console.log(`[DatabaseConnector] Sukses ingest query DB "${originalFilename}" (${rows.length} rows, ${chunkCount} chunks) ke pgvector.`);

  return {
    uploadBatchId: batchId,
    sourceName,
    originalFilename,
    rowCount: rows.length,
    chunkCount,
  };
}
