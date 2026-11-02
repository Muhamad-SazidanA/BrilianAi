import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  generateDashboardShareToken,
  verifyDashboardShareToken,
} from '../lib/security/dashboardShareToken';
import {
  GET as handleSessionTurnGet,
  PATCH as handleSessionTurnPatch,
} from '../src/app/api/dashboard/w/[sessionId]/[turn]/route';
import * as serverAuthModule from '../lib/auth/serverAuth';
import * as dashboardStoreModule from '../lib/db/dashboardStore';
import { DashboardData } from '../src/types/dashboard';

describe('Dashboard Session-Turn Routing & IDOR Tamper-Proof Security', () => {
  const mockOwner = {
    id: 'user-owner-123',
    name: 'Owner User',
    email: 'owner@test.com',
    role_id: 'user',
    status: 'active',
  };

  const mockAttacker = {
    id: 'user-attacker-666',
    name: 'Attacker User',
    email: 'attacker@test.com',
    role_id: 'user',
    status: 'active',
  };

  const sampleData: DashboardData = {
    title: 'Q1 Financial Report',
    sourceMessageId: 'msg-turn-1',
    sourceQuery: 'Tampilkan keuangan kuartal 1',
    widgets: [
      {
        type: 'stat_card',
        title: 'Net Profit',
        value: 'Rp 500.000.000',
      },
    ],
  };

  const sampleDashboardRecord = {
    dashboard_id: 'dash-uuid-001',
    session_id: '24d7acf9-5109-42e2-a5d1-48ab658dcd5e',
    turn_index: 1,
    message_id: 'msg-turn-1',
    user_id: 'user-owner-123',
    title: 'Q1 Financial Report',
    data: sampleData,
    views_count: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('HMAC Share Token Cryptographic Integrity', () => {
    it('should generate a valid 32-char hex HMAC token', () => {
      const token = generateDashboardShareToken(
        '24d7acf9-5109-42e2-a5d1-48ab658dcd5e',
        1,
        'dash-uuid-001'
      );
      expect(typeof token).toBe('string');
      expect(token).toHaveLength(32);
    });

    it('should verify true for exact matching sessionId, turnIndex, dashboardId', () => {
      const token = generateDashboardShareToken(
        '24d7acf9-5109-42e2-a5d1-48ab658dcd5e',
        1,
        'dash-uuid-001'
      );
      const isValid = verifyDashboardShareToken(
        '24d7acf9-5109-42e2-a5d1-48ab658dcd5e',
        1,
        'dash-uuid-001',
        token
      );
      expect(isValid).toBe(true);
    });

    it('CRITICAL IDOR: should reject when attacker tampers turnIndex from 1 to 2', () => {
      // Token originally generated for Turn 1
      const tokenTurn1 = generateDashboardShareToken(
        '24d7acf9-5109-42e2-a5d1-48ab658dcd5e',
        1,
        'dash-uuid-001'
      );

      // Attacker tries to use tokenTurn1 on Turn 2
      const isTurn2Valid = verifyDashboardShareToken(
        '24d7acf9-5109-42e2-a5d1-48ab658dcd5e',
        2, // <--- TAMPERED TURN
        'dash-uuid-001',
        tokenTurn1
      );
      expect(isTurn2Valid).toBe(false);
    });

    it('should reject when attacker tampers sessionId or dashboardId', () => {
      const token = generateDashboardShareToken(
        '24d7acf9-5109-42e2-a5d1-48ab658dcd5e',
        1,
        'dash-uuid-001'
      );
      const isSessionTampered = verifyDashboardShareToken(
        'other-session-id',
        1,
        'dash-uuid-001',
        token
      );
      const isDashboardTampered = verifyDashboardShareToken(
        '24d7acf9-5109-42e2-a5d1-48ab658dcd5e',
        1,
        'dash-uuid-999',
        token
      );
      expect(isSessionTampered).toBe(false);
      expect(isDashboardTampered).toBe(false);
    });

    it('should reject garbage, empty or malformed tokens safely without throwing', () => {
      expect(verifyDashboardShareToken('sess', 1, 'dash', '')).toBe(false);
      expect(verifyDashboardShareToken('sess', 1, 'dash', 'invalid-hex')).toBe(false);
      expect(verifyDashboardShareToken('sess', 1, 'dash', null as any)).toBe(false);
    });
  });

  describe('Route: GET /api/dashboard/w/[sessionId]/[turn]', () => {
    it('1. Owner should be able to view their dashboard without any share token', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValue(mockOwner as any);
      vi.spyOn(dashboardStoreModule, 'getDashboardBySessionAndTurn').mockResolvedValue(sampleDashboardRecord);

      const req = new NextRequest(
        'http://localhost:3000/api/dashboard/w/24d7acf9-5109-42e2-a5d1-48ab658dcd5e/1'
      );

      const res = await handleSessionTurnGet(req, {
        params: { sessionId: '24d7acf9-5109-42e2-a5d1-48ab658dcd5e', turn: '1' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.title).toBe('Q1 Financial Report');
      expect(data.canEdit).toBe(true);
      expect(data.shareToken).toBeDefined();
      expect(data.shareUrl).toContain('?share=');
    });

    it('2. Guest/Non-owner with valid HMAC share token should be able to view in read-only mode', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValue(null); // Guest
      vi.spyOn(dashboardStoreModule, 'getDashboardBySessionAndTurn').mockResolvedValue(sampleDashboardRecord);

      const validToken = generateDashboardShareToken(
        '24d7acf9-5109-42e2-a5d1-48ab658dcd5e',
        1,
        'dash-uuid-001'
      );

      const req = new NextRequest(
        `http://localhost:3000/api/dashboard/w/24d7acf9-5109-42e2-a5d1-48ab658dcd5e/1?share=${validToken}`
      );

      const res = await handleSessionTurnGet(req, {
        params: { sessionId: '24d7acf9-5109-42e2-a5d1-48ab658dcd5e', turn: '1' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.canEdit).toBe(false);
      expect(data.shareToken).toBe(validToken);
    });

    it('3. IDOR Attack Prevention: Guest/Non-owner who manually changes turn number from /1 to /2 must be blocked with 403', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValue(mockAttacker as any);

      // Suppose turn 2 dashboard exists in that session
      const sampleDashboardTurn2 = {
        ...sampleDashboardRecord,
        turn_index: 2,
        title: 'Secret Question Turn 2',
      };
      vi.spyOn(dashboardStoreModule, 'getDashboardBySessionAndTurn').mockResolvedValue(sampleDashboardTurn2);

      // Token generated only for turn 1
      const tokenTurn1 = generateDashboardShareToken(
        '24d7acf9-5109-42e2-a5d1-48ab658dcd5e',
        1,
        'dash-uuid-001'
      );

      // Attacker manually changes URL in browser to turn 2 while retaining token from turn 1
      const req = new NextRequest(
        `http://localhost:3000/api/dashboard/w/24d7acf9-5109-42e2-a5d1-48ab658dcd5e/2?share=${tokenTurn1}`
      );

      const res = await handleSessionTurnGet(req, {
        params: { sessionId: '24d7acf9-5109-42e2-a5d1-48ab658dcd5e', turn: '2' },
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/Akses Ditolak/i);
    });

    it('4. Non-owner without share token should be blocked with 403', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValue(mockAttacker as any);
      vi.spyOn(dashboardStoreModule, 'getDashboardBySessionAndTurn').mockResolvedValue(sampleDashboardRecord);

      const req = new NextRequest(
        'http://localhost:3000/api/dashboard/w/24d7acf9-5109-42e2-a5d1-48ab658dcd5e/1'
      );

      const res = await handleSessionTurnGet(req, {
        params: { sessionId: '24d7acf9-5109-42e2-a5d1-48ab658dcd5e', turn: '1' },
      });

      expect(res.status).toBe(403);
    });

    it('5. Invalid turn format should return 400 Bad Request', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/dashboard/w/24d7acf9-5109-42e2-a5d1-48ab658dcd5e/invalid-turn'
      );

      const res = await handleSessionTurnGet(req, {
        params: { sessionId: '24d7acf9-5109-42e2-a5d1-48ab658dcd5e', turn: 'invalid-turn' },
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/Nomor pertanyaan tidak valid/i);
    });
  });

  describe('Route: PATCH /api/dashboard/w/[sessionId]/[turn]', () => {
    it('1. Owner can update dashboard data and title', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValue(mockOwner as any);
      vi.spyOn(dashboardStoreModule, 'getDashboardBySessionAndTurn').mockResolvedValue(sampleDashboardRecord);
      vi.spyOn(dashboardStoreModule, 'updateDashboardData').mockResolvedValue({
        ...sampleDashboardRecord,
        title: 'Updated Title',
      });

      const req = new NextRequest(
        'http://localhost:3000/api/dashboard/w/24d7acf9-5109-42e2-a5d1-48ab658dcd5e/1',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Updated Title',
            data: sampleData,
          }),
        }
      );

      const res = await handleSessionTurnPatch(req, {
        params: { sessionId: '24d7acf9-5109-42e2-a5d1-48ab658dcd5e', turn: '1' },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.title).toBe('Updated Title');
    });

    it('2. Guest/Non-owner even with share token is forbidden from updating dashboard (PATCH)', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValue(null);
      vi.spyOn(dashboardStoreModule, 'getDashboardBySessionAndTurn').mockResolvedValue(sampleDashboardRecord);

      const validToken = generateDashboardShareToken(
        '24d7acf9-5109-42e2-a5d1-48ab658dcd5e',
        1,
        'dash-uuid-001'
      );

      const req = new NextRequest(
        `http://localhost:3000/api/dashboard/w/24d7acf9-5109-42e2-a5d1-48ab658dcd5e/1?share=${validToken}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Hacked Title',
            data: sampleData,
          }),
        }
      );

      const res = await handleSessionTurnPatch(req, {
        params: { sessionId: '24d7acf9-5109-42e2-a5d1-48ab658dcd5e', turn: '1' },
      });

      expect(res.status).toBe(401); // Unauthenticated user gets 401
    });

    it('3. Logged-in non-owner cannot PATCH dashboard (403 Forbidden)', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValue(mockAttacker as any);
      vi.spyOn(dashboardStoreModule, 'getDashboardBySessionAndTurn').mockResolvedValue(sampleDashboardRecord);

      const req = new NextRequest(
        'http://localhost:3000/api/dashboard/w/24d7acf9-5109-42e2-a5d1-48ab658dcd5e/1',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Hacked Title',
            data: sampleData,
          }),
        }
      );

      const res = await handleSessionTurnPatch(req, {
        params: { sessionId: '24d7acf9-5109-42e2-a5d1-48ab658dcd5e', turn: '1' },
      });

      expect(res.status).toBe(403);
    });
  });
});
