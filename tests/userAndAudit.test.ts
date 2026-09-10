import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dbClient from '../lib/db/dbClient';
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  _resetUserTableInitializedForTesting,
} from '../lib/db/userStore';
import {
  saveAuditLog,
  listAuditLogs,
  getAuditAnalytics,
  extractTopicFromQuery,
  _resetAuditTableInitializedForTesting,
} from '../lib/db/auditLogStore';

describe('User Management, RBAC & Chat Audit Logs', () => {
  const mockPool = {
    query: vi.fn(),
  };

  beforeEach(() => {
    mockPool.query.mockReset();
    vi.clearAllMocks();
    vi.spyOn(dbClient, 'getPool').mockReturnValue(mockPool as any);
    _resetUserTableInitializedForTesting();
    _resetAuditTableInitializedForTesting();
  });

  describe('1. Topic Extraction Intelligence', () => {
    it('should extract appropriate topic for physiotherapy history query', () => {
      const topic = extractTopicFromQuery('Jelaskan sejarah dan asal usul fisioterapi dari zaman Hippocrates');
      expect(topic).toBe('Sejarah & Evolusi Fisioterapi');
    });

    it('should extract appropriate topic for legal regulations query', () => {
      const topic = extractTopicFromQuery('Apa regulasi Permenkes No 80/2013 tentang fisioterapi?');
      expect(topic).toBe('Regulasi & Permenkes Fisioterapi');
    });

    it('should extract appropriate topic for audit & financial query', () => {
      const topic = extractTopicFromQuery('Bagaimana prosedur audit laporan keuangan tahunan?');
      expect(topic).toBe('Audit Operasional & Keuangan');
    });

    it('should extract appropriate topic for SOC2 compliance', () => {
      const topic = extractTopicFromQuery('Apakah sistem ini memenuhi standar kepatuhan SOC2?');
      expect(topic).toBe('Kepatuhan & Standar SOC2');
    });
  });

  describe('2. User Store Operations', () => {
    it('should list users with mapped roles and question counts', async () => {
      const mockUserRows = [
        {
          id: 'u-1',
          name: 'Siti Rahmawati',
          email: 'siti@brilian.ai',
          role_id: 'member',
          status: 'active',
          department: 'Medical',
          avatar_color: '#8B5CF6',
          last_login_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
          role_name: 'Member / Viewer',
          role_desc: 'Standard viewer',
          role_is_system: true,
          role_permissions: ['documents:read', 'chat:query'],
          question_count: '5',
        },
      ];

      // Table initialization queries
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // create roles
        .mockResolvedValueOnce({ rows: [] }) // insert roles
        .mockResolvedValueOnce({ rows: [] }) // create users
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // count check
        .mockResolvedValueOnce({ rows: mockUserRows }); // listUsers select

      const users = await listUsers();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Siti Rahmawati');
      expect(users[0].question_count).toBe(5);
      expect(users[0].role?.permissions).toContain('chat:query');
    });

    it('should create new user with default avatar and active status', async () => {
      const newId = 'u-new-1';
      const mockCreatedRow = {
        id: newId,
        name: 'dr. Andi Wijaya',
        email: 'andi@brilian.ai',
        role_id: 'editor',
        department: 'Medical Research',
        status: 'active',
        avatar_color: '#10B981',
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [mockCreatedRow] }) // INSERT
        .mockResolvedValueOnce({
          rows: [
            {
              ...mockCreatedRow,
              role_name: 'Knowledge Editor',
              role_permissions: ['documents:read'],
              question_count: '0',
            },
          ],
        }); // getUserById

      const user = await createUser({
        name: 'dr. Andi Wijaya',
        email: 'andi@brilian.ai',
        role_id: 'editor',
        department: 'Medical Research',
      });

      expect(user.name).toBe('dr. Andi Wijaya');
      expect(user.email).toBe('andi@brilian.ai');
      expect(user.role_id).toBe('editor');
    });

    it('should prevent deleting the primary system Super Admin', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });

      await expect(deleteUser('a0000000-0000-0000-0000-000000000001')).rejects.toThrow(
        'Akun Super Administrator utama sistem tidak dapat dihapus'
      );
    });
  });

  describe('3. Roles & RBAC Matrix', () => {
    it('should list roles with user counts and permissions catalog', async () => {
      const mockRoles = [
        {
          id: 'admin',
          name: 'Super Administrator',
          description: 'Full access',
          is_system: true,
          permissions: ['documents:read', 'users:manage'],
          user_count: '2',
        },
        {
          id: 'member',
          name: 'Member',
          description: 'Read only',
          is_system: true,
          permissions: ['documents:read'],
          user_count: '10',
        },
      ];

      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: mockRoles });

      const roles = await listRoles();
      expect(roles).toHaveLength(2);
      expect(roles[0].id).toBe('admin');
      expect(roles[0].user_count).toBe(2);
      expect(roles[0].permissions).toContain('users:manage');
    });
  });

  describe('4. Audit Log Store', () => {
    it('should save conversation log with detected topic and sources', async () => {
      const mockInserted = {
        id: 'log-101',
        session_id: 'sess-abc',
        user_id: 'u-1',
        user_name: 'Siti Rahmawati',
        user_email: 'siti@brilian.ai',
        user_department: 'Medical Staff',
        query_text: 'Jelaskan dasar hukum Permenkes Fisioterapi',
        topic: 'Regulasi & Permenkes Fisioterapi',
        answer_excerpt: 'Permenkes No 80/2013 mengatur tata laksana...',
        sources_used: [{ filename: 'TM 1. Sejarah FT.pdf', pageStart: 3, pageEnd: 4 }],
        retrieved_count: 1,
        created_at: new Date().toISOString(),
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // ensure table
        .mockResolvedValueOnce({ rows: [mockInserted] }); // insert

      const log = await saveAuditLog({
        sessionId: 'sess-abc',
        userId: 'u-1',
        userName: 'Siti Rahmawati',
        userEmail: 'siti@brilian.ai',
        userDepartment: 'Medical Staff',
        queryText: 'Jelaskan dasar hukum Permenkes Fisioterapi',
        answerText: 'Permenkes No 80/2013 mengatur tata laksana...',
        sources: [{ filename: 'TM 1. Sejarah FT.pdf', pageStart: 3, pageEnd: 4 }],
      });

      expect(log.topic).toBe('Regulasi & Permenkes Fisioterapi');
      expect(log.retrieved_count).toBe(1);
      expect(log.user_name).toBe('Siti Rahmawati');
    });

    it('should aggregate audit analytics and return top users leaderboard', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // ensure table
        .mockResolvedValueOnce({ rows: [{ total_conversations: '25', total_active_users: '4' }] })
        .mockResolvedValueOnce({
          rows: [
            { topic: 'Sejarah & Evolusi Fisioterapi', count: '12' },
            { topic: 'Regulasi & Permenkes Fisioterapi', count: '8' },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'u-1',
              name: 'Siti Rahmawati',
              email: 'siti@brilian.ai',
              department: 'Medical Staff',
              avatar_color: '#8B5CF6',
              role_name: 'Member',
              total_queries: '15',
              last_active: new Date(),
              topics: ['Sejarah & Evolusi Fisioterapi', 'Regulasi & Permenkes Fisioterapi'],
            },
          ],
        });

      const analytics = await getAuditAnalytics();

      expect(analytics.total_conversations).toBe(25);
      expect(analytics.total_active_users).toBe(4);
      expect(analytics.top_topics[0].topic).toBe('Sejarah & Evolusi Fisioterapi');
      expect(analytics.top_users).toHaveLength(1);
      expect(analytics.top_users[0].name).toBe('Siti Rahmawati');
      expect(analytics.top_users[0].total_queries).toBe(15);
    });
  });
});
