import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleCopilotChat } from '../src/app/api/dashboard/[dashboardId]/chat/route';
import { PATCH as handleDashboardPatch, GET as handleDashboardGet } from '../src/app/api/dashboard/[dashboardId]/route';
import { POST as handleBuildDashboard } from '../src/app/api/chat/dashboard/route';
import * as serverAuthModule from '../lib/auth/serverAuth';
import * as dashboardStoreModule from '../lib/db/dashboardStore';
import * as dashboardClientModule from '../lib/ai/dashboardClient';
import { _resetRateLimitStoreForTesting } from '../lib/security/rateLimiter';
import { DashboardData } from '../src/types/dashboard';

describe('Interactive Dashboard Security Boundaries & Exploit Shield', () => {
  const mockUser = {
    id: 'user-normal-1',
    name: 'Normal User',
    email: 'user@test.com',
    role_id: 'viewer',
    status: 'active',
    department: 'Marketing',
  };

  const sampleDashboard: DashboardData = {
    title: 'Financial Analysis 2026',
    sourceMessageId: 'msg-101',
    sourceQuery: 'Analyze finance',
    widgets: [
      {
        type: 'stat_card',
        title: 'Net Profit',
        value: '$4.2M',
      },
      {
        type: 'table',
        title: 'Breakdown',
        columns: ['Category', 'Amount'],
        rows: [['Q1', '1.2M']],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    _resetRateLimitStoreForTesting();
    vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValue(mockUser as any);
  });

  describe('POST /api/dashboard/[dashboardId]/chat (Copilot Security)', () => {
    it('1. should reject unauthenticated requests with 401 Unauthorized', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost:3000/api/dashboard/dash-1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Halo copilot',
          dashboard: sampleDashboard,
        }),
      });

      const res = await handleCopilotChat(req, { params: { dashboardId: 'dash-1' } });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('2. should enforce strict rate limiting at 15 requests per minute', async () => {
      vi.spyOn(dashboardClientModule, 'askDashboardCopilot').mockResolvedValue({
        answer: 'Penjelasan data normal.',
      });

      // Send 15 allowed requests
      for (let i = 0; i < 15; i++) {
        const req = new NextRequest('http://localhost:3000/api/dashboard/dash-rate/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `Pertanyaan ${i}`, dashboard: sampleDashboard }),
        });
        const res = await handleCopilotChat(req, { params: { dashboardId: 'dash-rate' } });
        expect(res.status).toBe(200);
      }

      // The 16th request must be rejected with 429 Too Many Requests
      const blockedReq = new NextRequest('http://localhost:3000/api/dashboard/dash-rate/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Pertanyaan spam 16', dashboard: sampleDashboard }),
      });
      const blockedRes = await handleCopilotChat(blockedReq, { params: { dashboardId: 'dash-rate' } });
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers.get('Retry-After')).not.toBeNull();
      const data = await blockedRes.json();
      expect(data.error).toContain('Batas frekuensi');
    });

    it('3. should reject oversized messages exceeding 1000 characters', async () => {
      const longMessage = 'A'.repeat(1001);
      const req = new NextRequest('http://localhost:3000/api/dashboard/dash-1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: longMessage, dashboard: sampleDashboard }),
      });

      const res = await handleCopilotChat(req, { params: { dashboardId: 'dash-1' } });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('terlalu panjang');
    });

    it('4. should reject payloads with more than 50 widgets', async () => {
      const bloatedWidgets = Array(51).fill({ type: 'stat_card', title: 'T', value: '1' });
      const req = new NextRequest('http://localhost:3000/api/dashboard/dash-1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Analisis ini',
          dashboard: { ...sampleDashboard, widgets: bloatedWidgets },
        }),
      });

      const res = await handleCopilotChat(req, { params: { dashboardId: 'dash-1' } });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('melebihi batas aman');
    });
  });

  describe('PATCH /api/dashboard/[dashboardId] (Edit & Morph Authorization)', () => {
    it('1. should reject unauthenticated users with 401', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost:3000/api/dashboard/dash-1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: sampleDashboard }),
      });

      const res = await handleDashboardPatch(req, { params: { dashboardId: 'dash-1' } });
      expect(res.status).toBe(401);
    });

    it('2. should reject non-owner and non-admin users with 403 Forbidden', async () => {
      // Mock existing dashboard owned by a different user
      vi.spyOn(dashboardStoreModule, 'getDashboardById').mockResolvedValueOnce({
        dashboard_id: 'dash-1',
        message_id: 'msg-1',
        user_id: 'other-user-999', // Not mockUser.id
        title: 'Original Title',
        data: sampleDashboard,
        views_count: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const req = new NextRequest('http://localhost:3000/api/dashboard/dash-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: sampleDashboard }),
      });

      const res = await handleDashboardPatch(req, { params: { dashboardId: 'dash-1' } });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Forbidden');
    });

    it('3. should allow dashboard owner to update dashboard', async () => {
      // Mock existing dashboard owned by mockUser
      vi.spyOn(dashboardStoreModule, 'getDashboardById').mockResolvedValueOnce({
        dashboard_id: 'dash-1',
        message_id: 'msg-1',
        user_id: mockUser.id,
        title: 'Original Title',
        data: sampleDashboard,
        views_count: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      vi.spyOn(dashboardStoreModule, 'updateDashboardData').mockResolvedValueOnce({
        dashboard_id: 'dash-1',
        message_id: 'msg-1',
        user_id: mockUser.id,
        title: 'Updated Title',
        data: sampleDashboard,
        views_count: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const req = new NextRequest('http://localhost:3000/api/dashboard/dash-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: sampleDashboard, title: 'Updated Title' }),
      });

      const res = await handleDashboardPatch(req, { params: { dashboardId: 'dash-1' } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('4. should reject unknown or malicious widget types with 400', async () => {
      vi.spyOn(dashboardStoreModule, 'getDashboardById').mockResolvedValueOnce({
        dashboard_id: 'dash-1',
        message_id: 'msg-1',
        user_id: mockUser.id,
        title: 'Original Title',
        data: sampleDashboard,
        views_count: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const maliciousDashboard = {
        ...sampleDashboard,
        widgets: [{ type: 'script_exec_payload', code: 'evil()' }],
      };

      const req = new NextRequest('http://localhost:3000/api/dashboard/dash-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: maliciousDashboard }),
      });

      const res = await handleDashboardPatch(req, { params: { dashboardId: 'dash-1' } });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('tidak valid atau tidak diizinkan');
    });
  });

  describe('POST /api/chat/dashboard (Build Dashboard Rate Limiter)', () => {
    it('1. should enforce rate limit of 10 builds per minute', async () => {
      vi.spyOn(dashboardStoreModule, 'getDashboardByMessageId').mockResolvedValue(null);
      vi.spyOn(dashboardClientModule, 'generateDashboardData').mockResolvedValue(sampleDashboard);
      vi.spyOn(dashboardStoreModule, 'saveDashboard').mockResolvedValue({
        dashboard_id: 'new-dash',
        message_id: 'msg-x',
        title: sampleDashboard.title,
        data: sampleDashboard,
        views_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      for (let i = 0; i < 10; i++) {
        const req = new NextRequest('http://localhost:3000/api/chat/dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: `msg-${i}`, answerText: 'Laporan keuangan 2026' }),
        });
        const res = await handleBuildDashboard(req);
        expect(res.status).toBe(200);
      }

      // 11th request must be rate-limited with 429
      const blockedReq = new NextRequest('http://localhost:3000/api/chat/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: 'msg-11', answerText: 'Laporan keuangan 2026' }),
      });
      const blockedRes = await handleBuildDashboard(blockedReq);
      expect(blockedRes.status).toBe(429);
      const data = await blockedRes.json();
      expect(data.error).toContain('Batas pembuatan dashboard tercapai');
    });
  });
});
