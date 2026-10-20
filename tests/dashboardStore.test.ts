import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dbClient from '../lib/db/dbClient';
import {
  saveDashboard,
  getDashboardById,
  getDashboardByMessageId,
  updateDashboardData,
} from '../lib/db/dashboardStore';
import { DashboardData } from '../src/types/dashboard';

describe('dashboardStore unit tests', () => {
  const mockPool = {
    query: vi.fn(),
  };

  const sampleData: DashboardData = {
    title: 'Test Dashboard',
    sourceMessageId: 'msg-999',
    sourceQuery: 'test query',
    widgets: [
      {
        type: 'stat_card',
        title: 'Total Revenue',
        value: '100M',
      },
    ],
  };

  beforeEach(() => {
    mockPool.query.mockReset();
    vi.clearAllMocks();
    vi.spyOn(dbClient, 'getPool').mockReturnValue(mockPool as any);
  });

  it('getDashboardByMessageId should return existing dashboard record if found', async () => {
    // 1st query: ensureTableExists DDL
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    // 2nd query: SELECT * FROM ai_dashboards WHERE message_id = $1
    const mockRecord = {
      dashboard_id: 'dash-12345',
      message_id: 'msg-999',
      title: 'Test Dashboard',
      data: sampleData,
    };
    mockPool.query.mockResolvedValueOnce({ rows: [mockRecord] });

    const result = await getDashboardByMessageId('msg-999');

    expect(result).not.toBeNull();
    expect(result?.dashboard_id).toBe('dash-12345');
    expect(mockPool.query).toHaveBeenCalledTimes(2);
    expect(mockPool.query.mock.calls[1][0]).toContain('WHERE message_id = $1');
    expect(mockPool.query.mock.calls[1][1]).toEqual(['msg-999']);
  });

  it('getDashboardByMessageId should return null when not found', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] }); // DDL
    mockPool.query.mockResolvedValueOnce({ rows: [] }); // SELECT empty

    const result = await getDashboardByMessageId('non-existent-msg');

    expect(result).toBeNull();
  });

  it('updateDashboardData should update dashboard data and return updated record', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] }); // DDL
    const updatedRecord = {
      dashboard_id: 'dash-12345',
      title: 'Updated Title',
      data: sampleData,
    };
    mockPool.query.mockResolvedValueOnce({ rows: [updatedRecord] });

    const result = await updateDashboardData('dash-12345', sampleData, 'Updated Title');

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Updated Title');
    expect(mockPool.query.mock.calls[1][0]).toContain('UPDATE ai_dashboards');
  });
});
