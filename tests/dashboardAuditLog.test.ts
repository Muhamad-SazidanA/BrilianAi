import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleBuildDashboard } from '../src/app/api/chat/dashboard/route';
import {
  GET as handleSessionTurnGet,
  PATCH as handleSessionTurnPatch,
} from '../src/app/api/dashboard/w/[sessionId]/[turn]/route';
import { POST as handleDashboardAudit } from '../src/app/api/dashboard/audit/route';
import { POST as handleCopilotChat } from '../src/app/api/dashboard/[dashboardId]/chat/route';
import * as serverAuthModule from '../lib/auth/serverAuth';
import * as dashboardStoreModule from '../lib/db/dashboardStore';
import * as auditLogStoreModule from '../lib/db/auditLogStore';
import * as dashboardClientModule from '../lib/ai/dashboardClient';
import { _resetRateLimitStoreForTesting } from '../lib/security/rateLimiter';
import { generateDashboardShareToken } from '../lib/security/dashboardShareToken';
import { DashboardData } from '../src/types/dashboard';

describe('Dashboard Interactive Audit Logging System (Compliance & Governance)', () => {
  const mockUser = {
    id: 'user-audit-123',
    name: 'Auditor Pro',
    email: 'auditor@company.com',
    role_id: 'admin',
    department: 'Finance',
    status: 'active',
  };

  const sampleData: DashboardData = {
    title: 'Financial Q1 Summary',
    sourceMessageId: 'msg-audit-1',
    sourceQuery: 'Tampilkan laporan keuangan',
    widgets: [
      {
        type: 'stat_card',
        title: 'Net Profit',
        value: 'Rp 1.500.000.000',
      },
    ],
  };

  const sampleRecord = {
    dashboard_id: 'dash-audit-uuid',
    session_id: '24d7acf9-5109-42e2-a5d1-48ab658dcd5e',
    turn_index: 1,
    message_id: 'msg-audit-1',
    user_id: 'user-audit-123',
    title: 'Financial Q1 Summary',
    data: sampleData,
    views_count: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    _resetRateLimitStoreForTesting();
    vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValue(mockUser as any);
    vi.spyOn(auditLogStoreModule, 'recordAuditEvent').mockResolvedValue({} as any);
  });

  it('1. should record dashboard.create audit event when generating dashboard', async () => {
    vi.spyOn(dashboardStoreModule, 'getDashboardByMessageId').mockResolvedValue(null);
    vi.spyOn(dashboardClientModule, 'generateDashboardData').mockResolvedValue(sampleData);
    vi.spyOn(dashboardStoreModule, 'saveDashboard').mockResolvedValue(sampleRecord);

    const req = new NextRequest('http://localhost:3000/api/chat/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: 'msg-audit-1',
        sessionId: '24d7acf9-5109-42e2-a5d1-48ab658dcd5e',
        turnIndex: 1,
        queryText: 'Analisis pendapatan',
        answerText: 'Pendapatan Q1 mencapai Rp 1.500.000.000 dengan pertumbuhan 15%.',
        forceRegenerate: true,
      }),
    });

    const res = await handleBuildDashboard(req);
    expect(res.status).toBe(200);

    expect(auditLogStoreModule.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCategory: 'DASHBOARD',
        action: 'dashboard.create',
        actorId: 'user-audit-123',
        actorName: 'Auditor Pro',
        resourceType: 'dashboard',
        resourceId: 'dash-audit-uuid',
        status: 'success',
      })
    );
  });

  it('2. should record dashboard.view audit event when accessing dashboard via session-turn', async () => {
    vi.spyOn(dashboardStoreModule, 'getDashboardBySessionAndTurn').mockResolvedValue(sampleRecord);

    const req = new NextRequest(
      'http://localhost:3000/api/dashboard/w/24d7acf9-5109-42e2-a5d1-48ab658dcd5e/1'
    );

    const res = await handleSessionTurnGet(req, {
      params: { sessionId: '24d7acf9-5109-42e2-a5d1-48ab658dcd5e', turn: '1' },
    });

    expect(res.status).toBe(200);
    expect(auditLogStoreModule.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCategory: 'DASHBOARD',
        action: 'dashboard.view',
        resourceId: 'dash-audit-uuid',
        status: 'success',
      })
    );
  });

  it('3. should record dashboard.view_unauthorized audit event on illegal IDOR turn tampering', async () => {
    vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValue(null); // Unauthenticated guest
    vi.spyOn(dashboardStoreModule, 'getDashboardBySessionAndTurn').mockResolvedValue(sampleRecord);

    // Tampered token from turn 99
    const req = new NextRequest(
      'http://localhost:3000/api/dashboard/w/24d7acf9-5109-42e2-a5d1-48ab658dcd5e/1?share=tampered_token_hash_value_12345'
    );

    const res = await handleSessionTurnGet(req, {
      params: { sessionId: '24d7acf9-5109-42e2-a5d1-48ab658dcd5e', turn: '1' },
    });

    expect(res.status).toBe(403);
    expect(auditLogStoreModule.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCategory: 'DASHBOARD',
        action: 'dashboard.view_unauthorized',
        status: 'warning',
      })
    );
  });

  it('4. should record dashboard.update audit event on layout patch', async () => {
    vi.spyOn(dashboardStoreModule, 'getDashboardBySessionAndTurn').mockResolvedValue(sampleRecord);
    vi.spyOn(dashboardStoreModule, 'updateDashboardData').mockResolvedValue({
      ...sampleRecord,
      title: 'Updated Financial Q1',
    });

    const req = new NextRequest(
      'http://localhost:3000/api/dashboard/w/24d7acf9-5109-42e2-a5d1-48ab658dcd5e/1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Updated Financial Q1',
          data: sampleData,
        }),
      }
    );

    const res = await handleSessionTurnPatch(req, {
      params: { sessionId: '24d7acf9-5109-42e2-a5d1-48ab658dcd5e', turn: '1' },
    });

    expect(res.status).toBe(200);
    expect(auditLogStoreModule.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCategory: 'DASHBOARD',
        action: 'dashboard.update',
        actorId: 'user-audit-123',
        status: 'success',
      })
    );
  });

  it('5. should record dashboard.export_pdf and dashboard.share via /api/dashboard/audit', async () => {
    const reqPdf = new NextRequest('http://localhost:3000/api/dashboard/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'dashboard.export_pdf',
        dashboardId: 'dash-audit-uuid',
        sessionId: '24d7acf9-5109-42e2-a5d1-48ab658dcd5e',
        turnIndex: 1,
        title: 'Financial Q1 Summary',
      }),
    });

    const resPdf = await handleDashboardAudit(reqPdf);
    expect(resPdf.status).toBe(200);

    expect(auditLogStoreModule.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCategory: 'DASHBOARD',
        action: 'dashboard.export_pdf',
        resourceId: 'dash-audit-uuid',
        status: 'success',
      })
    );

    const reqShare = new NextRequest('http://localhost:3000/api/dashboard/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'dashboard.share',
        dashboardId: 'dash-audit-uuid',
        sessionId: '24d7acf9-5109-42e2-a5d1-48ab658dcd5e',
        turnIndex: 1,
        title: 'Financial Q1 Summary',
      }),
    });

    const resShare = await handleDashboardAudit(reqShare);
    expect(resShare.status).toBe(200);

    expect(auditLogStoreModule.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCategory: 'DASHBOARD',
        action: 'dashboard.share',
        resourceId: 'dash-audit-uuid',
        status: 'success',
      })
    );
  });

  it('6. should record dashboard.copilot_query on copilot conversation', async () => {
    vi.spyOn(dashboardClientModule, 'askDashboardCopilot').mockResolvedValue({
      answer: 'Berikut analisis widget pendapatan.',
      action: { type: 'morph_widget', widgetIndex: 0, targetType: 'bar_chart' },
    });

    const req = new NextRequest('http://localhost:3000/api/dashboard/dash-audit-uuid/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Jelaskan card net profit',
        dashboard: sampleData,
      }),
    });

    const res = await handleCopilotChat(req, {
      params: { dashboardId: 'dash-audit-uuid' },
    });

    expect(res.status).toBe(200);
    expect(auditLogStoreModule.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCategory: 'DASHBOARD',
        action: 'dashboard.copilot_query',
        resourceId: 'dash-audit-uuid',
        status: 'success',
      })
    );
  });
});
