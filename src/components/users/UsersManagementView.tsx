'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Plus, Search, Eye, Pencil, RotateCcw, X, Loader2,
  CheckCircle2, Clock, ShieldCheck, UserCheck, Trash2, KeyRound, Check,
} from 'lucide-react';
import { User, Role } from '@/types/user';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
import { toast } from 'sonner';
import UserAvatar from '@/components/ui/UserAvatar';
import EnterprisePageHeader from '@/components/layout/EnterprisePageHeader';
import DashboardMetricCard from '@/components/dashboard/DashboardMetricCard';
import EnterprisePagination from '@/components/ui/EnterprisePagination';
import EnterpriseSelect, { EnterpriseSelectOption } from '@/components/ui/EnterpriseSelect';

function fmtDate(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ROLE_COLORS: Record<string, string> = {
  admin: '#2563eb',
  member: '#16a34a',
  viewer: '#9333ea',
  finance: '#d97706',
  direktur: '#0891b2',
  sales: '#db2777',
};
function roleDot(rid: string) {
  return ROLE_COLORS[rid.toLowerCase()] ?? '#64748b';
}

const OL: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.45)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: '1.25rem',
};

function BOX(w = 520): React.CSSProperties {
  return {
    backgroundColor: 'var(--bg-card, #ffffff)',
    border: '1px solid var(--border-default, #e2e8f0)',
    borderRadius: '14px',
    width: '100%',
    maxWidth: `${w}px`,
    padding: '1.5rem',
    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.16)',
  };
}

const LBL: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: '5px',
};

const INP: React.CSSProperties = {
  width: '100%',
  height: '34px',
  padding: '0 12px',
  borderRadius: '8px',
  border: '1px solid var(--border-default, #e2e8f0)',
  fontSize: '12.5px',
  color: 'var(--text-primary)',
  backgroundColor: 'var(--bg-card, #ffffff)',
  outline: 'none',
  boxSizing: 'border-box',
};

function StatusBadge({ status }: { status: 'active' | 'inactive' | 'pending_approval' }) {
  if (status === 'pending_approval') {
    return (
      <span className="status-pill-warning">
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
        Menunggu Approval
      </span>
    );
  }
  const ok = status === 'active';
  return (
    <span className={ok ? 'status-pill-success' : 'status-pill-neutral'}>
      <span
        style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          backgroundColor: ok ? 'var(--color-success, #10b981)' : 'var(--text-muted)',
        }}
      />
      {ok ? 'Aktif' : 'Nonaktif'}
    </span>
  );
}

function IBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        border: '1px solid var(--border-default, #e2e8f0)',
        backgroundColor: 'var(--bg-card, #ffffff)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: danger ? '#dc2626' : 'var(--text-secondary)',
        transition: 'all 0.12s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = danger ? '#fef2f2' : 'var(--bg-subtle, #f8fafc)';
        e.currentTarget.style.borderColor = danger ? '#fecaca' : 'var(--border-hover, #cbd5e1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
        e.currentTarget.style.borderColor = 'var(--border-default, #e2e8f0)';
      }}
    >
      {children}
    </button>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: '40px',
        height: '22px',
        borderRadius: '9999px',
        border: 'none',
        cursor: 'pointer',
        backgroundColor: checked ? 'var(--color-primary, #2563eb)' : '#cbd5e1',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '20px' : '2px',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          backgroundColor: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

export default function UsersManagementView() {
  const { language } = useLanguage();
  const { hasPermission, refreshUsers: refreshSessionUsers } = useUserSession();

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncTime, setSyncTime] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_approval' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const cardHeaderRef = useRef<HTMLDivElement>(null);
  const [statsHeight, setStatsHeight] = useState(110);
  const [cardHeaderHeight, setCardHeaderHeight] = useState(42);

  // Dynamic sticky measurement for 4 stats cards & card header
  useEffect(() => {
    const updateHeights = () => {
      if (statsRef.current) {
        const h = Math.round(statsRef.current.getBoundingClientRect().height);
        if (h > 0) setStatsHeight(h);
      }
      if (cardHeaderRef.current) {
        const ch = Math.round(cardHeaderRef.current.getBoundingClientRect().height);
        if (ch > 0) setCardHeaderHeight(ch);
      }
    };
    updateHeights();
    const observer = new ResizeObserver(updateHeights);
    if (statsRef.current) observer.observe(statsRef.current);
    if (cardHeaderRef.current) observer.observe(cardHeaderRef.current);
    window.addEventListener('resize', updateHeights);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeights);
    };
  }, [users, statusFilter]);

  const tableHeaderStickyTop = 48 + statsHeight - 1 + cardHeaderHeight - 1;

  // Keyboard shortcut Ctrl+K and /
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [approvingUser, setApprovingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Approve form
  const [aRoleId, setARoleId] = useState('member');
  const [aDept, setADept] = useState('Google Account');

  // Create form
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cDept, setCDept] = useState('');
  const [cPassword, setCPassword] = useState('');
  const [cRoleId, setCRoleId] = useState('member');
  const [cActive, setCActive] = useState(true);

  // Edit form
  const [eName, setEName] = useState('');
  const [eEmail, setEEmail] = useState('');
  const [eDept, setEDept] = useState('');
  const [eRoleId, setERoleId] = useState('member');
  const [eStatus, setEStatus] = useState<'active' | 'inactive' | 'pending_approval'>('active');

  const canManage = hasPermission('users:manage');

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const [uRes, rRes] = await Promise.all([fetch('/api/users'), fetch('/api/roles')]);
      if (uRes.ok) setUsers((await uRes.json()).users || []);
      if (rRes.ok) setRoles((await rRes.json()).roles || []);
      const d = new Date();
      setSyncTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      toast.error('Gagal memuat data: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Derived user lists for stats & filters
  const pendingUsers = useMemo(() => users.filter((u) => u.status === 'pending_approval'), [users]);
  const activeUsers = useMemo(() => users.filter((u) => u.status === 'active'), [users]);
  const inactiveUsers = useMemo(() => users.filter((u) => u.status === 'inactive'), [users]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return users.filter((u) => {
      const ms =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department ?? '').toLowerCase().includes(q);
      const mst = statusFilter === 'all' || u.status === statusFilter;
      return ms && mst;
    });
  }, [users, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, page), totalPages);
  const paginated = useMemo(() => {
    const s = (safeCurrentPage - 1) * pageSize;
    return filtered.slice(s, s + pageSize);
  }, [filtered, safeCurrentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  // Role options for EnterpriseSelect
  const roleSelectOptions: EnterpriseSelectOption[] = useMemo(
    () =>
      roles.map((r) => ({
        value: r.id,
        label: r.name,
        sublabel: r.description ? (r.description.length > 45 ? `${r.description.slice(0, 45)}...` : r.description) : undefined,
      })),
    [roles]
  );

  const statusSelectOptions: EnterpriseSelectOption[] = [
    { value: 'active', label: 'Aktif' },
    { value: 'pending_approval', label: 'Menunggu Approval' },
    { value: 'inactive', label: 'Nonaktif' },
  ];

  const openCreate = () => {
    setCName('');
    setCEmail('');
    setCDept('');
    setCPassword('');
    setCRoleId(roles[0]?.id || 'member');
    setCActive(true);
    setShowCreate(true);
  };

  const openEdit = (u: User) => {
    setEName(u.name);
    setEEmail(u.email);
    setEDept(u.department || '');
    setERoleId(u.role_id);
    setEStatus(u.status);
    setDetailUser(null);
    setEditingUser(u);
  };

  const openApprove = (u: User) => {
    setApprovingUser(u);
    setARoleId(u.role_id || 'member');
    setADept(u.department || 'Google Account');
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingUser) return;
    setIsApproving(true);
    try {
      const res = await fetch(`/api/users/${approvingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'active',
          role_id: aRoleId,
          department: aDept,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyetujui akun');
      const roleObj = roles.find((r) => r.id === aRoleId);
      toast.success(`Akun ${approvingUser.name} berhasil disetujui dengan peran ${roleObj?.name || aRoleId}`);
      setApprovingUser(null);
      await fetchUsers();
      await refreshSessionUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsApproving(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim() || !cEmail.trim()) {
      toast.warning('Nama dan Email wajib diisi');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cName.trim(),
          email: cEmail.trim(),
          role_id: cRoleId,
          department: cDept.trim(),
          status: cActive ? 'active' : 'inactive',
          password: cPassword || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat pengguna');
      toast.success('Pengguna baru berhasil dibuat');
      setShowCreate(false);
      await fetchUsers();
      await refreshSessionUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: eName.trim(),
          email: eEmail.trim(),
          role_id: eRoleId,
          department: eDept.trim(),
          status: eStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui pengguna');
      toast.success('Data pengguna berhasil diperbarui');
      setEditingUser(null);
      await fetchUsers();
      await refreshSessionUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (u: User) => {
    if (!canManage) {
      toast.error('Tidak memiliki hak akses');
      return;
    }
    const next = u.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error('Gagal memperbarui status akun');
      toast.success(next === 'active' ? `Akun ${u.name} berhasil diaktifkan` : `Akun ${u.name} berhasil dinonaktifkan`);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: next } : x)));
      if (detailUser?.id === u.id) setDetailUser((d) => (d ? { ...d, status: next } : d));
      await refreshSessionUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus pengguna');
      toast.success('Pengguna berhasil dihapus');
      setDeletingUser(null);
      await fetchUsers();
      await refreshSessionUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        padding: '0 0.25rem 3.5rem',
      }}
    >
      {/* ── Enterprise Page Header ── */}
      <EnterprisePageHeader
        title={language === 'en' ? 'User Management' : 'Kelola Pengguna'}
        subtitle={
          language === 'en'
            ? 'Manage accounts, access privileges, departmental roles, and operational activity.'
            : 'Kelola akun pengguna, peran akses (RBAC), departemen, dan pantau keaktifan tanya-jawab AI.'
        }
        syncTime={syncTime}
        onRefresh={fetchUsers}
        isLoading={isLoading}
        actions={
          canManage ? (
            <button
              type="button"
              onClick={openCreate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '28px',
                padding: '0 12px',
                fontSize: '11.5px',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: '#FFFFFF',
                backgroundColor: '#2563EB',
                border: '1px solid #1D4ED8',
                borderRadius: '9999px',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(37, 99, 235, 0.15)',
                transition: 'all 0.15s ease',
              }}
            >
              <Plus size={12} strokeWidth={2.4} />
              <span>{language === 'en' ? 'New User' : 'User Baru'}</span>
            </button>
          ) : null
        }
      />

      {/* ── 4 Pure Enterprise Metric Cards (Sticky Freeze below Header) ── */}
      <div
        ref={statsRef}
        style={{
          position: 'sticky',
          top: 'var(--header-height, 48px)',
          zIndex: 30,
          backgroundColor: 'var(--bg-app)',
          paddingTop: '6px',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--border-default)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: '0 2px 4px rgba(15, 23, 42, 0.03)',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '0.85rem',
          }}
        >
          <DashboardMetricCard
            title={language === 'en' ? 'Total Users' : 'Total Pengguna'}
            value={`${users.length} User`}
            badge="RBAC"
            badgeType="neutral"
            footerText={language === 'en' ? 'Registered accounts' : 'Akun terdaftar dalam KMS'}
            isLoading={isLoading}
            onClick={() => setStatusFilter('all')}
          />

          <DashboardMetricCard
            title={language === 'en' ? 'Active Users' : 'Pengguna Aktif'}
            value={`${activeUsers.length} Aktif`}
            badge="Active"
            badgeType="neutral"
            statusDot="live"
            footerText={language === 'en' ? 'Full access enabled' : 'Akses operasional normal'}
            isLoading={isLoading}
            onClick={() => setStatusFilter('active')}
          />

          <DashboardMetricCard
            title={language === 'en' ? 'Pending Approval' : 'Menunggu Approval'}
            value={`${pendingUsers.length} Antrean`}
            badge={pendingUsers.length > 0 ? 'Pending' : 'Clear'}
            badgeType={pendingUsers.length > 0 ? 'warning' : 'neutral'}
            statusDot={pendingUsers.length > 0 ? 'blue' : 'none'}
            footerText={
              pendingUsers.length > 0
                ? language === 'en'
                  ? 'Awaiting role assignment'
                  : 'Menunggu penugasan peran'
                : language === 'en'
                ? 'All accounts processed'
                : 'Semua akun telah diproses'
            }
            isLoading={isLoading}
            onClick={() => setStatusFilter('pending_approval')}
          />

          <DashboardMetricCard
            title={language === 'en' ? 'System Roles' : 'Peran Akses'}
            value={`${roles.length} Role`}
            badge="Security"
            badgeType="neutral"
            footerText={language === 'en' ? 'Defined RBAC matrix' : 'Hierarki hak akses terdefinisi'}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* ── Pending Users Action Callout Banner (if pending users exist) ── */}
      {pendingUsers.length > 0 && statusFilter !== 'pending_approval' && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={16} color="#d97706" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '12px', color: '#92400e' }}>
                Terdapat {pendingUsers.length} akun Google baru menunggu persetujuan
              </div>
              <div style={{ fontSize: '11.5px', color: '#b45309' }}>
                Tinjau akun dan tetapkan hak akses (Role) sebelum pengguna dapat mengakses sistem KMS.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('pending_approval')}
            style={{
              padding: '4px 12px',
              borderRadius: '9999px',
              backgroundColor: '#d97706',
              color: '#ffffff',
              border: 'none',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 1px 2px rgba(217, 119, 6, 0.2)',
            }}
          >
            <UserCheck size={13} />
            Tinjau Sekarang ({pendingUsers.length})
          </button>
        </div>
      )}

      {/* ── Main Stream Card (Linear / Vercel Enterprise Style) ── */}
      <div
        className="enterprise-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '400px',
          overflow: 'visible',
        }}
      >
        {/* Sticky Freeze Header below 4 Stats Cards */}
        <div
          ref={cardHeaderRef}
          className="enterprise-card-header"
          style={{
            flexWrap: 'wrap',
            gap: '8px',
            position: 'sticky',
            top: `${48 + statsHeight - 1}px`,
            zIndex: 25,
            backgroundColor: 'var(--bg-card, #ffffff)',
            boxShadow: '0 2px 4px rgba(15, 23, 42, 0.04)',
            borderBottom: '1px solid var(--border-default, #e2e8f0)',
          }}
        >
          {/* Left: Title + Inline Segmented Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {language === 'en' ? 'User Directory' : 'Daftar Pengguna'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                · {filtered.length} user
              </span>
            </div>

            {/* Segmented Status Switcher (Smooth Pill Style) */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                border: '1px solid var(--border-default, #e2e8f0)',
                borderRadius: '9999px',
                padding: '2px',
                gap: '2px',
                height: '26px',
              }}
            >
              {(
                [
                  { key: 'all', label: language === 'en' ? 'All' : 'Semua', count: users.length },
                  { key: 'pending_approval', label: language === 'en' ? 'Pending' : 'Menunggu Approval', count: pendingUsers.length, highlight: pendingUsers.length > 0 },
                  { key: 'active', label: language === 'en' ? 'Active' : 'Aktif', count: activeUsers.length },
                  { key: 'inactive', label: language === 'en' ? 'Inactive' : 'Nonaktif', count: inactiveUsers.length },
                ] as { key: 'all' | 'pending_approval' | 'active' | 'inactive'; label: string; count: number; highlight?: boolean }[]
              ).map((tab) => {
                const isSelected = statusFilter === tab.key;
                const isHighlighted = Boolean(tab.highlight);
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setStatusFilter(tab.key);
                      setPage(1);
                    }}
                    style={{
                      borderRadius: '9999px',
                      padding: '2px 10px',
                      fontSize: '11px',
                      height: '22px',
                      fontWeight: isSelected ? 600 : 500,
                      border: 'none',
                      backgroundColor: isSelected ? 'var(--bg-card, #ffffff)' : 'transparent',
                      color: isSelected
                        ? isHighlighted
                          ? '#b45309'
                          : 'var(--text-primary)'
                        : 'var(--text-secondary)',
                      boxShadow: isSelected ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <span>{tab.label}</span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '0 5px',
                        borderRadius: '9999px',
                        backgroundColor: isSelected
                          ? isHighlighted
                            ? '#fef3c7'
                            : 'var(--bg-subtle, #f1f5f9)'
                          : 'rgba(0,0,0,0.05)',
                        color: isHighlighted ? '#b45309' : 'var(--text-muted)',
                      }}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Search Box with Smooth Pill & Ctrl+K */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                border: '1px solid var(--border-default, #e2e8f0)',
                borderRadius: '9999px',
                padding: '0 8px 0 10px',
                height: '26px',
                width: '230px',
                gap: '6px',
              }}
            >
              <Search size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={language === 'en' ? 'Search user, email, dept...' : 'Cari nama, email, divisi...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '11.5px',
                  color: 'var(--text-primary)',
                  padding: 0,
                  minWidth: 0,
                }}
              />
              <kbd className="kbd-shortcut" style={{ fontSize: '9px', padding: '1px 4px' }}>
                Ctrl K
              </kbd>
            </div>
          </div>
        </div>

        {/* ── Table Content ── */}
        <div className="enterprise-table-wrapper">
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12.5px' }}>
            <thead>
              <tr>
                {['Pengguna', 'Username', 'Role Akses', 'Departemen', 'Pertanyaan AI', 'Login Terakhir', 'Status', 'Aksi'].map((h, idx) => (
                  <th
                    key={h}
                    style={{
                      position: 'sticky',
                      top: `${tableHeaderStickyTop}px`,
                      zIndex: 20,
                      backgroundColor: 'var(--bg-subtle, #f8fafc)',
                      padding: '8px 14px',
                      fontWeight: 600,
                      fontSize: '11px',
                      letterSpacing: '0.02em',
                      color: 'var(--text-secondary)',
                      textAlign: idx === 7 ? 'right' : idx === 4 ? 'center' : 'left',
                      whiteSpace: 'nowrap',
                      borderBottom: '1px solid var(--border-default, #e2e8f0)',
                      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
                      <Loader2 size={16} className="animate-spin" color="var(--color-primary, #2563eb)" />
                      <span>Memuat data pengguna...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                      {searchQuery ? 'Tidak ada pengguna yang cocok' : 'Belum ada pengguna'}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '11.5px' }}>
                      Coba sesuaikan kata kunci pencarian atau filter status di atas.
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map((u) => {
                  const isSA = u.id === 'a0000000-0000-0000-0000-000000000001';
                  const isPending = u.status === 'pending_approval';

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Name & Email */}
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <UserAvatar name={u.name} size={30} />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: '12.5px',
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {u.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td style={{ padding: '9px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {u.email.split('@')[0]}
                      </td>

                      {/* Role */}
                      <td style={{ padding: '9px 14px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            border: '1px solid var(--border-default, #e2e8f0)',
                            backgroundColor: 'var(--bg-subtle, #f8fafc)',
                            fontSize: '11.5px',
                            color: 'var(--text-primary)',
                            fontWeight: 500,
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: roleDot(u.role_id),
                              flexShrink: 0,
                            }}
                          />
                          {u.role?.name || u.role_id}
                        </span>
                      </td>

                      {/* Department */}
                      <td style={{ padding: '9px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {u.department || '—'}
                      </td>

                      {/* AI Question Count */}
                      <td
                        style={{
                          padding: '9px 14px',
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          textAlign: 'center',
                          fontFamily: 'var(--font-mono, monospace)',
                        }}
                      >
                        {u.question_count ?? 0}
                      </td>

                      {/* Last Login */}
                      <td style={{ padding: '9px 14px', fontSize: '11.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '9px 14px' }}>
                        <StatusBadge status={u.status} />
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end' }}>
                          {isPending && canManage ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openApprove(u)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  height: '24px',
                                  padding: '0 9px',
                                  borderRadius: '9999px',
                                  backgroundColor: '#2563eb',
                                  color: '#ffffff',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  boxShadow: '0 1px 2px rgba(37,99,235,0.2)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <CheckCircle2 size={12} />
                                Setujui
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingUser(u)}
                                style={{
                                  height: '24px',
                                  padding: '0 8px',
                                  borderRadius: '9999px',
                                  border: '1px solid #fecaca',
                                  backgroundColor: '#fef2f2',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  color: '#dc2626',
                                  fontWeight: 600,
                                }}
                              >
                                Tolak
                              </button>
                            </>
                          ) : null}

                          <IBtn title="Lihat detail" onClick={() => setDetailUser(u)}>
                            <Eye size={12} />
                          </IBtn>

                          {canManage && (
                            <IBtn title="Edit pengguna" onClick={() => openEdit(u)}>
                              <Pencil size={12} />
                            </IBtn>
                          )}

                          {canManage && !isSA && (
                            <IBtn title="Revoke sesi aktif" onClick={() => toast.info('Fitur revoke sesi belum tersedia')}>
                              <RotateCcw size={12} />
                            </IBtn>
                          )}

                          {canManage && !isSA && !isPending && (
                            <button
                              type="button"
                              onClick={() => toggleStatus(u)}
                              style={{
                                height: '24px',
                                padding: '0 8px',
                                borderRadius: '9999px',
                                border: '1px solid var(--border-default, #e2e8f0)',
                                backgroundColor: 'var(--bg-card, #ffffff)',
                                cursor: 'pointer',
                                fontSize: '11px',
                                color: 'var(--text-secondary)',
                                fontWeight: 500,
                                transition: 'all 0.12s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)')}
                            >
                              {u.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Enterprise Pagination Bar (Always pinned at bottom) ── */}
        <EnterprisePagination
          currentPage={safeCurrentPage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          language={language}
        />
      </div>

      {/* ════ MODAL: Buat User ════ */}
      {showCreate && (
        <div style={OL} onClick={() => setShowCreate(false)}>
          <div style={BOX(480)} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Buat Pengguna Baru
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Tambahkan akun pengguna lokal dengan kredensial awal.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={LBL}>Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    style={INP}
                    placeholder="Contoh: Budi Santoso"
                    autoFocus
                  />
                </div>
                <div>
                  <label style={LBL}>Email Kantor *</label>
                  <input
                    type="email"
                    required
                    value={cEmail}
                    onChange={(e) => setCEmail(e.target.value)}
                    style={INP}
                    placeholder="budi@perusahaan.com"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={LBL}>Departemen / Divisi</label>
                  <input
                    type="text"
                    placeholder="Contoh: Operasional"
                    value={cDept}
                    onChange={(e) => setCDept(e.target.value)}
                    style={INP}
                  />
                </div>
                <div>
                  <label style={LBL}>Role Akses (RBAC)</label>
                  <EnterpriseSelect
                    value={cRoleId}
                    onChange={(val) => setCRoleId(String(val))}
                    options={roleSelectOptions}
                    size="sm"
                    width="100%"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={LBL}>Password Awal</label>
                <input
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={cPassword}
                  onChange={(e) => setCPassword(e.target.value)}
                  style={INP}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  backgroundColor: 'var(--bg-subtle, #f8fafc)',
                  marginBottom: '1.25rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-primary)' }}>Akun Aktif Langsung</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                    User aktif dapat langsung login ke portal KMS.
                  </div>
                </div>
                <Toggle checked={cActive} onChange={setCActive} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  style={{
                    height: '28px',
                    padding: '0 14px',
                    borderRadius: '9999px',
                    border: '1px solid var(--border-default, #e2e8f0)',
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    height: '28px',
                    padding: '0 14px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#FFFFFF',
                    backgroundColor: '#2563EB',
                    border: '1px solid #1D4ED8',
                    borderRadius: '9999px',
                    cursor: 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Buat Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ MODAL: Detail User ════ */}
      {detailUser && (
        <div style={OL} onClick={() => setDetailUser(null)}>
          <div style={{ ...BOX(520), maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Detail Profil Pengguna
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Informasi akun, unit kerja, dan riwayat aktivitas KMS.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailUser(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* User Profile Card */}
            <div
              style={{
                border: '1px solid var(--border-default, #e2e8f0)',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <UserAvatar name={detailUser.name} size={40} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                      {detailUser.name}
                    </span>
                    <StatusBadge status={detailUser.status} />
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {detailUser.email}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => openEdit(detailUser)}
                    style={{
                      height: '26px',
                      padding: '0 10px',
                      borderRadius: '9999px',
                      border: '1px solid var(--border-default, #e2e8f0)',
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                    }}
                  >
                    <Pencil size={11} />
                    Edit
                  </button>
                )}
                {canManage && detailUser.id !== 'a0000000-0000-0000-0000-000000000001' && (
                  <button
                    type="button"
                    onClick={() => toggleStatus(detailUser)}
                    style={{
                      height: '26px',
                      padding: '0 10px',
                      borderRadius: '9999px',
                      border: '1px solid var(--border-default, #e2e8f0)',
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                    }}
                  >
                    {detailUser.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                )}
              </div>
            </div>

            {/* Metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
              {[
                { l: 'DEPARTEMEN', v: detailUser.department || '—' },
                { l: 'PERTANYAAN AI', v: String(detailUser.question_count ?? 0) },
                { l: 'ROLE', v: detailUser.role?.name || detailUser.role_id },
                { l: 'STATUS', v: detailUser.status === 'active' ? 'Aktif' : 'Nonaktif' },
              ].map(({ l, v }) => (
                <div
                  key={l}
                  style={{
                    border: '1px solid var(--border-default, #e2e8f0)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    backgroundColor: 'var(--bg-card, #ffffff)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '9.5px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      marginBottom: '3px',
                    }}
                  >
                    {l}
                  </div>
                  <div
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {v}
                  </div>
                </div>
              ))}
            </div>

            {/* Timestamps */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
              {[
                { l: 'LOGIN TERAKHIR', v: fmtDate(detailUser.last_login_at) },
                { l: 'TANGGAL DIBUAT', v: fmtDate(detailUser.created_at) },
                { l: 'TERAKHIR UPDATE', v: fmtDate(detailUser.updated_at) },
              ].map(({ l, v }) => (
                <div
                  key={l}
                  style={{
                    border: '1px solid var(--border-default, #e2e8f0)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    backgroundColor: 'var(--bg-card, #ffffff)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '9.5px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      marginBottom: '3px',
                    }}
                  >
                    {l}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-primary)' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL: Edit User ════ */}
      {editingUser && (
        <div style={OL} onClick={() => setEditingUser(null)}>
          <div style={BOX(480)} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Edit Pengguna
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Perbarui profil akun, departemen, dan hak akses.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={LBL}>Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    value={eName}
                    onChange={(e) => setEName(e.target.value)}
                    style={INP}
                  />
                </div>
                <div>
                  <label style={LBL}>Email Kantor *</label>
                  <input
                    type="email"
                    required
                    value={eEmail}
                    onChange={(e) => setEEmail(e.target.value)}
                    style={INP}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={LBL}>Departemen / Unit</label>
                  <input
                    type="text"
                    value={eDept}
                    onChange={(e) => setEDept(e.target.value)}
                    style={INP}
                  />
                </div>
                <div>
                  <label style={LBL}>Role Akses</label>
                  <EnterpriseSelect
                    value={eRoleId}
                    onChange={(val) => setERoleId(String(val))}
                    options={roleSelectOptions}
                    size="sm"
                    width="100%"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={LBL}>Status Akun</label>
                <EnterpriseSelect
                  value={eStatus}
                  onChange={(val) => setEStatus(val)}
                  options={statusSelectOptions}
                  size="sm"
                  width="100%"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  style={{
                    height: '28px',
                    padding: '0 14px',
                    borderRadius: '9999px',
                    border: '1px solid var(--border-default, #e2e8f0)',
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    height: '28px',
                    padding: '0 14px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#FFFFFF',
                    backgroundColor: '#2563EB',
                    border: '1px solid #1D4ED8',
                    borderRadius: '9999px',
                    cursor: 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ MODAL: Persetujuan Akun Google ════ */}
      {approvingUser && (
        <div style={OL} onClick={() => setApprovingUser(null)}>
          <div style={BOX(500)} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Persetujuan Akun Google
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Verifikasi identitas dan tentukan hak akses (Role) pengguna.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApprovingUser(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Profile Summary */}
            <div
              style={{
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                border: '1px solid var(--border-default, #e2e8f0)',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <UserAvatar name={approvingUser.name} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                  {approvingUser.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{approvingUser.email}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Mendaftar via Google SSO • {fmtDate(approvingUser.created_at)}
                </div>
              </div>
              <span className="status-pill-warning">Pending</span>
            </div>

            <form onSubmit={handleApprove}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={LBL}>
                  Pilih Role Akses (RBAC) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <EnterpriseSelect
                  value={aRoleId}
                  onChange={(val) => setARoleId(String(val))}
                  options={roleSelectOptions}
                  size="sm"
                  width="100%"
                />
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Hak akses menu dokumen, kurasi AI, chatbot, dan administrasi akan mengikuti role ini.
                </p>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={LBL}>Departemen / Unit Kerja</label>
                <input
                  type="text"
                  value={aDept}
                  onChange={(e) => setADept(e.target.value)}
                  placeholder="Contoh: Operasional, IT, Medis, dll."
                  style={INP}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const target = approvingUser;
                    setApprovingUser(null);
                    setDeletingUser(target);
                  }}
                  style={{
                    height: '28px',
                    padding: '0 12px',
                    borderRadius: '9999px',
                    border: '1px solid #fecaca',
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Tolak Akun
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setApprovingUser(null)}
                    style={{
                      height: '28px',
                      padding: '0 14px',
                      borderRadius: '9999px',
                      border: '1px solid var(--border-default, #e2e8f0)',
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                    }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isApproving}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      height: '28px',
                      padding: '0 16px',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: '#FFFFFF',
                      backgroundColor: '#2563EB',
                      border: '1px solid #1D4ED8',
                      borderRadius: '9999px',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(37,99,235,0.2)',
                      opacity: isApproving ? 0.7 : 1,
                    }}
                  >
                    {isApproving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    Setujui & Berikan Akses
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ MODAL: Hapus Pengguna ════ */}
      {deletingUser && (
        <div style={OL} onClick={() => setDeletingUser(null)}>
          <div style={BOX(420)} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Hapus Akun Pengguna?
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
              Apakah Anda yakin ingin menghapus akun <strong>&quot;{deletingUser.name}&quot;</strong> ({deletingUser.email})?
              Tindakan ini tidak dapat dibatalkan.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                style={{
                  height: '28px',
                  padding: '0 14px',
                  borderRadius: '9999px',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                style={{
                  height: '28px',
                  padding: '0 14px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : 'Hapus Pengguna'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
