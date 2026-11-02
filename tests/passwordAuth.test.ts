import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleLogin } from '../src/app/api/auth/login/route';
import { POST as handleChangePassword } from '../src/app/api/auth/change-password/route';
import { POST as handleResetPassword } from '../src/app/api/users/[id]/reset-password/route';
import * as dbClient from '../lib/db/dbClient';
import * as userStoreModule from '../lib/db/userStore';
import * as serverAuthModule from '../lib/auth/serverAuth';
import * as sessionStoreModule from '../lib/db/sessionStore';
import * as auditLogModule from '../lib/db/auditLogStore';
import { hashPassword } from '../lib/security/passwordHasher';

describe('Password Management & Authentication Flow', () => {
  const mockPool = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.query.mockReset().mockResolvedValue({ rows: [] });
    vi.spyOn(dbClient, 'getPool').mockReturnValue(mockPool as any);
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 when identifier or password is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: '' }),
      });

      const res = await handleLogin(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('should authenticate user with hashed password and strip password_hash from response', async () => {
      const rawPassword = 'MySecretPassword2026!';
      const hashedPassword = await hashPassword(rawPassword);

      vi.spyOn(userStoreModule, 'getUserAuthByEmailOrUsername').mockResolvedValueOnce({
        id: 'user-hashed-1',
        name: 'Hashed User',
        email: 'hashed@brilian.ai',
        role_id: 'member',
        status: 'active',
        password_hash: hashedPassword,
        department: 'IT',
      } as any);

      vi.spyOn(sessionStoreModule, 'createSession').mockResolvedValueOnce({
        token: 'sess-token-123',
        user_id: 'user-hashed-1',
        expires_at: new Date(),
        ip_address: '127.0.0.1',
        user_agent: 'Vitest',
        created_at: new Date(),
      } as any);

      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'hashed@brilian.ai', password: rawPassword }),
      });

      const res = await handleLogin(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.id).toBe('user-hashed-1');
      expect(data.user.password_hash).toBeUndefined();
    });

    it('should reject login when password does not match hashed password', async () => {
      const hashedPassword = await hashPassword('CorrectPassword123');

      vi.spyOn(userStoreModule, 'getUserAuthByEmailOrUsername').mockResolvedValueOnce({
        id: 'user-hashed-1',
        name: 'Hashed User',
        email: 'hashed@brilian.ai',
        role_id: 'member',
        status: 'active',
        password_hash: hashedPassword,
        department: 'IT',
      } as any);

      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'hashed@brilian.ai', password: 'WrongPassword' }),
      });

      const res = await handleLogin(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Incorrect username or password');
    });

    it('should transparently migrate legacy unhashed user on successful login', async () => {
      const legacyPassword = 'admin123';
      const updatePasswordSpy = vi.spyOn(userStoreModule, 'updateUserPassword').mockResolvedValueOnce(true);

      vi.spyOn(userStoreModule, 'getUserAuthByEmailOrUsername').mockResolvedValueOnce({
        id: 'legacy-user-1',
        name: 'Legacy User',
        email: 'legacy@brilian.ai',
        role_id: 'member',
        status: 'active',
        password_hash: null, // Unhashed legacy account
        department: 'General',
      } as any);

      vi.spyOn(sessionStoreModule, 'createSession').mockResolvedValueOnce({
        token: 'sess-token-legacy',
        user_id: 'legacy-user-1',
        expires_at: new Date(),
        ip_address: '127.0.0.1',
        user_agent: 'Vitest',
        created_at: new Date(),
      } as any);

      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'legacy@brilian.ai', password: legacyPassword }),
      });

      const res = await handleLogin(req);
      expect(res.status).toBe(200);

      // Verify that updateUserPassword was called with a newly generated scrypt hash
      expect(updatePasswordSpy).toHaveBeenCalledTimes(1);
      const [userId, generatedHash] = updatePasswordSpy.mock.calls[0];
      expect(userId).toBe('legacy-user-1');
      expect(generatedHash).toContain(':');
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should return 401 when unauthenticated', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'old', newPassword: 'newPassword123', confirmPassword: 'newPassword123' }),
      });

      const res = await handleChangePassword(req);
      expect(res.status).toBe(401);
    });

    it('should return 400 when new password confirmation does not match', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValueOnce({
        id: 'user-1',
        name: 'Test User',
        email: 'test@brilian.ai',
        role_id: 'member',
        status: 'active',
      } as any);

      const req = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'old', newPassword: 'Password123', confirmPassword: 'DifferentPassword' }),
      });

      const res = await handleChangePassword(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Konfirmasi password baru tidak cocok');
    });

    it('should return 400 when new password length is less than 8 characters', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValueOnce({
        id: 'user-1',
        name: 'Test User',
        email: 'test@brilian.ai',
        role_id: 'member',
        status: 'active',
      } as any);

      const req = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'old', newPassword: 'short', confirmPassword: 'short' }),
      });

      const res = await handleChangePassword(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('minimal terdiri dari 8 karakter');
    });

    it('should return 400 when current password is wrong', async () => {
      const currentHashed = await hashPassword('MyRealCurrentPassword');

      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValueOnce({
        id: 'user-1',
        name: 'Test User',
        email: 'test@brilian.ai',
        role_id: 'member',
        status: 'active',
      } as any);

      vi.spyOn(userStoreModule, 'getUserAuthByEmailOrUsername').mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@brilian.ai',
        password_hash: currentHashed,
      } as any);

      const req = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: 'WrongCurrentPassword',
          newPassword: 'BrandNewSecurePassword123',
          confirmPassword: 'BrandNewSecurePassword123',
        }),
      });

      const res = await handleChangePassword(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Password saat ini yang Anda masukkan salah');
    });

    it('should successfully update password and record audit log when current password is valid', async () => {
      const currentHashed = await hashPassword('MyCurrentPassword123');
      const updatePasswordSpy = vi.spyOn(userStoreModule, 'updateUserPassword').mockResolvedValueOnce(true);
      const auditSpy = vi.spyOn(auditLogModule, 'recordAuditEvent').mockResolvedValueOnce(true as any);

      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValueOnce({
        id: 'user-1',
        name: 'Test User',
        email: 'test@brilian.ai',
        role_id: 'member',
        status: 'active',
        department: 'Operations',
      } as any);

      vi.spyOn(userStoreModule, 'getUserAuthByEmailOrUsername').mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@brilian.ai',
        password_hash: currentHashed,
      } as any);

      const req = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: 'MyCurrentPassword123',
          newPassword: 'BrandNewSecurePassword2026',
          confirmPassword: 'BrandNewSecurePassword2026',
        }),
      });

      const res = await handleChangePassword(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      expect(updatePasswordSpy).toHaveBeenCalledTimes(1);
      expect(auditSpy).toHaveBeenCalledTimes(1);
      expect(auditSpy.mock.calls[0][0].action).toBe('auth.password_changed');
    });
  });

  describe('POST /api/users/[id]/reset-password', () => {
    it('should return 401 when actor is unauthenticated', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost:3000/api/users/target-1/reset-password', {
        method: 'POST',
      });

      const res = await handleResetPassword(req, { params: { id: 'target-1' } });
      expect(res.status).toBe(401);
    });

    it('should return 403 when actor does not have users:manage permission', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValueOnce({
        id: 'member-user',
        name: 'Regular Member',
        email: 'member@brilian.ai',
        role_id: 'member',
        role: {
          id: 'member',
          permissions: ['documents:read'],
        },
      } as any);

      const req = new NextRequest('http://localhost:3000/api/users/target-1/reset-password', {
        method: 'POST',
      });

      const res = await handleResetPassword(req, { params: { id: 'target-1' } });
      expect(res.status).toBe(403);
    });

    it('should auto-generate temporary password when newPassword is not provided', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValueOnce({
        id: 'admin-user',
        name: 'Admin User',
        email: 'admin@brilian.ai',
        role_id: 'admin',
        role: {
          id: 'admin',
          permissions: ['users:manage'],
        },
      } as any);

      vi.spyOn(userStoreModule, 'getUserById').mockResolvedValueOnce({
        id: 'target-1',
        name: 'Target Employee',
        email: 'target@brilian.ai',
        role_id: 'member',
        status: 'active',
      } as any);

      const updatePasswordSpy = vi.spyOn(userStoreModule, 'updateUserPassword').mockResolvedValueOnce(true);
      const auditSpy = vi.spyOn(auditLogModule, 'recordAuditEvent').mockResolvedValueOnce(true as any);

      const req = new NextRequest('http://localhost:3000/api/users/target-1/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await handleResetPassword(req, { params: { id: 'target-1' } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.temporaryPassword).toMatch(/^Brilian#[a-f0-9]{6}$/);

      expect(updatePasswordSpy).toHaveBeenCalledTimes(1);
      expect(auditSpy).toHaveBeenCalledTimes(1);
      expect(auditSpy.mock.calls[0][0].action).toBe('user.password_reset');
    });

    it('should allow setting custom password when provided with valid length', async () => {
      vi.spyOn(serverAuthModule, 'getAuthenticatedUser').mockResolvedValueOnce({
        id: 'admin-user',
        name: 'Admin User',
        email: 'admin@brilian.ai',
        role_id: 'admin',
        role: {
          id: 'admin',
          permissions: ['users:manage'],
        },
      } as any);

      vi.spyOn(userStoreModule, 'getUserById').mockResolvedValueOnce({
        id: 'target-1',
        name: 'Target Employee',
        email: 'target@brilian.ai',
        role_id: 'member',
        status: 'active',
      } as any);

      const updatePasswordSpy = vi.spyOn(userStoreModule, 'updateUserPassword').mockResolvedValueOnce(true);

      const req = new NextRequest('http://localhost:3000/api/users/target-1/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: 'CustomAdminSetPassword2026' }),
      });

      const res = await handleResetPassword(req, { params: { id: 'target-1' } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.temporaryPassword).toBeUndefined();
      expect(updatePasswordSpy).toHaveBeenCalledTimes(1);
    });
  });
});
