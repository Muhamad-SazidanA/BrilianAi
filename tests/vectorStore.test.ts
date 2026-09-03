import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createUploadBatch,
  insertChunks,
  listBatches,
  listChunks,
  deleteUploadBatch,
  updateUploadBatchFilename,
  ChunkInput,
} from '../lib/db/vectorStore';
import * as dbClient from '../lib/db/dbClient';

describe('vectorStore (PostgreSQL + pgvector Store)', () => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };

  const mockPool = {
    query: vi.fn(),
    connect: vi.fn().mockResolvedValue(mockClient),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(dbClient, 'getPool').mockReturnValue(mockPool as any);
  });

  it('1. createUploadBatch() should execute INSERT and return a valid UUID', async () => {
    const mockBatchId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: mockBatchId }],
      rowCount: 1,
    });

    const batchId = await createUploadBatch('sample_dokumen.pdf', 12);

    expect(batchId).toBe(mockBatchId);
    expect(mockPool.query).toHaveBeenCalledTimes(1);

    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO upload_batches');
    expect(params).toEqual(['sample_dokumen.pdf', 12]);
  });

  it('2. insertChunks() with 5 dummy chunks should perform single multi-row insert and update chunk_count to 5', async () => {
    const batchId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const dummyVector = new Array(1024).fill(0.05);

    const dummyChunks: ChunkInput[] = [
      { content: 'Chunk 0 teks', sourcePageStart: 1, sourcePageEnd: 1, embedding: dummyVector },
      { content: 'Chunk 1 teks', sourcePageStart: 1, sourcePageEnd: 2, embedding: dummyVector },
      { content: 'Chunk 2 teks', sourcePageStart: 2, sourcePageEnd: 3, embedding: dummyVector },
      { content: 'Chunk 3 teks', sourcePageStart: 3, sourcePageEnd: 3, embedding: dummyVector },
      { content: 'Chunk 4 teks', sourcePageStart: 3, sourcePageEnd: 4, embedding: dummyVector },
    ];

    mockClient.query.mockResolvedValue({ rows: [], rowCount: 1 });

    await insertChunks(batchId, dummyChunks);

    expect(mockPool.connect).toHaveBeenCalledTimes(1);
    expect(mockClient.release).toHaveBeenCalledTimes(1);

    // Queries executed on client: BEGIN, INSERT, UPDATE, COMMIT
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

    // Verify multi-row insert query
    const insertCall = mockClient.query.mock.calls.find(([sql]) =>
      sql && sql.includes('INSERT INTO document_chunks')
    );
    expect(insertCall).toBeDefined();
    const [insertSql, insertParams] = insertCall!;

    // Must have 5 rows with 6 params each = 30 params total
    expect(insertParams).toHaveLength(30);
    expect(insertSql).toContain('::vector');

    // Verify UPDATE upload_batches chunk_count
    const updateCall = mockClient.query.mock.calls.find(([sql]) =>
      sql && sql.includes('UPDATE upload_batches')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![1]).toEqual([5, batchId]);
  });

  it('3. listChunks() should return document chunks ordered by chunk_index ascending', async () => {
    const batchId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const mockRows = [
      { id: '1', upload_batch_id: batchId, chunk_index: 0, content: 'A', source_page_start: 1, source_page_end: 1, embedding: '[...]', created_at: new Date() },
      { id: '2', upload_batch_id: batchId, chunk_index: 1, content: 'B', source_page_start: 1, source_page_end: 2, embedding: '[...]', created_at: new Date() },
      { id: '3', upload_batch_id: batchId, chunk_index: 2, content: 'C', source_page_start: 2, source_page_end: 2, embedding: '[...]', created_at: new Date() },
    ];

    mockPool.query.mockResolvedValueOnce({
      rows: mockRows,
      rowCount: 3,
    });

    const chunks = await listChunks(batchId);

    expect(chunks).toHaveLength(3);
    expect(chunks[0].chunk_index).toBe(0);
    expect(chunks[1].chunk_index).toBe(1);
    expect(chunks[2].chunk_index).toBe(2);

    const [sql, params] = mockPool.query.mock.calls[0];
    expect(sql).toContain('WHERE upload_batch_id = $1');
    expect(sql).toContain('ORDER BY chunk_index ASC');
    expect(params).toEqual([batchId]);
  });

  it('4. listBatches() should return upload batches ordered by latest uploaded_at first', async () => {
    const mockBatches = [
      { id: 'b2', original_filename: 'latest.pdf', chunk_count: 8, page_count: 3, uploaded_at: '2026-09-01T15:00:00Z' },
      { id: 'b1', original_filename: 'earlier.pdf', chunk_count: 5, page_count: 2, uploaded_at: '2026-09-01T14:00:00Z' },
    ];

    mockPool.query.mockResolvedValueOnce({
      rows: mockBatches,
      rowCount: 2,
    });

    const batches = await listBatches();

    expect(batches).toHaveLength(2);
    expect(batches[0].id).toBe('b2');

    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toContain('ORDER BY uploaded_at DESC');
  });

  it('5. deleteUploadBatch() should execute DELETE and return true on success', async () => {
    mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

    const result = await deleteUploadBatch('batch-to-delete');
    expect(result).toBe(true);
    expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM upload_batches WHERE id = $1;', ['batch-to-delete']);
  });

  it('6. updateUploadBatchFilename() should execute UPDATE and return updated record', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 'b1', original_filename: 'nama_baru.pdf', chunk_count: 5, page_count: 2, uploaded_at: new Date() }],
      rowCount: 1,
    });

    const result = await updateUploadBatchFilename('b1', 'nama_baru.pdf');
    expect(result.original_filename).toBe('nama_baru.pdf');
    expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE upload_batches'), ['nama_baru.pdf', 'b1']);
  });
});

