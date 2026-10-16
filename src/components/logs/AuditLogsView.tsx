'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, Download, X, Loader2, Eye,
  MessageSquare, Users, ArrowRight, Clock, FileText,
} from 'lucide-react';
import { ChatAuditLog, AuditAnalyticsSummary, User } from '@/types/user';
import MarkdownContent from '@/components/ui/MarkdownContent';
import { toast } from 'sonner';
import UserAvatar from '@/components/ui/UserAvatar';
import EnterprisePageHeader from '@/components/layout/EnterprisePageHeader';
import DashboardMetricCard from '@/components/dashboard/DashboardMetricCard';
import EnterprisePagination from '@/components/ui/EnterprisePagination';
import EnterpriseSelect, { EnterpriseSelectOption } from '@/components/ui/EnterpriseSelect';
import { useLanguage } from '@/context/LanguageContext';

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

function fmtDateShort(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function IBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
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
        color: 'var(--text-secondary)',
        transition: 'all 0.12s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)';
        e.currentTarget.style.borderColor = 'var(--border-hover, #cbd5e1)';
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

export default function AuditLogsView() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'logs' | 'topUsers'>('logs');
  const [logs, setLogs] = useState<ChatAuditLog[]>([]);
  const [analytics, setAnalytics] = useState<AuditAnalyticsSummary | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const [syncTime, setSyncTime] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [inspecting, setInspecting] = useState<ChatAuditLog | null>(null);

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
  }, [logs, analytics, activeTab]);

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
        const d = new Date();
        setSyncTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
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

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchLogs(), fetchAnalytics(), fetchUsers()]);
  }, [fetchLogs, fetchAnalytics, fetchUsers]);

  const handleExport = () => {
    window.open('/api/audit-logs/export', '_blank');
    toast.success('Mengunduh log audit percakapan (CSV)...');
  };

  const selectUserAndShowLogs = (userId: string) => {
    setUserFilter(userId);
    setActiveTab('logs');
    setCurrentPage(1);
  };

  const userSelectOptions: EnterpriseSelectOption[] = useMemo(() => {
    return [
      { value: 'all', label: language === 'en' ? 'All Users' : 'Semua User' },
      ...usersList.map((u) => ({
        value: u.id,
        label: u.name,
        sublabel: u.department || u.email,
      })),
    ];
  }, [usersList, language]);

  const dateRangeSelectOptions: EnterpriseSelectOption[] = [
    { value: 'all', label: language === 'en' ? 'All Time' : 'Semua Waktu' },
    { value: 'today', label: language === 'en' ? 'Today' : 'Hari Ini' },
    { value: '7d', label: language === 'en' ? 'Last 7 Days' : '7 Hari Terakhir' },
    { value: '30d', label: language === 'en' ? 'Last 30 Days' : '30 Hari Terakhir' },
  ];

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
        title={language === 'en' ? 'Chat Audit Logs' : 'Audit Log Percakapan'}
        subtitle={
          language === 'en'
            ? 'Enterprise query volume monitoring, topic analysis, and cited document inspection.'
            : 'Monitoring volume pertanyaan pengguna, analisis topik bahasan, dan audit rujukan dokumen AI.'
        }
        syncTime={syncTime}
        onRefresh={refreshAll}
        isLoading={isLoading || isLoadingAnalytics}
        actions={
          <button
            type="button"
            onClick={handleExport}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '28px',
              padding: '0 12px',
              fontSize: '11.5px',
              fontWeight: 500,
              letterSpacing: '-0.01em',
              color: 'var(--text-primary)',
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-default, #e2e8f0)',
              borderRadius: '9999px',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              transition: 'all 0.15s ease',
            }}
          >
            <Download size={12} strokeWidth={2.2} />
            <span>{language === 'en' ? 'Export CSV' : 'Ekspor CSV'}</span>
          </button>
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
            title={language === 'en' ? 'Total Sessions' : 'Total Percakapan'}
            value={`${totalLogs.toLocaleString('id-ID')} Sesi`}
            badge="KMS Audit"
            badgeType="neutral"
            footerText={language === 'en' ? 'Interactions logged' : 'Riwayat dialog interaktif AI'}
            isLoading={isLoading}
            onClick={() => setActiveTab('logs')}
          />

          <DashboardMetricCard
            title={language === 'en' ? 'Active Users' : 'Pengguna Aktif'}
            value={`${analytics?.total_active_users ?? (analytics?.top_users?.length ?? 0)} Pengguna`}
            badge="Active"
            badgeType="neutral"
            statusDot="live"
            footerText={language === 'en' ? 'Submitted AI queries' : 'Mengajukan pertanyaan AI'}
            isLoading={isLoadingAnalytics}
            onClick={() => setActiveTab('topUsers')}
          />

          <DashboardMetricCard
            title={language === 'en' ? 'Discovered Topics' : 'Klaster Topik'}
            value={`${analytics?.top_topics?.length || 0} Topik`}
            badge="NLP"
            badgeType="neutral"
            footerText={language === 'en' ? 'Dominant intent clusters' : 'Distribusi domain bahasan'}
            isLoading={isLoadingAnalytics}
          />

          <DashboardMetricCard
            title={language === 'en' ? 'Top Contributor' : 'Pengguna Teraktif'}
            value={
              analytics?.top_users?.[0]?.name
                ? `${analytics.top_users[0].name.split(' ')[0]} (${analytics.top_users[0].total_queries})`
                : '—'
            }
            badge="Leaderboard"
            badgeType="neutral"
            statusDot="blue"
            footerText={language === 'en' ? 'Most queries submitted' : 'Aktivitas dialog AI tertinggi'}
            isLoading={isLoadingAnalytics}
            onClick={() => setActiveTab('topUsers')}
          />
        </div>
      </div>

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
          {/* Left: Tab Switcher (Smooth Pill Style) */}
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
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              style={{
                borderRadius: '9999px',
                padding: '2px 10px',
                fontSize: '11px',
                height: '22px',
                fontWeight: activeTab === 'logs' ? 600 : 500,
                border: 'none',
                backgroundColor: activeTab === 'logs' ? 'var(--bg-card, #ffffff)' : 'transparent',
                color: activeTab === 'logs' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: activeTab === 'logs' ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <MessageSquare size={12} />
              <span>{language === 'en' ? 'All Conversations' : 'Semua Percakapan'}</span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '0 5px',
                  borderRadius: '9999px',
                  backgroundColor: activeTab === 'logs' ? 'var(--bg-subtle, #f1f5f9)' : 'rgba(0,0,0,0.05)',
                  color: 'var(--text-muted)',
                }}
              >
                {totalLogs}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('topUsers')}
              style={{
                borderRadius: '9999px',
                padding: '2px 10px',
                fontSize: '11px',
                height: '22px',
                fontWeight: activeTab === 'topUsers' ? 600 : 500,
                border: 'none',
                backgroundColor: activeTab === 'topUsers' ? 'var(--bg-card, #ffffff)' : 'transparent',
                color: activeTab === 'topUsers' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: activeTab === 'topUsers' ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Users size={12} />
              <span>{language === 'en' ? 'Top Users' : 'Pengguna Teraktif'}</span>
              {analytics?.top_users?.length ? (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '0 5px',
                    borderRadius: '9999px',
                    backgroundColor: activeTab === 'topUsers' ? 'var(--bg-subtle, #f1f5f9)' : 'rgba(0,0,0,0.05)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {analytics.top_users.length}
                </span>
              ) : null}
            </button>
          </div>

          {/* Right: Controls (Search + User Filter + Date Filter) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {activeTab === 'logs' && (
              <>
                {/* Search Box */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'var(--bg-subtle, #f8fafc)',
                    border: '1px solid var(--border-default, #e2e8f0)',
                    borderRadius: '9999px',
                    padding: '0 8px 0 10px',
                    height: '26px',
                    width: '210px',
                    gap: '6px',
                  }}
                >
                  <Search size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder={language === 'en' ? 'Search query, user...' : 'Cari pertanyaan, user...'}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
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

                {/* User Dropdown Filter */}
                <div style={{ width: '150px' }}>
                  <EnterpriseSelect
                    value={userFilter}
                    onChange={(val) => {
                      setUserFilter(String(val));
                      setCurrentPage(1);
                    }}
                    options={userSelectOptions}
                    size="xs"
                    variant="pill"
                    direction="auto"
                    searchable={usersList.length > 5}
                  />
                </div>

                {/* Date Range Dropdown Filter */}
                <div style={{ width: '130px' }}>
                  <EnterpriseSelect
                    value={dateRange}
                    onChange={(val) => {
                      setDateRange(val);
                      setCurrentPage(1);
                    }}
                    options={dateRangeSelectOptions}
                    size="xs"
                    variant="pill"
                    direction="auto"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── TAB 1: SEMUA PERCAKAPAN ── */}
        {activeTab === 'logs' && (
          <>
            <div className="enterprise-table-wrapper">
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12.5px' }}>
                <thead>
                  <tr>
                    {[
                      { label: 'Pengguna', width: '22%' },
                      { label: 'Pertanyaan & Topik', width: '38%' },
                      { label: 'Cuplikan Jawaban AI', width: '24%' },
                      { label: 'Rujukan', width: '8%', align: 'center' },
                      { label: 'Waktu', width: '8%' },
                      { label: 'Aksi', width: '6%', align: 'right' },
                    ].map((col) => (
                      <th
                        key={col.label}
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
                          textAlign: (col.align as any) || 'left',
                          width: col.width,
                          whiteSpace: 'nowrap',
                          borderBottom: '1px solid var(--border-default, #e2e8f0)',
                          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                        }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
                          <Loader2 size={16} className="animate-spin" color="var(--color-primary, #2563eb)" />
                          <span>Memuat log percakapan...</span>
                        </div>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <MessageSquare size={24} style={{ margin: '0 auto 6px', display: 'block', color: 'var(--border-default)' }} />
                        <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                          {searchQuery || userFilter !== 'all' ? 'Tidak ada percakapan yang cocok' : 'Belum ada percakapan tercatat'}
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: '11.5px' }}>
                          {searchQuery || userFilter !== 'all' ? 'Coba ubah atau reset filter pencarian.' : 'Aktivitas dialog AI akan tercatat otomatis di sini.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr
                        key={log.id}
                        style={{
                          borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                          transition: 'background 0.12s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {/* Pengguna */}
                        <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <UserAvatar name={log.user_name || 'User'} size={28} />
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: '12px',
                                  color: 'var(--text-primary)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {log.user_name || 'Anonim'}
                              </div>
                              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                                {log.user_department || '—'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Pertanyaan & Topik */}
                        <td style={{ padding: '9px 14px' }}>
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: 500,
                              color: 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '380px',
                            }}
                            title={log.query_text}
                          >
                            {log.query_text}
                          </div>
                          {log.topic && (
                            <span
                              style={{
                                display: 'inline-block',
                                marginTop: '3px',
                                fontSize: '10px',
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-default, #e2e8f0)',
                              }}
                            >
                              {log.topic}
                            </span>
                          )}
                        </td>

                        {/* Jawaban AI Excerpt */}
                        <td style={{ padding: '9px 14px' }}>
                          <div
                            style={{
                              fontSize: '11.5px',
                              color: 'var(--text-secondary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '280px',
                            }}
                            title={log.answer_excerpt || ''}
                          >
                            {log.answer_excerpt || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </div>
                        </td>

                        {/* Rujukan Dikutip */}
                        <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 600,
                              fontFamily: 'var(--font-mono, monospace)',
                              color: (log.retrieved_count || 0) > 0 ? '#2563eb' : 'var(--text-muted)',
                            }}
                          >
                            {log.retrieved_count ?? 0}
                          </span>
                        </td>

                        {/* Waktu */}
                        <td style={{ padding: '9px 14px', fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {fmtDateShort(log.created_at)}
                        </td>

                        {/* Aksi */}
                        <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                          <IBtn title="Lihat detail percakapan" onClick={() => setInspecting(log)}>
                            <Eye size={12} />
                          </IBtn>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <EnterprisePagination
              currentPage={currentPage}
              totalItems={totalLogs}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              language={language}
            />
          </>
        )}

        {/* ── TAB 2: PENGGUNA PALING AKTIF ── */}
        {activeTab === 'topUsers' && (
          <div className="enterprise-table-wrapper">
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12.5px' }}>
              <thead>
                <tr>
                  {[
                    { label: 'Peringkat', width: '8%', align: 'center' },
                    { label: 'Pengguna', width: '28%' },
                    { label: 'Departemen', width: '18%' },
                    { label: 'Total Pertanyaan', width: '16%', align: 'center' },
                    { label: 'Topik Dominan', width: '22%' },
                    { label: 'Aksi', width: '8%', align: 'right' },
                  ].map((col) => (
                    <th
                      key={col.label}
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
                        textAlign: (col.align as any) || 'left',
                        width: col.width,
                        whiteSpace: 'nowrap',
                        borderBottom: '1px solid var(--border-default, #e2e8f0)',
                        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoadingAnalytics ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
                        <Loader2 size={16} className="animate-spin" color="var(--color-primary, #2563eb)" />
                        <span>Menganalisis aktivitas pengguna...</span>
                      </div>
                    </td>
                  </tr>
                ) : !analytics || analytics.top_users.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Users size={24} style={{ margin: '0 auto 6px', display: 'block', color: 'var(--border-default)' }} />
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                        Belum ada aktivitas chat pengguna
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '11.5px' }}>
                        Daftar pengguna teraktif akan diperbarui otomatis saat ada percakapan baru.
                      </p>
                    </td>
                  </tr>
                ) : (
                  analytics.top_users.map((u, idx) => (
                    <tr
                      key={u.user_id || idx}
                      style={{
                        borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Peringkat */}
                      <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: idx === 0 ? '#2563eb' : 'var(--bg-subtle, #f1f5f9)',
                            color: idx === 0 ? '#ffffff' : 'var(--text-secondary)',
                            border: idx === 0 ? 'none' : '1px solid var(--border-default, #e2e8f0)',
                          }}
                        >
                          {idx + 1}
                        </span>
                      </td>

                      {/* Pengguna */}
                      <td style={{ padding: '9px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <UserAvatar name={u.name || 'User'} size={28} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-primary)' }}>
                              {u.name}
                            </div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Departemen */}
                      <td style={{ padding: '9px 14px', fontSize: '12px', color: 'var(--text-primary)' }}>
                        {u.department || '—'}
                      </td>

                      {/* Total Pertanyaan */}
                      <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            fontFamily: 'var(--font-mono, monospace)',
                            backgroundColor: 'rgba(37, 99, 235, 0.08)',
                            color: '#2563eb',
                            border: '1px solid rgba(37, 99, 235, 0.18)',
                          }}
                        >
                          {u.total_queries} query
                        </span>
                      </td>

                      {/* Topik Dominan */}
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {u.top_topics && u.top_topics.length > 0 ? (
                            u.top_topics.slice(0, 2).map((tp, tidx) => (
                              <span
                                key={tidx}
                                style={{
                                  fontSize: '10.5px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                                  border: '1px solid var(--border-default, #e2e8f0)',
                                  color: 'var(--text-secondary)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {tp}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </div>
                      </td>

                      {/* Aksi */}
                      <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {u.user_id ? (
                          <button
                            type="button"
                            onClick={() => selectUserAndShowLogs(u.user_id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '9999px',
                              border: '1px solid var(--border-default, #e2e8f0)',
                              backgroundColor: 'var(--bg-card, #ffffff)',
                              fontSize: '11px',
                              fontWeight: 500,
                              color: '#2563eb',
                              cursor: 'pointer',
                              transition: 'all 0.12s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)')}
                          >
                            <span>Lihat Log</span>
                            <ArrowRight size={10} />
                          </button>
                        ) : (
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>—</span>
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

      {/* ════ MODAL: Detail Percakapan ════ */}
      {inspecting && (
        <div style={OL} onClick={() => setInspecting(null)}>
          <div
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-default, #e2e8f0)',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '640px',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '88vh',
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.16)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.15rem 1.4rem',
                borderBottom: '1px solid var(--border-default, #e2e8f0)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserAvatar name={inspecting.user_name || 'User'} size={34} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                    {inspecting.user_name || 'Anonim'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {inspecting.user_department ? `${inspecting.user_department} • ` : ''}
                    {fmtDate(inspecting.created_at)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspecting(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1.15rem 1.4rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {/* Stat Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { l: 'TOPIK', v: inspecting.topic || 'Umum' },
                  { l: 'SUMBER DIKUTIP', v: `${inspecting.retrieved_count ?? 0} Dokumen` },
                  { l: 'SESSION ID', v: inspecting.session_id ? inspecting.session_id.slice(-8) : '—' },
                ].map(({ l, v }) => (
                  <div
                    key={l}
                    style={{
                      border: '1px solid var(--border-default, #e2e8f0)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      backgroundColor: 'var(--bg-subtle, #f8fafc)',
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
                        fontSize: '12px',
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

              {/* Pertanyaan */}
              <div
                style={{
                  border: '1px solid var(--border-default, #e2e8f0)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-subtle, #f8fafc)',
                    borderBottom: '1px solid var(--border-default, #e2e8f0)',
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>
                    Pertanyaan Pengguna
                  </span>
                </div>
                <div style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  {inspecting.query_text || <span style={{ color: 'var(--text-muted)' }}>Tidak tersedia</span>}
                </div>
              </div>

              {/* Jawaban AI */}
              {inspecting.answer_excerpt && (
                <div
                  style={{
                    border: '1px solid var(--border-default, #e2e8f0)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-subtle, #f8fafc)',
                      borderBottom: '1px solid var(--border-default, #e2e8f0)',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>
                      Jawaban AI (RAG Inference)
                    </span>
                  </div>
                  <div
                    style={{
                      padding: '12px',
                      fontSize: '12.5px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.65,
                      maxHeight: '220px',
                      overflowY: 'auto',
                    }}
                  >
                    <MarkdownContent content={inspecting.answer_excerpt} />
                  </div>
                </div>
              )}

              {/* Sumber Dokumen */}
              {inspecting.sources_used && inspecting.sources_used.length > 0 && (
                <div
                  style={{
                    border: '1px solid var(--border-default, #e2e8f0)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-subtle, #f8fafc)',
                      borderBottom: '1px solid var(--border-default, #e2e8f0)',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>
                      Sumber Dokumen Rujukan ({inspecting.sources_used.length})
                    </span>
                  </div>
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {inspecting.sources_used.map((src: any, idx: number) => {
                      const title =
                        typeof src === 'string'
                          ? src
                          : src.document_title || src.title || `Dokumen ${idx + 1}`;
                      const snippet =
                        typeof src === 'object'
                          ? src.passage_snippet || src.snippet || src.text
                          : null;
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-default, #e2e8f0)',
                            backgroundColor: 'var(--bg-subtle, #f8fafc)',
                            fontSize: '12px',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileText size={12} color="#2563eb" style={{ flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {title}
                            </span>
                          </div>
                          {snippet && (
                            <div style={{ marginTop: '3px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '18px' }}>
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
                padding: '0.85rem 1.4rem',
                borderTop: '1px solid var(--border-default, #e2e8f0)',
                display: 'flex',
                justifyContent: 'flex-end',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setInspecting(null)}
                style={{
                  height: '28px',
                  padding: '0 16px',
                  borderRadius: '9999px',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  fontSize: '12px',
                  fontWeight: 500,
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
