import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleLogin } from '../src/app/api/auth/login/route';
import { GET as handleAuditExport } from '../src/app/api/audit-logs/export/route';
import { GET as handleStats } from '../src/app/api/stats/route';
import { GET as handleCurate } from '../src/app/api/documents/[id]/curate/route';
import { POST as handlePostGrant } from '../src/app/api/documents/[id]/grants/route';
import { GET as handleDocumentExport } from '../src/app/api/documents/[id]/export/route';
import { getAuthenticatedUser } from '../lib/auth/serverAuth';
import * as serverAuthModule from '../lib/auth/serverAuth';
import * as dbClient from '../lib/db/dbClient';

describe('Security Audit Regression Test Suite (SEC-01 to SEC-08)', () => {
  const mockPool = {
    query: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(dbClient, 'getPool').mockReturnValue(mockPool as any);
  });

  describe('1. [SEC-01] Login Endpoint Protection', () => {
    it('should reject login request attempting isSso bypass without password', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'superadmin@brilian.ai', isSso: true }),
      });

      const res = await handleLogin(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Password is required.');
    });

    it('should reject hardcoded legacy fallback passwords like admin123 when custom password is set', async () => {
      process.env.SUPERADMIN_PASSWORD = 'StrongSecretProdPassword!99#';

      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'superadmin@brilian.ai', password: 'admin123' }),
      });

      const res = await handleLogin(req);
      expect(res.status).toBe(401);

      delete process.env.SUPERADMIN_PASSWORD;
    });
  });

  describe('2. [SEC-02] Server Authentication Fallback Elimination', () => {
    it('should return null when only unauthenticated active_user_id cookie is sent without valid session token', async () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'production';

      const req = new NextRequest('http://localhost:3000/api/documents', {
        headers: {
          cookie: 'brilian_active_user_id=a0000000-0000-0000-0000-000000000001',
        },
      });

      const user = await getAuthenticatedUser(req);
      expect(user).toBeNull();

      (process.env as any).NODE_ENV = originalEnv;
    });
  });

  describe('3. [SEC-03] Audit Logs Export Authentication', () => {
    it('should return 401 Unauthorized for unauthenticated audit export request', async () => {
      const req = new NextRequest('http://localhost:3000/api/audit-logs/export');
      const res = await handleAuditExport(req);
      expect(res.status).toBe(401);
    });
  });

  describe('4. [SEC-04] System Stats Endpoint Protection', () => {
    it('should return 401 Unauthorized for unauthenticated stats request', async () => {
      const req = new NextRequest('http://localhost:3000/api/stats');
      const res = await handleStats(req);
      expect(res.status).toBe(401);
    });

    it('should redact recentLogins and pendingUsers when caller is a standard non-admin member', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValue({
        id: 'member-01',
        name: 'Regular Member',
        email: 'member@brilian.ai',
        role_id: 'member',
        status: 'active',
        role: { id: 'member', permissions: ['chat:query'] },
      } as any);

      mockPool.query.mockResolvedValue({ rows: [{ total_documents: 10, total_chunks: 50 }] });

      const req = new NextRequest('http://localhost:3000/api/stats');
      const res = await handleStats(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.recentLogins).toEqual([]);
      expect(data.attention.pendingUsers).toEqual([]);
    });
  });

  describe('5. [SEC-05] Curate Endpoint Protection', () => {
    it('should return 401 Unauthorized in production when unauthenticated', async () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'production';
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/documents/b1/curate');
      const res = await handleCurate(req, { params: { id: 'b1' } });
      expect(res.status).toBe(401);

      (process.env as any).NODE_ENV = originalEnv;
    });
  });

  describe('6. [SEC-06] Document Grants Authorization (BOLA Prevention)', () => {
    it('should forbid editor from granting access to another user document', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValue({
        id: 'editor-01',
        name: 'Editor User',
        role_id: 'editor',
        status: 'active',
      } as any);

      // Batch owned by someone else
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'b0000000-0000-0000-0000-000000000001', owner_id: 'owner-99', original_filename: 'confidential.pdf' }],
      });

      const req = new NextRequest('http://localhost:3000/api/documents/b0000000-0000-0000-0000-000000000001/grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'victim-01', accessLevel: 'viewer' }),
      });

      const res = await handlePostGrant(req, { params: { id: 'b0000000-0000-0000-0000-000000000001' } });
      expect(res.status).toBe(403);
    });
  });

  describe('7. [SEC-07] Document Export Fail-Closed Access Control', () => {
    it('should return 404 when batch is not found or inaccessible', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValue({
        id: 'member-01',
        role_id: 'member',
        status: 'active',
        department: 'Finance',
      } as any);

      // Return empty batch for all queries
      mockPool.query.mockResolvedValue({ rows: [] });

      const req = new NextRequest('http://localhost:3000/api/documents/b-nonexistent/export');
      const res = await handleDocumentExport(req, { params: { id: 'b-nonexistent' } });
      expect(res.status).toBe(404);
    });
  });
});
