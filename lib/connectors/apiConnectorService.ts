import { chunkWithPageOffsets, PageText } from '../chunking/splitWithPageTracking';
import { embedTexts } from '../ai/embeddingClient';
import { createUploadBatch, insertChunks } from '../db/vectorStore';
import { bulkGrantDocumentAccess } from '../db/documentGrantStore';
import type { DocumentClassification, DocumentStatus } from '@/types/document';

export interface ApiConnectorConfig {
  sourceName: string;
  endpointUrl: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  bodyPayload?: any;
  authType?: 'none' | 'bearer' | 'apiKey' | 'basic';
  authToken?: string;
  apiKeyHeader?: string;
  basicUsername?: string;
  basicPassword?: string;
  recordPath?: string; // e.g. "data.items" or "results"
  chunkSize?: number;
  chunkOverlap?: number;
  // Metadata & ABAC:
  ownerId?: string | null;
  divisionId?: string;
  classification?: DocumentClassification;
  status?: DocumentStatus;
  version?: string;
  reviewDueDate?: Date | string | null;
  userGrants?: Array<{ userId: string; accessLevel: 'viewer' | 'editor' }>;
}

export interface ApiPreviewResult {
  success: boolean;
  sourceName: string;
  recordCount: number;
  previewMarkdown: string;
  rawSample: any;
}

export interface ApiSyncResult {
  uploadBatchId: string;
  sourceName: string;
  originalFilename: string;
  recordCount: number;
  chunkCount: number;
}

/**
 * Traverses an object using dot notation path (e.g. "data.items" or "response.results").
 */
function extractPath(obj: any, path?: string): any {
  if (!obj || !path || !path.trim()) return obj;
  const parts = path.trim().split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  return current;
}

/**
 * Builds HTTP headers including authentication based on connector configuration.
 */
function buildHeaders(config: ApiConnectorConfig): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'User-Agent': 'BrilianAI-API-Connector/1.0',
    ...(config.headers || {}),
  };

  if (config.authType === 'bearer' && config.authToken) {
    headers['Authorization'] = `Bearer ${config.authToken.trim()}`;
  } else if (config.authType === 'apiKey' && config.authToken) {
    const headerName = config.apiKeyHeader?.trim() || 'X-API-Key';
    headers[headerName] = config.authToken.trim();
  } else if (config.authType === 'basic') {
    const credentials = Buffer.from(
      `${config.basicUsername || ''}:${config.basicPassword || ''}`
    ).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  }

  if (config.method === 'POST' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

/**
 * Fetches JSON payload from the configured API endpoint with timeout.
 */
export async function fetchApiData(config: ApiConnectorConfig, timeoutMs: number = 30000): Promise<any> {
  if (!config.endpointUrl || !config.endpointUrl.trim()) {
    throw new Error('Endpoint URL wajib diisi.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = buildHeaders(config);
    const method = config.method || 'GET';

    let body: string | undefined;
    if (method === 'POST') {
      body = typeof config.bodyPayload === 'string'
        ? config.bodyPayload
        : JSON.stringify(config.bodyPayload || {});
    }

    const res = await fetch(config.endpointUrl.trim(), {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`API Error HTTP ${res.status} (${res.statusText}): ${errText.slice(0, 300)}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json') || contentType.includes('+json')) {
      return await res.json();
    }

    const rawText = await res.text();
    try {
      return JSON.parse(rawText);
    } catch {
      return { rawContent: rawText };
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Koneksi ke endpoint API timed out setelah ${timeoutMs / 1000} detik.`);
    }
    throw error;
  }
}

/**
 * Transforms any JSON record into clean Markdown representation.
 */
function recordToMarkdown(record: any, index: number, sourceName: string): string {
  if (record === null || record === undefined) return '';

  if (typeof record !== 'object') {
    return `### [${sourceName}] Record #${index + 1}\n- **Data**: ${String(record)}\n`;
  }

  const lines: string[] = [];
  const titleCandidate =
    record.title ||
    record.name ||
    record.label ||
    record.subject ||
    record.headline ||
    record.id ||
    `Record #${index + 1}`;

  lines.push(`### [${sourceName}] ${String(titleCandidate)} (Record #${index + 1})`);

  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined) continue;

    const formattedKey = key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/^\w/, (c) => c.toUpperCase());

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      // If array of objects, represent as mini list/table
      if (typeof value[0] === 'object' && value[0] !== null) {
        lines.push(`- **${formattedKey}** (${value.length} entri):`);
        value.slice(0, 5).forEach((subItem, sIdx) => {
          const subSummary = Object.entries(subItem)
            .slice(0, 4)
            .map(([sk, sv]) => `${sk}: ${sv}`)
            .join(' | ');
          lines.push(`  * [${sIdx + 1}] ${subSummary}`);
        });
      } else {
        lines.push(`- **${formattedKey}**: ${value.join(', ')}`);
      }
    } else if (typeof value === 'object') {
      lines.push(`- **${formattedKey}**:`);
      for (const [subK, subV] of Object.entries(value)) {
        if (typeof subV !== 'object' && subV !== null && subV !== undefined) {
          lines.push(`  * **${subK}**: ${String(subV)}`);
        }
      }
    } else {
      lines.push(`- **${formattedKey}**: ${String(value)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Converts raw JSON data into PageText[] array suitable for sliding window chunking.
 */
export function convertJsonToPages(
  data: any,
  sourceName: string,
  recordPath?: string
): { pages: PageText[]; recordCount: number } {
  let targetData = extractPath(data, recordPath);

  // If null or undefined, fallback to root
  if (targetData === null || targetData === undefined) {
    targetData = data;
  }

  // If root is an object that wraps an array under common keys ('data', 'items', 'records', 'results')
  if (!Array.isArray(targetData) && typeof targetData === 'object') {
    const commonArrayKeys = ['data', 'items', 'records', 'results', 'rows', 'list', 'documents'];
    for (const key of commonArrayKeys) {
      if (Array.isArray(targetData[key])) {
        targetData = targetData[key];
        break;
      }
    }
  }

  const pages: PageText[] = [];

  if (Array.isArray(targetData)) {
    targetData.forEach((item, idx) => {
      const pageText = recordToMarkdown(item, idx, sourceName);
      if (pageText.trim()) {
        pages.push({
          pageNumber: idx + 1,
          text: pageText,
        });
      }
    });
    return { pages, recordCount: targetData.length };
  }

  // Single object representation
  if (typeof targetData === 'object' && targetData !== null) {
    const pageText = recordToMarkdown(targetData, 0, sourceName);
    pages.push({
      pageNumber: 1,
      text: pageText,
    });
    return { pages, recordCount: 1 };
  }

  // Primitive text
  const fallbackText = `### [${sourceName}] Data Eksternal\n${String(targetData)}`;
  pages.push({ pageNumber: 1, text: fallbackText });
  return { pages, recordCount: 1 };
}

/**
 * Tests the connection to an API endpoint and returns a preview of extracted Markdown records.
 */
export async function testAndPreviewApi(config: ApiConnectorConfig): Promise<ApiPreviewResult> {
  const rawData = await fetchApiData(config);
  const { pages, recordCount } = convertJsonToPages(rawData, config.sourceName, config.recordPath);

  const samplePages = pages.slice(0, 3);
  const previewMarkdown = samplePages.map((p) => p.text).join('\n\n---\n\n');

  let rawSample = rawData;
  if (Array.isArray(rawData)) {
    rawSample = rawData.slice(0, 2);
  }

  return {
    success: true,
    sourceName: config.sourceName,
    recordCount,
    previewMarkdown,
    rawSample,
  };
}

/**
 * Ingests data from an external REST API directly into pgvector knowledge base.
 */
export async function syncApiConnector(
  config: ApiConnectorConfig
): Promise<ApiSyncResult> {
  console.log(`[API Connector] Memulai penarikan data dari "${config.endpointUrl}" (${config.sourceName})...`);

  // 1. Fetch raw data
  const rawData = await fetchApiData(config);

  // 2. Convert JSON into normalized Markdown pages
  const { pages, recordCount } = convertJsonToPages(rawData, config.sourceName, config.recordPath);
  if (pages.length === 0 || recordCount === 0) {
    throw new Error('API mengembalikan data kosong atau tidak ada entri yang dapat diekstrak.');
  }

  console.log(`[API Connector] Berhasil mengonversi ${recordCount} record menjadi ${pages.length} halaman teks terstruktur.`);

  // 3. Sliding-window chunking
  const chunkSize = config.chunkSize || 800;
  const chunkOverlap = config.chunkOverlap || 150;
  const chunks = await chunkWithPageOffsets(pages, chunkSize, chunkOverlap);
  const chunkCount = chunks.length;

  console.log(`[API Connector] Menghasilkan ${chunkCount} chunks dari ${recordCount} record API.`);

  if (chunkCount === 0) {
    throw new Error('Gagal menghasilkan chunk teks dari data API.');
  }

  // 4. Generate 1024-dim embeddings
  const chunkContents = chunks.map((c) => c.content);
  const embeddings: number[][] = [];
  const EMBED_BATCH_SIZE = 100;

  for (let i = 0; i < chunkContents.length; i += EMBED_BATCH_SIZE) {
    const slice = chunkContents.slice(i, i + EMBED_BATCH_SIZE);
    const batchEmbeds = await embedTexts(slice);
    embeddings.push(...batchEmbeds);
  }

  // 5. Store batch in PostgreSQL
  const batchFilename = `[API] ${config.sourceName.trim()}`;
  const batchId = await createUploadBatch(batchFilename, recordCount, {
    ownerId: config.ownerId,
    divisionId: config.divisionId || 'General',
    classification: config.classification || 'Internal',
    status: config.status || 'Aktif',
    version: config.version || '1.0',
    reviewDueDate: config.reviewDueDate || null,
  });

  // 6. Insert chunks into pgvector
  const chunkInputs = chunks.map((chunk, index) => ({
    content: chunk.content,
    sourcePageStart: chunk.sourcePageStart,
    sourcePageEnd: chunk.sourcePageEnd,
    embedding: embeddings[index] || new Array(1024).fill(0),
  }));

  await insertChunks(batchId, chunkInputs);

  // 7. Explicit User Grants if provided
  if (Array.isArray(config.userGrants) && config.userGrants.length > 0 && config.ownerId) {
    try {
      await bulkGrantDocumentAccess(batchId, config.userGrants, config.ownerId);
    } catch (err: any) {
      console.warn('[API Connector] Warning applying user grants:', err?.message);
    }
  }

  console.log(`[API Connector] Sukses: Batch ID ${batchId} tersimpan dengan ${chunkCount} chunks dari API.`);

  return {
    uploadBatchId: batchId,
    sourceName: config.sourceName,
    originalFilename: batchFilename,
    recordCount,
    chunkCount,
  };
}
