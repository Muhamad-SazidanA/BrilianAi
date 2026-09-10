'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Download, X, Loader2,
  ChevronLeft, ChevronRight, ChevronDown, Eye,
  MessageSquare, Users, BookOpen, Clock, ArrowRight,
} from 'lucide-react';
import { ChatAuditLog, AuditAnalyticsSummary, User, TopActiveUser } from '@/types/user';
import MarkdownContent from '@/components/ui/MarkdownContent';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import UserAvatar from '@/components/ui/UserAvatar';

/* ── Spensify Design Shared Styles ─── */
const cardS: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
};
const OL: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: '1.5rem',
};
const INP: React.CSSProperties = {
  width: '100%',
  height: '34px',
  padding: '0 12px',
  borderRadius: '8px',
  border: '1px solid var(--border-default)',
  fontSize: '12.5px',
  color: 'var(--text-primary)',
  backgroundColor: 'var(--bg-card)',
  outline: 'none',
  boxSizing: 'border-box',
};

function PBtn({
  children, onClick, disabled, active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        height: '28px',
        minWidth: '28px',
        padding: '0 8px',
        borderRadius: '6px',
        border: '1px solid var(--border-default)',
        backgroundColor: active ? 'var(--bg-subtle)' : 'transparent',
        color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
        fontSize: '12.5px',
        fontWeight: active ? 600 : 400,
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function fmtDate(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
function fmtDateShort(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function AuditLogsView() {
  const { language } = useLanguage();

  const [activeTab, setActiveTab] = useState<'logs' | 'topUsers'>('logs');
  const [logs, setLogs] = useState<ChatAuditLog[]>([]);
  const [analytics, setAnalytics] = useState<AuditAnalyticsSummary | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [inspecting, setInspecting] = useState<ChatAuditLog | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      }
    } catch {}
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setIsLoadingAnalytics(true);
    try {
      const res = await fetch('/api/audit-logs/analytics');
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err: any) {
      console.warn('[AuditLogsView] Failed to load analytics:', err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (userFilter !== 'all') params.set('userId', userFilter);
      if (dateRange !== 'all') params.set('dateRange', dateRange);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('page', String(currentPage));
      params.set('limit', String(pageSize));

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotalPages(data.totalPages || 1);
        setTotalLogs(data.total || 0);
      }
    } catch (err: any) {
      toast.error('Gagal memuat log percakapan: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [userFilter, dateRange, searchQuery, currentPage, pageSize]);

  useEffect(() => {
    fetchUsers();
    fetchAnalytics();
  }, [fetchUsers, fetchAnalytics]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = () => {
    window.open('/api/audit-logs/export', '_blank');
    toast.success('Mengunduh log audit percakapan (CSV)...');
  };

  const selectUserAndShowLogs = (userId: string) => {
    setUserFilter(userId);
    setActiveTab('logs');
    setCurrentPage(1);
  };

  const dateRangeOptions: { value: typeof dateRange; label: string }[] = [
    { value: 'all', label: 'Semua waktu' },
    { value: 'today', label: 'Hari ini' },
    { value: '7d', label: '7 hari terakhir' },
    { value: '30d', label: '30 hari terakhir' },
  ];

  const selectedUserName = useMemo(() => {
    if (userFilter === 'all') return null;
    const found = usersList.find(u => u.id === userFilter);
    return found ? found.name : 'User terpilih';
  }, [userFilter, usersList]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Page Header (Spensify style, outside card) */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Audit Log Percakapan
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-primary)', margin: '3px 0 0' }}>
          Pantau intensitas pertanyaan seluruh pengguna dan topik bahasan percakapan AI dari satu tempat.
        </p>
      </div>

      {/* Main Card */}
      <div style={cardS}>
        {/* Card Top: Title & Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {activeTab === 'logs' ? 'Daftar riwayat percakapan' : 'Pengguna paling aktif'}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              {activeTab === 'logs'
                ? `${totalLogs.toLocaleString('id-ID')} percakapan tercatat di database`
                : `${analytics?.top_users?.length || 0} pengguna dengan aktivitas percakapan terbanyak`}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleExport}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '36px',
                padding: '0 14px',
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Tab Selection Bar (Spensify sub-navigation style) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '0 1.5rem',
            borderTop: '1px solid var(--border-default)',
            borderBottom: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-subtle)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            style={{
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: activeTab === 'logs' ? 600 : 500,
              color: activeTab === 'logs' ? 'var(--color-primary)' : 'var(--text-secondary)',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'logs' ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '-1px',
            }}
          >
            <MessageSquare size={14} />
            <span>Semua Percakapan</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '999px',
                backgroundColor: activeTab === 'logs' ? 'var(--color-primary-subtle, #eff6ff)' : 'var(--border-default)',
                color: activeTab === 'logs' ? 'var(--color-primary)' : 'var(--text-muted)',
              }}
            >
              {totalLogs}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('topUsers')}
            style={{
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: activeTab === 'topUsers' ? 600 : 500,
              color: activeTab === 'topUsers' ? 'var(--color-primary)' : 'var(--text-secondary)',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'topUsers' ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '-1px',
            }}
          >
            <Users size={14} />
            <span>Pengguna Paling Aktif</span>
            {analytics?.top_users?.length ? (
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  backgroundColor: activeTab === 'topUsers' ? 'var(--color-primary-subtle, #eff6ff)' : 'var(--border-default)',
                  color: activeTab === 'topUsers' ? 'var(--color-primary)' : 'var(--text-muted)',
                }}
              >
                {analytics.top_users.length}
              </span>
            ) : null}
          </button>
        </div>

        {/* ── TAB 1: SEMUA PERCAKAPAN ── */}
        {activeTab === 'logs' && (
          <>
            {/* Filter Bar */}
            <div
              style={{
                padding: '0.75rem 1.5rem',
                borderBottom: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              {/* Search */}
              <div style={{ position: 'relative', minWidth: '240px', flex: 1, maxWidth: '340px' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="text"
                  placeholder="Cari pertanyaan, user, topik..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ ...INP, paddingLeft: '32px' }}
                />
              </div>

              {/* User filter */}
              <div style={{ position: 'relative' }}>
                <select
                  value={userFilter}
                  onChange={e => {
                    setUserFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    height: '34px',
                    padding: '0 28px 0 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    fontSize: '12.5px',
                    appearance: 'none',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    minWidth: '150px',
                  }}
                >
                  <option value="all">Semua user</option>
                  {usersList.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: 'var(--text-muted)',
                  }}
                />
              </div>

              {/* Date range filter pills */}
              <div
                style={{
                  display: 'inline-flex',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  overflow: 'hidden',
                }}
              >
                {dateRangeOptions.map((opt, i) => {
                  const isA = dateRange === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setDateRange(opt.value);
                        setCurrentPage(1);
                      }}
                      style={{
                        padding: '5px 12px',
                        fontSize: '12.5px',
                        fontWeight: isA ? 600 : 400,
                        border: 'none',
                        borderLeft: i > 0 ? '1px solid var(--border-default)' : 'none',
                        backgroundColor: isA ? 'var(--bg-subtle)' : 'transparent',
                        color: isA ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Active user badge filter */}
              {userFilter !== 'all' && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-primary-subtle, #eff6ff)',
                    border: '1px solid var(--color-primary)',
                    fontSize: '12px',
                    color: 'var(--color-primary)',
                  }}
                >
                  <span>Filter: {selectedUserName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setUserFilter('all');
                      setCurrentPage(1);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--color-primary)',
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                    {['Pengguna', 'Pertanyaan & Topik', 'Jawaban AI', 'Sumber Rujukan', 'Waktu', 'Aksi'].map(
                      (h, i) => (
                        <th
                          key={h}
                          style={{
                            padding: '9px 1rem',
                            fontWeight: 600,
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            textAlign: i === 3 || i === 5 ? 'center' : 'left',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <Loader2 size={16} className="animate-spin" color="var(--color-primary)" />
                          <span>Memuat log percakapan...</span>
                        </div>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <MessageSquare size={28} style={{ margin: '0 auto 8px', display: 'block', color: 'var(--border-default)' }} />
                        <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {searchQuery || userFilter !== 'all' ? 'Tidak ada log yang cocok' : 'Belum ada percakapan tercatat'}
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                          {searchQuery || userFilter !== 'all' ? 'Coba ubah atau reset filter pencarian.' : 'Aktivitas chat pengguna akan muncul di sini.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    logs.map(log => (
                      <tr
                        key={log.id}
                        style={{ borderTop: '1px solid var(--border-subtle)', transition: 'background 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {/* Pengguna */}
                        <td style={{ padding: '10px 1rem', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <UserAvatar name={log.user_name || 'User'} size={30} />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                                {log.user_name || '-'}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {log.user_department || log.user_email || '-'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Pertanyaan & Topik */}
                        <td style={{ padding: '10px 1rem', maxWidth: '320px' }}>
                          <div
                            style={{
                              fontWeight: 500,
                              fontSize: '12.5px',
                              color: 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '300px',
                            }}
                            title={log.query_text}
                          >
                            {log.query_text || '-'}
                          </div>
                          {log.topic && (
                            <span
                              style={{
                                display: 'inline-block',
                                marginTop: '3px',
                                fontSize: '11px',
                                padding: '1px 7px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--bg-subtle)',
                                border: '1px solid var(--border-default)',
                                color: 'var(--text-secondary)',
                                maxWidth: '280px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {log.topic}
                            </span>
                          )}
                        </td>

                        {/* Jawaban AI Excerpt */}
                        <td style={{ padding: '10px 1rem', maxWidth: '280px' }}>
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--text-secondary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '260px',
                            }}
                            title={log.answer_excerpt || ''}
                          >
                            {log.answer_excerpt || <span style={{ color: 'var(--text-muted)' }}>-</span>}
                          </div>
                        </td>

                        {/* Sumber dikutip */}
                        <td style={{ padding: '10px 1rem', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: '12.5px',
                              fontWeight: 600,
                              color: (log.retrieved_count || 0) > 0 ? 'var(--color-primary)' : 'var(--text-muted)',
                            }}
                          >
                            {log.retrieved_count ?? 0}
                          </span>
                        </td>

                        {/* Waktu */}
                        <td style={{ padding: '10px 1rem', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {fmtDateShort(log.created_at)}
                        </td>

                        {/* Aksi */}
                        <td style={{ padding: '10px 1rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            title="Lihat detail percakapan"
                            onClick={() => setInspecting(log)}
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-default)',
                              background: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: 'var(--text-secondary)',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <Eye size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div
              style={{
                padding: '0.75rem 1.5rem',
                borderTop: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12.5px',
                color: 'var(--text-secondary)',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <span>
                Halaman {currentPage} / {totalPages} ({totalLogs.toLocaleString('id-ID')} percakapan)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Baris per halaman</span>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={pageSize}
                      onChange={e => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      style={{
                        height: '28px',
                        padding: '0 24px 0 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-default)',
                        fontSize: '12.5px',
                        appearance: 'none',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      {[10, 25, 50].map(n => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={11}
                      style={{
                        position: 'absolute',
                        right: '6px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                        color: 'var(--text-muted)',
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <PBtn onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                    <ChevronLeft size={13} />
                    Prev Page
                  </PBtn>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(pg => (
                    <PBtn key={pg} onClick={() => setCurrentPage(pg)} active={currentPage === pg}>
                      {pg}
                    </PBtn>
                  ))}
                  <PBtn onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                    Next Page
                    <ChevronRight size={13} />
                  </PBtn>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── TAB 2: PENGGUNA PALING AKTIF ── */}
        {activeTab === 'topUsers' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                  {['Peringkat', 'Pengguna', 'Departemen', 'Total Pertanyaan', 'Topik yang Sering Ditanyakan', 'Terakhir Aktif', 'Aksi'].map(
                    (h, i) => (
                      <th
                        key={h}
                        style={{
                          padding: '9px 1rem',
                          fontWeight: 600,
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          textAlign: i === 0 || i === 3 ? 'center' : i === 6 ? 'right' : 'left',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {isLoadingAnalytics ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <Loader2 size={16} className="animate-spin" color="var(--color-primary)" />
                        <span>Menganalisis aktivitas pengguna...</span>
                      </div>
                    </td>
                  </tr>
                ) : !analytics || analytics.top_users.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Users size={28} style={{ margin: '0 auto 8px', display: 'block', color: 'var(--border-default)' }} />
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Belum ada data aktivitas chat pengguna</p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Daftar pengguna teraktif akan diperbarui otomatis saat ada percakapan.</p>
                    </td>
                  </tr>
                ) : (
                  analytics.top_users.map((u, idx) => (
                    <tr
                      key={u.user_id || idx}
                      style={{ borderTop: '1px solid var(--border-subtle)', transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Peringkat */}
                      <td style={{ padding: '10px 1rem', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            backgroundColor: idx === 0 ? 'var(--color-primary)' : 'var(--bg-subtle)',
                            color: idx === 0 ? '#fff' : 'var(--text-secondary)',
                            border: idx === 0 ? 'none' : '1px solid var(--border-default)',
                          }}
                        >
                          {idx + 1}
                        </span>
                      </td>

                      {/* Pengguna */}
                      <td style={{ padding: '10px 1rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <UserAvatar name={u.name || 'User'} size={32} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{u.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Departemen */}
                      <td style={{ padding: '10px 1rem', fontSize: '12.5px', color: 'var(--text-primary)' }}>
                        {u.department || '-'}
                      </td>

                      {/* Total Pertanyaan */}
                      <td style={{ padding: '10px 1rem', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: 700,
                            backgroundColor: 'var(--color-primary-subtle, #eff6ff)',
                            color: 'var(--color-primary)',
                            border: '1px solid var(--border-default)',
                          }}
                        >
                          {u.total_queries} pertanyaan
                        </span>
                      </td>

                      {/* Topik yang Sering Ditanyakan */}
                      <td style={{ padding: '10px 1rem', maxWidth: '300px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {u.top_topics && u.top_topics.length > 0 ? (
                            u.top_topics.slice(0, 3).map((tp, tidx) => (
                              <span
                                key={tidx}
                                style={{
                                  fontSize: '11px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: 'var(--bg-subtle)',
                                  border: '1px solid var(--border-default)',
                                  color: 'var(--text-secondary)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {tp}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>-</span>
                          )}
                        </div>
                      </td>

                      {/* Terakhir Aktif */}
                      <td style={{ padding: '10px 1rem', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {fmtDateShort(u.last_active)}
                      </td>

                      {/* Aksi: Filter percakapan user */}
                      <td style={{ padding: '10px 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {u.user_id ? (
                          <button
                            type="button"
                            onClick={() => selectUserAndShowLogs(u.user_id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-default)',
                              backgroundColor: 'transparent',
                              fontSize: '12px',
                              fontWeight: 500,
                              color: 'var(--color-primary)',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <span>Lihat percakapan</span>
                            <ArrowRight size={12} />
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Detail Percakapan */}
      {inspecting && (
        <div style={OL} onClick={() => setInspecting(null)}>
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '640px',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '88vh',
              boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-default)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserAvatar name={inspecting.user_name || 'User'} size={36} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                    {inspecting.user_name || '-'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {inspecting.user_department ? `${inspecting.user_department} • ` : ''}
                    {fmtDate(inspecting.created_at)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspecting(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '2px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {/* Stat row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { l: 'TOPIK', v: inspecting.topic || 'Umum' },
                  { l: 'SUMBER DIKUTIP', v: String(inspecting.retrieved_count ?? 0) },
                  { l: 'SESSION ID', v: inspecting.session_id ? inspecting.session_id.slice(-8) : '-' },
                ].map(({ l, v }) => (
                  <div
                    key={l}
                    style={{
                      border: '1px solid var(--border-default)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        marginBottom: '4px',
                      }}
                    >
                      {l}
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        wordBreak: 'break-all',
                      }}
                    >
                      {v}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pertanyaan */}
              <div style={{ border: '1px solid var(--border-default)', borderRadius: '10px', overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-subtle)',
                    borderBottom: '1px solid var(--border-default)',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                    Pertanyaan Pengguna
                  </span>
                </div>
                <div style={{ padding: '14px', fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: 1.65 }}>
                  {inspecting.query_text || <span style={{ color: 'var(--text-muted)' }}>Tidak tersedia</span>}
                </div>
              </div>

              {/* Jawaban AI */}
              {inspecting.answer_excerpt && (
                <div style={{ border: '1px solid var(--border-default)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div
                    style={{
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-subtle)',
                      borderBottom: '1px solid var(--border-default)',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                      Jawaban AI
                    </span>
                    <span style={{ marginLeft: '8px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      (cuplikan)
                    </span>
                  </div>
                  <div
                    style={{
                      padding: '14px',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.7,
                      maxHeight: '220px',
                      overflowY: 'auto',
                    }}
                  >
                    <MarkdownContent content={inspecting.answer_excerpt} />
                  </div>
                </div>
              )}

              {/* Sumber dokumen */}
              {inspecting.sources_used && inspecting.sources_used.length > 0 && (
                <div style={{ border: '1px solid var(--border-default)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div
                    style={{
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-subtle)',
                      borderBottom: '1px solid var(--border-default)',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                      Sumber Dokumen yang Dikutip
                    </span>
                    <span style={{ marginLeft: '8px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      ({inspecting.sources_used.length} dokumen)
                    </span>
                  </div>
                  <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {inspecting.sources_used.map((src: any, idx: number) => {
                      const title = typeof src === 'string' ? src : (src.document_title || src.title || `Dokumen ${idx + 1}`);
                      const snippet = typeof src === 'object' ? (src.passage_snippet || src.snippet || src.text) : null;
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-default)',
                            backgroundColor: 'var(--bg-subtle)',
                            fontSize: '12.5px',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-default)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                fontWeight: 700,
                                color: 'var(--text-muted)',
                                flexShrink: 0,
                              }}
                            >
                              {idx + 1}
                            </span>
                            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {title}
                            </span>
                          </div>
                          {snippet && (
                            <div style={{ marginTop: '4px', fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '28px' }}>
                              &quot;{snippet.slice(0, 140)}...&quot;
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--border-default)',
                display: 'flex',
                justifyContent: 'flex-end',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setInspecting(null)}
                style={{
                  height: '36px',
                  padding: '0 18px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'none',
                  fontSize: '13px',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
