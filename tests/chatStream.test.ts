import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dbClient from '../lib/db/dbClient';
import * as embeddingClient from '../lib/ai/embeddingClient';
import * as chatClient from '../lib/ai/chatClient';
import { askDocumentChatStream } from '../lib/chat/chatService';
import { POST as handleChatRoute } from '../src/app/api/chat/route';
import { NextRequest } from 'next/server';
import { clearChatCache } from '../lib/db/chatCacheStore';

vi.mock('../lib/auth/serverAuth', () => ({
  getAuthenticatedUser: vi.fn().mockResolvedValue({
    id: 'user-superadmin',
    name: 'Super Admin',
    email: 'admin@brilian.ai',
    department: 'IT',
    role_id: 'superadmin',
    status: 'active',
  }),
  hasServerPermission: vi.fn().mockResolvedValue(true),
  getAllowedClassificationsForRole: vi.fn().mockReturnValue(['Publik', 'Internal', 'Rahasia', 'Sangat Rahasia']),
  canUserAccessDocument: vi.fn().mockReturnValue(true),
}));

vi.mock('../lib/db/auditLogStore', () => ({
  saveAuditLog: vi.fn().mockResolvedValue(true),
}));

vi.mock('../lib/db/documentGrantStore', () => ({
  listUserGrantedBatchIds: vi.fn().mockResolvedValue([]),
}));

describe('AI Streaming Architecture (askDocumentChatStream & SSE API)', () => {
  const mockPool = {
    query: vi.fn(),
  };

  beforeEach(() => {
    mockPool.query.mockReset();
    vi.clearAllMocks();
    clearChatCache();
    vi.spyOn(dbClient, 'getPool').mockReturnValue(mockPool as any);
  });

  it('1. askDocumentChatStream should stream tokens and emit preliminary sources', async () => {
    const dummyVector = new Array(1024).fill(0.05);
    vi.spyOn(embeddingClient, 'embedTexts').mockResolvedValueOnce([dummyVector]);

    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 10,
          uploadBatchId: 'b-stream-001',
          originalFilename: 'pedoman_it.pdf',
          chunkIndex: 0,
          content: 'Bab 1: Keamanan data wajib dienkripsi AES-256.',
          sourcePageStart: 1,
          sourcePageEnd: 1,
          similarity: 0.92,
        },
      ],
      rowCount: 1,
    });

    vi.spyOn(chatClient, 'generateChatResponseStream').mockImplementation(
      async (_query, _context, _allowPublic, options) => {
        options?.onToken?.('Keamanan ');
        options?.onToken?.('data diatur ');
        options?.onToken?.('oleh enkripsi AES-256.');
        return 'Keamanan data diatur oleh enkripsi AES-256.';
      }
    );

    const receivedTokens: string[] = [];
    let receivedSourcesCount = 0;
    let doneCalled = false;

    const result = await askDocumentChatStream(
      'Bagaimana enkripsi data?',
      { bypassCache: true },
      {
        onSources: (sources) => {
          receivedSourcesCount = sources.length;
        },
        onToken: (tok) => {
          receivedTokens.push(tok);
        },
        onDone: () => {
          doneCalled = true;
        },
      }
    );

    expect(receivedSourcesCount).toBeGreaterThanOrEqual(1);
    expect(receivedTokens.join('')).toContain('Keamanan data diatur oleh enkripsi AES-256.');
    expect(doneCalled).toBe(true);
    expect(result.answer).toContain('AES-256');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].filename).toBe('pedoman_it.pdf');
  });

  it('2. POST /api/chat with stream: true should return text/event-stream headers and readable chunks', async () => {
    const dummyVector = new Array(1024).fill(0.05);
    vi.spyOn(embeddingClient, 'embedTexts').mockResolvedValueOnce([dummyVector]);

    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 11,
          uploadBatchId: 'b-stream-002',
          originalFilename: 'sop_jaringan.pdf',
          chunkIndex: 0,
          content: 'Firewall harus selalu aktif pada port 443.',
          sourcePageStart: 3,
          sourcePageEnd: 3,
          similarity: 0.88,
        },
      ],
      rowCount: 1,
    });

    vi.spyOn(chatClient, 'generateChatResponseStream').mockImplementation(
      async (_query, _context, _allowPublic, options) => {
        options?.onToken?.('Firewall ');
        options?.onToken?.('aktif.');
        return 'Firewall aktif.';
      }
    );

    const req = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'Cek port firewall',
        stream: true,
      }),
    });

    const res = await handleChatRoute(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let sseText = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseText += decoder.decode(value);
      }
    }

    expect(sseText).toContain('data: {"type":"sources"');
    expect(sseText).toContain('data: {"type":"token"');
    expect(sseText).toContain('data: {"type":"done"');
    expect(sseText).toContain('sop_jaringan.pdf');
  });
});
