import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dbClient from '../lib/db/dbClient';
import {
  createSession,
  validateSession,
  revokeSession,
  revokeAllUserSessions,
  ensureSessionsTable,
  _resetSessionTableInitializedForTesting,
} from '../lib/db/sessionStore';

describe('Enterprise Session Store (user_sessions)', () => {
  const mockPool = {
    query: vi.fn(),
  };

  beforeEach(() => {
    mockPool.query.mockReset();
    vi.clearAllMocks();
    vi.spyOn(dbClient, 'getPool').mockReturnValue(mockPool as any);
    _resetSessionTableInitializedForTesting();
  });

  describe('ensureSessionsTable', () => {
    it('should create the table and indexes on first call and cache subsequent calls', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await ensureSessionsTable();
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS user_sessions');

      // Second call should hit memory cache without re-running DDL query
      await ensureSessionsTable();
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('createSession', () => {
    it('should generate a 64-character hex session token and persist to database', async () => {
      // Mock ensureSessionsTable query + insert query
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // DDL
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // INSERT

      const userId = '11111111-1111-1111-1111-111111111111';
      const userAgent = 'Mozilla/5.0 Chrome/120.0';
      const ipAddress = '192.168.1.10';

      const token = await createSession(userId, userAgent, ipAddress, 14);

      expect(typeof token).toBe('string');
      expect(token).toHaveLength(64); // 32 bytes hex = 64 characters

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      const [insertSql, insertParams] = mockPool.query.mock.calls[1];
      expect(insertSql).toContain('INSERT INTO user_sessions');
      expect(insertParams[0]).toBe(token);
      expect(insertParams[1]).toBe(userId);
      expect(insertParams[2]).toBe(userAgent);
      expect(insertParams[3]).toBe(ipAddress);
      expect(insertParams[4]).toBeInstanceOf(Date);
    });
  });

  describe('validateSession', () => {
    it('should return null immediately for invalid or short token formats without querying DB', async () => {
      expect(await validateSession('')).toBeNull();
      expect(await validateSession('too-short')).toBeNull();
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should return null when token is not found or expired', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // DDL
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // SELECT -> no rows

      const token = 'a'.repeat(64);
      const result = await validateSession(token);

      expect(result).toBeNull();
    });

    it('should return null if user status is suspended/inactive', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // DDL
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-1',
            name: 'Suspended User',
            email: 'user@bank.co.id',
            role_id: 'viewer',
            status: 'suspended',
            department: 'Legal',
            role_name: 'Viewer',
            role_desc: 'Read only',
            role_is_system: true,
            role_permissions: ['chat:read'],
          },
        ],
      });

      const token = 'b'.repeat(64);
      const result = await validateSession(token);

      expect(result).toBeNull();
    });

    it('should return full User object and populated Role for a valid active session', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // DDL
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-1',
            name: 'Budi Santoso',
            email: 'budi@bank.co.id',
            role_id: 'admin',
            status: 'active',
            department: 'IT Security',
            avatar_color: '#3B82F6',
            last_login_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
            role_name: 'Administrator',
            role_desc: 'Full access',
            role_is_system: true,
            role_permissions: ['system:manage', 'documents:upload', 'chat:query'],
          },
        ],
      });

      const token = 'c'.repeat(64);
      const user = await validateSession(token);

      expect(user).not.toBeNull();
      expect(user?.id).toBe('user-1');
      expect(user?.name).toBe('Budi Santoso');
      expect(user?.role?.id).toBe('admin');
      expect(user?.role?.permissions).toContain('system:manage');
    });
  });

  describe('revokeSession & revokeAllUserSessions', () => {
    it('should revoke a single session token upon logout', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // DDL
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // UPDATE

      const token = 'd'.repeat(64);
      await revokeSession(token);

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      const [updateSql, updateParams] = mockPool.query.mock.calls[1];
      expect(updateSql).toContain('UPDATE user_sessions SET revoked_at = now() WHERE session_token = $1');
      expect(updateParams).toEqual([token]);
    });

    it('should revoke all active sessions for a specific user ID', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // DDL
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // UPDATE

      const userId = 'user-target-id';
      await revokeAllUserSessions(userId);

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      const [updateSql, updateParams] = mockPool.query.mock.calls[1];
      expect(updateSql).toContain('UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1');
      expect(updateParams).toEqual([userId]);
    });
  });
});
