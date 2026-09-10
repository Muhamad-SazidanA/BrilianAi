'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Download,
  MessageSquare,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  X,
  Loader2,
  RefreshCw,
  Tag,
  Users,
  Activity,
  FileText,
  Eye,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { ChatAuditLog, AuditAnalyticsSummary, User } from '@/types/user';
import MarkdownContent from '@/components/ui/MarkdownContent';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import UserAvatar from '@/components/ui/UserAvatar';

export default function AuditLogsView() {
  const { language } = useLanguage();

  const [logs, setLogs] = useState<ChatAuditLog[]>([]);
  const [analytics, setAnalytics] = useState<AuditAnalyticsSummary | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);

  // Filters & Pagination
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<'today' | '7d' | '30d' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalLogs, setTotalLogs] = useState<number>(0);

  // Detail Modal
  const [inspectingLog, setInspectingLog] = useState<ChatAuditLog | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoadingAnalytics(true);
    try {
      const res = await fetch('/api/audit-logs/analytics');
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err: any) {
      console.warn('[AuditLogs] Failed to fetch analytics:', err);
    } finally {
      setIsLoadingAnalytics(false);
    }
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

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedUserFilter && selectedUserFilter !== 'all') params.set('userId', selectedUserFilter);
      if (selectedDateRange && selectedDateRange !== 'all') params.set('dateRange', selectedDateRange);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('page', String(currentPage));
      params.set('limit', '10');

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotalPages(data.totalPages || 1);
        setTotalLogs(data.total || 0);
      }
    } catch (err: any) {
      toast.error(
        language === 'en'
          ? 'Failed to load audit logs: ' + err.message
          : 'Gagal memuat log audit: ' + err.message
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedUserFilter, selectedDateRange, searchQuery, currentPage, language]);

  useEffect(() => {
    fetchAnalytics();
    fetchUsers();
  }, [fetchAnalytics, fetchUsers]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExportCsv = () => {
    window.open('/api/audit-logs/export', '_blank');
    toast.success(
      language === 'en'
        ? 'Downloading audit log (CSV)...'
        : 'Mengunduh berkas log audit (CSV)...'
    );
  };

  // Compute total citations in loaded logs
  const totalCitations = useMemo(() => {
    return logs.reduce((acc, l) => acc + (l.retrieved_count || 0), 0);
  }, [logs]);

  const dominantTopic =
    analytics?.top_topics && analytics.top_topics.length > 0
      ? analytics.top_topics[0].topic
      : '-';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── Spensify Stat Summary Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Card 1: Total Questions */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '1.15rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {language === 'en' ? 'Total Chat Queries' : 'Total Pertanyaan AI'}
            </span>
            <div
              style={{
                fontSize: '26px',
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginTop: '4px',
                lineHeight: 1.1,
              }}
            >
              {isLoadingAnalytics
                ? '...'
                : (analytics?.total_conversations ?? 0).toLocaleString(
                    language === 'en' ? 'en-US' : 'id-ID'
                  )}
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
              {language === 'en' ? 'Recorded AI interactions' : 'Interaksi pertanyaan tercatat'}
            </p>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-primary-subtle)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MessageSquare size={20} />
          </div>
        </div>

        {/* Card 2: Active Users */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '1.15rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {language === 'en' ? 'Active Users' : 'Pengguna Aktif'}
            </span>
            <div
              style={{
                fontSize: '26px',
                fontWeight: 800,
                color: 'var(--color-success)',
                marginTop: '4px',
                lineHeight: 1.1,
              }}
            >
              {isLoadingAnalytics
                ? '...'
                : (analytics?.total_active_users ?? 0).toLocaleString(
                    language === 'en' ? 'en-US' : 'id-ID'
                  )}
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
              {language === 'en' ? 'Accounts with queries' : 'Akun dengan riwayat chat'}
            </p>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-success-subtle)',
              color: 'var(--color-success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={20} />
          </div>
        </div>

        {/* Card 3: Dominant Topic */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '1.15rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ minWidth: 0, paddingRight: '8px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {language === 'en' ? 'Dominant Topic' : 'Topik Utama'}
            </span>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginTop: '6px',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={dominantTopic}
            >
              {isLoadingAnalytics ? '...' : dominantTopic}
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
              {language === 'en' ? 'Most queried subject' : 'Kategori paling sering ditanyakan'}
            </p>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-warning-subtle)',
              color: 'var(--color-warning)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Tag size={20} />
          </div>
        </div>

        {/* Card 4: Document Citations */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '1.15rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {language === 'en' ? 'Citations Cited' : 'Sitasi Rujukan'}
            </span>
            <div
              style={{
                fontSize: '26px',
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginTop: '4px',
                lineHeight: 1.1,
              }}
            >
              {totalCitations.toLocaleString(language === 'en' ? 'en-US' : 'id-ID')}
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
              {language === 'en' ? 'Cited page passages' : 'Halaman dokumen dirujuk AI'}
            </p>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BookOpen size={20} />
          </div>
        </div>
      </div>

      {/* ── Enterprise Activity Monitoring: Volume Pertanyaan Pengguna ── */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem 1.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={17} style={{ color: 'var(--color-primary)' }} />
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {language === 'en' ? 'User Chat Activity & Topic Distribution' : 'Volume Pertanyaan per Pengguna'}
              </h2>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              {language === 'en'
                ? 'Overview of user interaction intensity and frequently consulted topics.'
                : 'Distribusi intensitas interaksi chat seluruh pengguna dan topik bahasan yang sering dikonsultasikan.'}
            </p>
          </div>

          {selectedUserFilter !== 'all' && (
            <button
              onClick={() => {
                setSelectedUserFilter('all');
                setCurrentPage(1);
              }}
              className="btn btn-outline btn-sm"
              style={{ fontSize: '12px', padding: '4px 10px' }}
            >
              <X size={13} />
              <span>{language === 'en' ? 'Reset User Filter' : 'Reset Filter Pengguna'}</span>
            </button>
          )}
        </div>

        {isLoadingAnalytics ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div
              className="animate-spin"
              style={{
                width: '22px',
                height: '22px',
                border: '2px solid var(--border-default)',
                borderTopColor: 'var(--color-primary)',
                borderRadius: '50%',
                margin: '0 auto 8px',
              }}
            />
            <span style={{ fontSize: '12.5px' }}>
              {language === 'en' ? 'Loading activity...' : 'Memuat data aktivitas...'}
            </span>
          </div>
        ) : !analytics || analytics.top_users.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            {language === 'en'
              ? 'No user chat interactions recorded yet.'
              : 'Belum ada data aktivitas percakapan pengguna.'}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
            }}
          >
            {analytics.top_users.map((u) => {
              const isFiltered = selectedUserFilter === u.user_id;

              return (
                <div
                  key={u.user_id}
                  style={{
                    backgroundColor: isFiltered ? 'var(--color-primary-subtle)' : 'var(--bg-subtle)',
                    border: `1px solid ${isFiltered ? 'var(--color-primary)' : 'var(--border-default)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <UserAvatar name={u.name} size={36} />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '13.5px',
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {u.name}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {u.department || 'General'} · {u.role_name || 'Member'}
                        </div>
                      </div>
                    </div>

                    <span className="badge badge-accent font-mono" style={{ flexShrink: 0 }}>
                      {u.total_queries} {language === 'en' ? 'queries' : 'pertanyaan'}
                    </span>
                  </div>

                  {/* Frequent Topics */}
                  {u.top_topics && u.top_topics.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {u.top_topics.map((tp, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: '11px',
                            padding: '2px 7px',
                            borderRadius: 'var(--radius-xs)',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)',
                            fontWeight: 500,
                          }}
                        >
                          {tp}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Filter Action */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: '2px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserFilter(isFiltered ? 'all' : u.user_id);
                        setCurrentPage(1);
                      }}
                      className={`btn btn-sm ${isFiltered ? 'btn-primary' : 'btn-outline'}`}
                      style={{ fontSize: '12px', padding: '4px 10px' }}
                    >
                      <span>
                        {isFiltered
                          ? language === 'en'
                            ? 'Active Filter'
                            : 'Aktif Difilter'
                          : language === 'en'
                          ? 'Filter Logs'
                          : 'Filter Log Pengguna'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Spensify Single Unified Card Container ("Riwayat Log Percakapan") ── */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Card Header with Spensify TableCardHeading */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {language === 'en' ? 'Chat Audit Log Records' : 'Riwayat Log Percakapan'}
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              {language === 'en'
                ? 'Detailed historical queries, conversation context, and verified document citations.'
                : 'Seluruh rekaman interaksi pengguna ke AI Chatbot beserta kutipan dokumen yang dirujuk.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleExportCsv}
              className="btn btn-outline btn-sm"
              title={language === 'en' ? 'Export CSV' : 'Ekspor CSV'}
            >
              <Download size={14} />
              <span>{language === 'en' ? 'Export CSV' : 'Ekspor CSV'}</span>
            </button>
            <button
              type="button"
              onClick={fetchLogs}
              disabled={isLoading}
              className="btn btn-outline btn-sm"
              title={language === 'en' ? 'Refresh' : 'Perbarui'}
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{language === 'en' ? 'Refresh' : 'Perbarui'}</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar (Spensify style) */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderBottom: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Search box */}
          <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '360px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder={language === 'en' ? 'Search query or keyword...' : 'Cari teks pertanyaan...'}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="input-text"
              style={{
                paddingLeft: '36px',
                height: '36px',
                fontSize: '13px',
                borderRadius: 'var(--radius-sm)',
              }}
            />
          </div>

          {/* Filters right group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* User Select Filter */}
            <select
              value={selectedUserFilter}
              onChange={(e) => {
                setSelectedUserFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="input-text"
              style={{
                height: '36px',
                fontSize: '13px',
                borderRadius: 'var(--radius-sm)',
                padding: '0 10px',
                minWidth: '160px',
              }}
            >
              <option value="all">{language === 'en' ? 'All Users' : 'Semua Pengguna'}</option>
              {usersList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.department || 'General'})
                </option>
              ))}
            </select>

            {/* Date Range Selector Pills */}
            <div
              style={{
                display: 'inline-flex',
                backgroundColor: 'var(--bg-subtle)',
                padding: '2px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
              }}
            >
              {(['all', 'today', '7d', '30d'] as const).map((rng) => {
                const label =
                  rng === 'all'
                    ? language === 'en'
                      ? 'All'
                      : 'Semua'
                    : rng === 'today'
                    ? language === 'en'
                      ? 'Today'
                      : 'Hari Ini'
                    : rng === '7d'
                    ? language === 'en'
                      ? '7 Days'
                      : '7 Hari'
                    : language === 'en'
                    ? '30 Days'
                    : '30 Hari';

                const isSelected = selectedDateRange === rng;

                return (
                  <button
                    key={rng}
                    type="button"
                    onClick={() => {
                      setSelectedDateRange(rng);
                      setCurrentPage(1);
                    }}
                    style={{
                      border: 'none',
                      backgroundColor: isSelected ? 'var(--bg-card)' : 'transparent',
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      boxShadow: isSelected ? 'var(--shadow-xs)' : 'none',
                      borderRadius: 'var(--radius-xs)',
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Table Content (Spensify style) ── */}
        {isLoading ? (
          <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div
              className="animate-spin"
              style={{
                width: '26px',
                height: '26px',
                border: '2px solid var(--border-default)',
                borderTopColor: 'var(--color-primary)',
                borderRadius: '50%',
                margin: '0 auto 12px',
              }}
            />
            <p style={{ fontSize: '13.5px', fontWeight: 500 }}>
              {language === 'en' ? 'Loading audit records...' : 'Memuat rekaman log audit...'}
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                color: 'var(--text-muted)',
              }}
            >
              <MessageSquare size={24} />
            </div>
            <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
              {searchQuery
                ? language === 'en'
                  ? 'No matching logs found'
                  : 'Tidak ada log yang cocok'
                : language === 'en'
                ? 'No audit records found'
                : 'Belum ada rekaman log audit'}
            </p>
            <p style={{ fontSize: '13px', marginTop: '4px', maxWidth: '340px', margin: '4px auto 0' }}>
              {language === 'en'
                ? 'Try adjusting your filters or date range.'
                : 'Coba sesuaikan kata kunci pencarian atau rentang waktu.'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ padding: '12px 1.5rem', width: '16%' }}>
                    {language === 'en' ? 'Timestamp' : 'Waktu'}
                  </th>
                  <th style={{ padding: '12px 1rem', width: '20%' }}>
                    {language === 'en' ? 'User' : 'Pengguna'}
                  </th>
                  <th style={{ padding: '12px 1rem', width: '16%' }}>
                    {language === 'en' ? 'Topic' : 'Topik Bahasan'}
                  </th>
                  <th style={{ padding: '12px 1rem' }}>
                    {language === 'en' ? 'Question' : 'Pertanyaan'}
                  </th>
                  <th style={{ padding: '12px 1rem', width: '12%' }}>
                    {language === 'en' ? 'Sources' : 'Rujukan'}
                  </th>
                  <th style={{ padding: '12px 1.5rem', textAlign: 'right', width: '10%' }}>
                    {language === 'en' ? 'Action' : 'Aksi'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const formattedDate = new Date(log.created_at).toLocaleDateString(
                    language === 'en' ? 'en-US' : 'id-ID',
                    {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }
                  );

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background-color 0.15s ease',
                      }}
                      className="hover:bg-subtle"
                    >
                      {/* Timestamp */}
                      <td style={{ padding: '13px 1.5rem', color: 'var(--text-secondary)', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                        {formattedDate}
                      </td>

                      {/* User Avatar + Name */}
                      <td style={{ padding: '13px 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <UserAvatar name={log.user_name} size={28} />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: '13px',
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {log.user_name || 'Anonymous'}
                            </div>
                            <div
                              style={{
                                fontSize: '11.5px',
                                color: 'var(--text-muted)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {log.user_department || 'General'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Topic */}
                      <td style={{ padding: '13px 1rem' }}>
                        <span className="badge badge-neutral" style={{ fontSize: '11.5px' }}>
                          {log.topic || (language === 'en' ? 'General' : 'Umum')}
                        </span>
                      </td>

                      {/* Question Text */}
                      <td style={{ padding: '13px 1rem', maxWidth: '340px' }}>
                        <div
                          style={{
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={log.query_text}
                        >
                          {log.query_text}
                        </div>
                      </td>

                      {/* Cited Sources */}
                      <td style={{ padding: '13px 1rem' }}>
                        {log.retrieved_count > 0 ? (
                          <span className="badge badge-accent font-mono" style={{ fontSize: '11.5px' }}>
                            {log.retrieved_count} {language === 'en' ? 'sources' : 'sumber'}
                          </span>
                        ) : (
                          <span className="badge badge-neutral" style={{ fontSize: '11.5px' }}>
                            {language === 'en' ? 'Direct' : 'Langsung'}
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '13px 1.5rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => setInspectingLog(log)}
                          className="btn btn-outline btn-sm"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          title={language === 'en' ? 'View Details' : 'Lihat Detail'}
                        >
                          <Eye size={13} />
                          <span>{language === 'en' ? 'Detail' : 'Detail'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Spensify Card Footer with Pagination */}
        <div
          style={{
            padding: '12px 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-subtle)',
          }}
        >
          <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            {language === 'en'
              ? `Showing page ${currentPage} of ${totalPages} (${totalLogs} records)`
              : `Halaman ${currentPage} dari ${totalPages} (Total ${totalLogs} rekaman)`}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="btn btn-outline btn-sm"
              style={{ padding: '4px 8px' }}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <span
              style={{
                fontSize: '12.5px',
                fontWeight: 600,
                padding: '0 8px',
                color: 'var(--text-primary)',
              }}
            >
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="btn btn-outline btn-sm"
              style={{ padding: '4px 8px' }}
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Spensify Detail Inspection Modal Dialog ── */}
      {inspectingLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.5rem',
          }}
          onClick={() => setInspectingLog(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              maxWidth: '740px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-xl)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {language === 'en' ? 'Audit Log Record Details' : 'Detail Rekaman Log Audit'}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {new Date(inspectingLog.created_at).toLocaleString(
                    language === 'en' ? 'en-US' : 'id-ID'
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '6px' }}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* User Metadata Strip */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: 'var(--bg-subtle)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <UserAvatar name={inspectingLog.user_name} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {inspectingLog.user_name || 'Anonymous'}{' '}
                    <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-secondary)' }}>
                      ({inspectingLog.user_email || '-'})
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {inspectingLog.user_department || 'General'} · Topik: {inspectingLog.topic || 'Umum'}
                  </div>
                </div>
              </div>

              {/* User Question */}
              <div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {language === 'en' ? 'User Question' : 'Pertanyaan Pengguna'}
                </span>
                <div
                  style={{
                    marginTop: '6px',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px',
                    fontSize: '13.5px',
                    color: 'var(--text-primary)',
                    lineHeight: '1.5',
                  }}
                >
                  {inspectingLog.query_text}
                </div>
              </div>

              {/* AI Answer */}
              <div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {language === 'en' ? 'AI Response Excerpt' : 'Kutipan Jawaban AI'}
                </span>
                <div
                  style={{
                    marginTop: '6px',
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px',
                    fontSize: '13.5px',
                    color: 'var(--text-primary)',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    lineHeight: '1.6',
                  }}
                >
                  <MarkdownContent content={inspectingLog.answer_excerpt || (language === 'en' ? 'No response text recorded.' : 'Tidak ada rekaman teks jawaban.')} />
                </div>
              </div>

              {/* Cited Documents / Sources */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {language === 'en' ? 'Cited Document Passages' : 'Kutipan Sumber Rujukan'}
                  </span>
                  <span className="badge badge-neutral font-mono" style={{ fontSize: '11px' }}>
                    {inspectingLog.sources_used?.length || 0} {language === 'en' ? 'passages' : 'kutipan'}
                  </span>
                </div>

                {!inspectingLog.sources_used || inspectingLog.sources_used.length === 0 ? (
                  <div
                    style={{
                      padding: '1rem',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12.5px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {language === 'en'
                      ? 'No document passages were directly retrieved for this conversation.'
                      : 'Pertanyaan ini dijawab langsung tanpa sitasi spesifik kutipan dokumen.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                    {inspectingLog.sources_used.map((c: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: 'var(--bg-subtle)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 12px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '4px',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            <FileText size={13} style={{ color: 'var(--color-primary)' }} />
                            <span
                              style={{
                                fontSize: '12.5px',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {c.document_title || c.title || 'Dokumen'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            {c.page_number && (
                              <span className="badge badge-outline" style={{ fontSize: '10.5px' }}>
                                Hal. {c.page_number}
                              </span>
                            )}
                            {c.similarity_score && (
                              <span className="badge badge-accent font-mono" style={{ fontSize: '10.5px' }}>
                                Match {(c.similarity_score * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>

                        {(c.passage_snippet || c.snippet || c.text) && (
                          <p
                            style={{
                              fontSize: '12px',
                              color: 'var(--text-secondary)',
                              lineHeight: '16px',
                              margin: '4px 0 0',
                              fontStyle: 'italic',
                            }}
                          >
                            &quot;{c.passage_snippet || c.snippet || c.text}&quot;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 1.5rem',
                borderTop: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="btn btn-outline btn-sm"
              >
                {language === 'en' ? 'Close' : 'Tutup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
