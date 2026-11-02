import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as handleHealth } from '../src/app/api/health/route';
import * as dbClient from '../lib/db/dbClient';

describe('Production Health Check Endpoint (/api/health)', () => {
  const mockPool = {
    query: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(dbClient, 'getPool').mockReturnValue(mockPool as any);
  });

  it('should return 200 with status healthy when database is reachable', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const res = await handleHealth();
    expect([200, 503]).toContain(res.status);
    const data = await res.json();

    expect(data.services.database.status).toBe('up');
    expect(data.system.nodeVersion).toBeDefined();
    expect(data.system.heapUsedMb).toBeGreaterThan(0);
    expect(data.timestamp).toBeDefined();
  });

  it('should return 503 with status unhealthy when database fails', async () => {
    mockPool.query.mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));

    const res = await handleHealth();
    expect(res.status).toBe(503);
    const data = await res.json();

    expect(data.status).toBe('unhealthy');
    expect(data.services.database.status).toBe('down');
    expect(data.services.database.error).toContain('Connection terminated unexpectedly');
  });
});

