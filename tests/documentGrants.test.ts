import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dbClient from '../lib/db/dbClient';
import {
  grantDocumentAccess,
  revokeDocumentAccess,
  listDocumentGrants,
  getUserDocumentGrant,
  listUserGrantedBatchIds,
  bulkGrantDocumentAccess,
} from '../lib/db/documentGrantStore';
import {
  canUserAccessDocument,
  canUserAccessDocumentAsync,
  getAllowedClassificationsForRole,
} from '../lib/auth/serverAuth';

describe('Document Access Grants & Per-User Whitelist', () => {
  const mockPool = {
    query: vi.fn(),
  };

  beforeEach(() => {
    mockPool.query.mockReset();
    vi.clearAllMocks();
    vi.spyOn(dbClient, 'getPool').mockReturnValue(mockPool as any);
  });

  describe('1. documentGrantStore functions', () => {
    it('should grant viewer access to a document batch', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await grantDocumentAccess('batch-123', 'user-456', 'viewer', 'admin-001');

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const queryCall = mockPool.query.mock.calls[0];
      expect(queryCall[0]).toContain('INSERT INTO document_access_grants');
      expect(queryCall[1]).toEqual(['batch-123', 'user-456', 'viewer', 'admin-001']);
    });

    it('should grant editor access to a document batch', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      await grantDocumentAccess('batch-123', 'user-456', 'editor', 'owner-002');

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const queryCall = mockPool.query.mock.calls[0];
      expect(queryCall[1]).toEqual(['batch-123', 'user-456', 'editor', 'owner-002']);
    });

    it('should revoke access successfully', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await revokeDocumentAccess('batch-123', 'user-456');

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM document_access_grants'),
        ['batch-123', 'user-456']
      );
    });

    it('should list user granted batch ids', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ upload_batch_id: 'batch-1' }, { upload_batch_id: 'batch-2' }],
      });

      const batchIds = await listUserGrantedBatchIds('user-789');

      expect(batchIds).toEqual(['batch-1', 'batch-2']);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM document_access_grants'),
        ['user-789']
      );
    });

    it('should list all document grants for a batch', async () => {
      const mockGrants = [
        {
          id: 'g-1',
          upload_batch_id: 'batch-100',
          user_id: 'user-001',
          user_name: 'Budi Santoso',
          user_email: 'budi@corp.com',
          user_department: 'Operasional',
          user_role_id: 'member',
          access_level: 'viewer',
          granted_by: 'admin-001',
          granted_by_name: 'Admin Utama',
          created_at: '2026-10-15T10:00:00Z',
          updated_at: '2026-10-15T10:00:00Z',
        },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockGrants });

      const grants = await listDocumentGrants('batch-100');

      expect(grants).toEqual(mockGrants);
    });

    it('should execute bulk grant access', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      await bulkGrantDocumentAccess(
        'batch-999',
        [
          { userId: 'u1', accessLevel: 'viewer' },
          { userId: 'u2', accessLevel: 'editor' },
        ],
        'admin-001'
      );

      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('2. canUserAccessDocument Authorization Logic', () => {
    const restrictedDoc = {
      id: 'batch-secret-direksi',
      division_id: 'Direksi',
      classification: 'Sangat Rahasia' as const,
      owner_id: 'direktur-id',
    };

    const regularMember = {
      id: 'user-staff',
      name: 'Staf Operasional',
      department: 'Operasional',
      role_id: 'member',
    };

    it('should deny regular member from accessing Sangat Rahasia Direksi document by default', () => {
      const canAccess = canUserAccessDocument(regularMember, restrictedDoc);
      expect(canAccess).toBe(false);
    });

    it('should grant access to regular member when document ID is in explicitGrantedBatchIds', () => {
      const explicitBatchIds = new Set(['batch-secret-direksi']);
      const canAccess = canUserAccessDocument(regularMember, restrictedDoc, explicitBatchIds);
      expect(canAccess).toBe(true);
    });

    it('should grant access when explicitGrantedBatchIds is passed as array', () => {
      const explicitBatchIds = ['batch-secret-direksi'];
      const canAccess = canUserAccessDocument(regularMember, restrictedDoc, explicitBatchIds);
      expect(canAccess).toBe(true);
    });

    it('should deny if another batch is in explicit list but not this document', () => {
      const explicitBatchIds = new Set(['other-batch']);
      const canAccess = canUserAccessDocument(regularMember, restrictedDoc, explicitBatchIds);
      expect(canAccess).toBe(false);
    });

    it('should always grant access to superadmin regardless of grants', () => {
      const superadmin = {
        id: 'admin-1',
        name: 'Super Administrator',
        department: 'IT',
        role_id: 'superadmin',
      };
      const canAccess = canUserAccessDocument(superadmin, restrictedDoc);
      expect(canAccess).toBe(true);
    });
  });

  describe('3. canUserAccessDocumentAsync with Grant Levels', () => {
    const confidentialDoc = {
      id: 'batch-finance-confidential',
      division_id: 'Finance',
      classification: 'Rahasia' as const,
      owner_id: 'cfo-user',
    };

    const marketingStaff = {
      id: 'user-marketing',
      name: 'Marketing Staff',
      department: 'Marketing',
      role_id: 'member',
    };

    it('should resolve viewer grant correctly (canAccess: true, canEdit: false)', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            upload_batch_id: 'batch-finance-confidential',
            user_id: 'user-marketing',
            access_level: 'viewer',
          },
        ],
      });

      const perm = await canUserAccessDocumentAsync(marketingStaff, confidentialDoc);

      expect(perm.canAccess).toBe(true);
      expect(perm.canEdit).toBe(false);
      expect(perm.accessLevel).toBe('viewer');
    });

    it('should resolve editor grant correctly (canAccess: true, canEdit: true)', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            upload_batch_id: 'batch-finance-confidential',
            user_id: 'user-marketing',
            access_level: 'editor',
          },
        ],
      });

      const perm = await canUserAccessDocumentAsync(marketingStaff, confidentialDoc);

      expect(perm.canAccess).toBe(true);
      expect(perm.canEdit).toBe(true);
      expect(perm.accessLevel).toBe('editor');
    });

    it('should deny access if no grant exists and ABAC fails', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const perm = await canUserAccessDocumentAsync(marketingStaff, confidentialDoc);

      expect(perm.canAccess).toBe(false);
      expect(perm.canEdit).toBe(false);
      expect(perm.accessLevel).toBe(null);
    });
  });
});
