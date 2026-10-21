import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convertJsonToPages, testAndPreviewApi, syncApiConnector, ApiConnectorConfig } from '../lib/connectors/apiConnectorService';
import * as embeddingModule from '../lib/ai/embeddingClient';
import * as vectorStoreModule from '../lib/db/vectorStore';

describe('External REST API Ingestion Connector (apiConnectorService)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. should convert array of objects into structured Markdown pages with Record indices', () => {
    const rawData = [
      { id: 101, title: 'Server Alpha Status', status: 'Healthy', cpu: '23%', ram: '4.2GB' },
      { id: 102, title: 'Server Beta Status', status: 'Degraded', cpu: '91%', ram: '7.8GB' },
    ];

    const { pages, recordCount } = convertJsonToPages(rawData, 'Server Monitor');

    expect(recordCount).toBe(2);
    expect(pages).toHaveLength(2);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[0].text).toContain('Server Alpha Status');
    expect(pages[0].text).toContain('- **Status**: Healthy');
    expect(pages[1].pageNumber).toBe(2);
    expect(pages[1].text).toContain('Server Beta Status');
    expect(pages[1].text).toContain('- **Cpu**: 91%');
  });

  it('2. should correctly extract nested array using recordPath dot notation', () => {
    const nestedData = {
      apiVersion: '2.0',
      data: {
        total: 2,
        items: [
          { sku: 'LAPTOP-01', name: 'MacBook Pro M3', price: 25000000 },
          { sku: 'PHONE-02', name: 'Pixel 9 Pro', price: 16000000 },
        ],
      },
    };

    const { pages, recordCount } = convertJsonToPages(nestedData, 'Store Catalog', 'data.items');

    expect(recordCount).toBe(2);
    expect(pages).toHaveLength(2);
    expect(pages[0].text).toContain('MacBook Pro M3');
    expect(pages[1].text).toContain('Pixel 9 Pro');
  });

  it('3. should auto-detect common wrapper keys like "results" when recordPath is omitted', () => {
    const wrappedData = {
      status: 'success',
      results: [
        { code: 'IDR', rate: 1.0 },
        { code: 'USD', rate: 16200.0 },
      ],
    };

    const { pages, recordCount } = convertJsonToPages(wrappedData, 'Currency Rates');

    expect(recordCount).toBe(2);
    expect(pages[0].text).toContain('IDR');
    expect(pages[1].text).toContain('USD');
  });

  it('4. should test and preview API data without saving to database', async () => {
    const mockApiResponse = [
      { id: 1, name: 'Nasabah A', saldo: 50000000 },
      { id: 2, name: 'Nasabah B', saldo: 120000000 },
    ];

    // Mock global fetch
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (h: string) => (h === 'content-type' ? 'application/json' : null),
      },
      json: async () => mockApiResponse,
    } as any);

    const config: ApiConnectorConfig = {
      sourceName: 'Layanan Nasabah',
      endpointUrl: 'https://api.internal.bank/v1/customers',
      authType: 'bearer',
      authToken: 'secret_token_123',
    };

    const preview = await testAndPreviewApi(config);

    expect(preview.success).toBe(true);
    expect(preview.recordCount).toBe(2);
    expect(preview.previewMarkdown).toContain('Nasabah A');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.internal.bank/v1/customers',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret_token_123',
        }),
      })
    );
  });

  it('5. should execute end-to-end syncApiConnector and persist chunks to pgvector', async () => {
    const mockRecords = [
      { id: 1, topic: 'Kebijakan Cuti Karyawan 2026', details: 'Hak cuti tahunan adalah 12 hari kerja.' },
      { id: 2, topic: 'Kebijakan Lembur', details: 'Lembur dihitung 1.5x upah per jam.' },
    ];

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (h: string) => (h === 'content-type' ? 'application/json' : null),
      },
      json: async () => mockRecords,
    } as any);

    vi.spyOn(embeddingModule, 'embedTexts').mockResolvedValueOnce([
      new Array(1024).fill(0.1),
      new Array(1024).fill(0.2),
    ]);

    vi.spyOn(vectorStoreModule, 'createUploadBatch').mockResolvedValueOnce('api-batch-uuid-001');
    const insertSpy = vi.spyOn(vectorStoreModule, 'insertChunks').mockResolvedValueOnce(undefined as any);

    const config: ApiConnectorConfig = {
      sourceName: 'HR Live Policy',
      endpointUrl: 'https://hr.company.internal/api/policies',
      divisionId: 'Human Resources',
      classification: 'Internal',
    };

    const result = await syncApiConnector(config);

    expect(result.uploadBatchId).toBe('api-batch-uuid-001');
    expect(result.originalFilename).toBe('[API] HR Live Policy');
    expect(result.recordCount).toBe(2);
    expect(result.chunkCount).toBeGreaterThanOrEqual(1);

    expect(vectorStoreModule.createUploadBatch).toHaveBeenCalledWith(
      '[API] HR Live Policy',
      2,
      expect.objectContaining({
        divisionId: 'Human Resources',
        classification: 'Internal',
      })
    );
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });
});
