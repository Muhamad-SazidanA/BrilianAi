'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  FileQuestion,
  Search,
  CheckCircle2,
  Building2,
  MessageSquare,
  RefreshCw,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import EnterprisePageHeader from '@/components/layout/EnterprisePageHeader';
import DashboardMetricCard from '@/components/dashboard/DashboardMetricCard';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
import { toast } from 'sonner';

interface KnowledgeGapItem {
  id: string | number;
  query_text: string;
  user_id?: string | null;
  division_id?: string;
  frequency: number;
  status: 'open' | 'in_progress' | 'resolved' | 'ignored';
  resolved_by?: string | null;
  resolution_note?: string | null;
  created_at: string;
  updated_at: string;
}

interface GapStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
}

export default function KnowledgeGapsPage() {
  const { language } = useLanguage();
  const { currentUser, hasPermission } = useUserSession();

  const [gaps, setGaps] = useState<KnowledgeGapItem[]>([]);
  const [stats, setStats] = useState<GapStats>({ total: 0, open: 0, inProgress: 0, resolved: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [syncTime, setSyncTime] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'open' | 'in_progress' | 'resolved' | 'all'>('open');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modal resolution state
  const [resolvingGap, setResolvingGap] = useState<KnowledgeGapItem | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const fetchGaps = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/knowledge-gaps?status=${statusFilter}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setGaps(data.gaps || []);
        if (data.stats) setStats(data.stats);
        const d = new Date();
        setSyncTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (err) {
      console.error('Error fetching knowledge gaps:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGaps();
  }, [statusFilter]);

  const handleOpenResolveModal = (gap: KnowledgeGapItem) => {
    setResolvingGap(gap);
    setResolutionNote('');
  };

  const handleConfirmResolve = async () => {
    if (!resolvingGap) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/knowledge-gaps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: resolvingGap.id,
          status: 'resolved',
          resolutionNote: resolutionNote.trim() || 'Dokumen atau SOP pelengkap telah diindeks ke sistem.',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menyelesaikan kesenjangan pengetahuan');
      }

      toast.success(
        language === 'en'
          ? 'Knowledge gap marked as resolved'
          : 'Kesenjangan pengetahuan berhasil ditandai selesai'
      );
      setResolvingGap(null);
      await fetchGaps();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan perubahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredGaps = useMemo(() => {
    return gaps.filter((g) => {
      const matchQuery = (g.query_text || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchDivision = (g.division_id || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchQuery || matchDivision;
    });
  }, [gaps, searchQuery]);

  return (
    <AppShell requiredPermission="documents:read">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          padding: '0 0.25rem 3.5rem',
        }}
      >
        {/* Enterprise Page Header */}
        <EnterprisePageHeader
          title={language === 'en' ? 'Knowledge Gaps' : 'Kesenjangan Pengetahuan'}
          subtitle={
            language === 'en'
              ? 'Track unanswered queries and user feedback to enrich organizational KMS.'
              : 'Lacak pertanyaan tanpa rujukan dan lengkapi repositori SOP organisasi.'
          }
          syncTime={syncTime}
          onRefresh={fetchGaps}
          isLoading={isLoading}
        />

        {/* 4 Pure Enterprise Metric Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '0.85rem',
          }}
        >
          <DashboardMetricCard
            title={language === 'en' ? 'Open Gaps' : 'Kesenjangan Terbuka'}
            value={`${stats.open} Isu`}
            badge="Open"
            badgeType="warning"
            statusDot="live"
            footerText={language === 'en' ? 'Requires new SOP reference' : 'Memerlukan dokumen SOP baru'}
            isLoading={isLoading}
            onClick={() => setStatusFilter('open')}
          />

          <DashboardMetricCard
            title={language === 'en' ? 'In Progress' : 'Sedang Ditangani'}
            value={`${stats.inProgress} Proses`}
            badge="In Progress"
            badgeType="accent"
            statusDot="live"
            footerText={language === 'en' ? 'Under SME curation' : 'Dalam proses kurasi tim SME'}
            isLoading={isLoading}
            onClick={() => setStatusFilter('in_progress')}
          />

          <DashboardMetricCard
            title={language === 'en' ? 'Resolved' : 'Telah Diselesaikan'}
            value={`${stats.resolved} Selesai`}
            badge="Resolved"
            badgeType="success"
            footerText={language === 'en' ? 'SOP indexed to RAG' : 'Dokumen rujukan terunggah'}
            isLoading={isLoading}
            onClick={() => setStatusFilter('resolved')}
          />

          <DashboardMetricCard
            title={language === 'en' ? 'Total Gaps' : 'Total Kesenjangan'}
            value={`${stats.total} Total`}
            badge="KMS Feedback"
            badgeType="neutral"
            footerText={language === 'en' ? 'Accumulated queries' : 'Akumulasi query pengguna'}
            isLoading={isLoading}
            onClick={() => setStatusFilter('all')}
          />
        </div>

        {/* Controls Bar: High-Density Search, Status Switcher, Actions */}
        <div className="enterprise-card" style={{ padding: '0.65rem 0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Search Box with Ctrl+K badge */}
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search
                size={13}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={language === 'en' ? 'Search query or requesting division...' : 'Cari pertanyaan atau divisi pemohon...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-text"
                style={{
                  paddingLeft: '30px',
                  paddingRight: '62px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '12px',
                  height: '30px',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              >
                <kbd className="kbd-shortcut">Ctrl K</kbd>
              </div>
            </div>

            {/* Segmented Status Switcher */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-app)',
                padding: '2px',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border-default)',
                gap: '2px',
              }}
            >
              <button
                onClick={() => setStatusFilter('open')}
                style={{
                  borderRadius: 'var(--radius-xs)',
                  padding: '3px 9px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: statusFilter === 'open' ? '1px solid var(--border-default)' : '1px solid transparent',
                  backgroundColor: statusFilter === 'open' ? 'var(--bg-card)' : 'transparent',
                  color: statusFilter === 'open' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: statusFilter === 'open' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {language === 'en' ? 'Open' : 'Terbuka'} ({stats.open})
              </button>
              <button
                onClick={() => setStatusFilter('in_progress')}
                style={{
                  borderRadius: 'var(--radius-xs)',
                  padding: '3px 9px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: statusFilter === 'in_progress' ? '1px solid var(--border-default)' : '1px solid transparent',
                  backgroundColor: statusFilter === 'in_progress' ? 'var(--bg-card)' : 'transparent',
                  color: statusFilter === 'in_progress' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: statusFilter === 'in_progress' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {language === 'en' ? 'In Progress' : 'Diproses'} ({stats.inProgress})
              </button>
              <button
                onClick={() => setStatusFilter('resolved')}
                style={{
                  borderRadius: 'var(--radius-xs)',
                  padding: '3px 9px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: statusFilter === 'resolved' ? '1px solid var(--border-default)' : '1px solid transparent',
                  backgroundColor: statusFilter === 'resolved' ? 'var(--bg-card)' : 'transparent',
                  color: statusFilter === 'resolved' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: statusFilter === 'resolved' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {language === 'en' ? 'Resolved' : 'Selesai'} ({stats.resolved})
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                style={{
                  borderRadius: 'var(--radius-xs)',
                  padding: '3px 9px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: statusFilter === 'all' ? '1px solid var(--border-default)' : '1px solid transparent',
                  backgroundColor: statusFilter === 'all' ? 'var(--bg-card)' : 'transparent',
                  color: statusFilter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: statusFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {language === 'en' ? 'All' : 'Semua'} ({stats.total})
              </button>
            </div>

            {/* Refresh Action */}
            <button
              onClick={fetchGaps}
              disabled={isLoading}
              className="btn btn-outline btn-sm"
              style={{ height: '30px', fontSize: '11.5px', gap: '5px' }}
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              <span>{language === 'en' ? 'Refresh' : 'Segarkan'}</span>
            </button>
          </div>
        </div>

        {/* Knowledge Gaps High-Density Enterprise List Card */}
        <div className="enterprise-card" style={{ padding: 0, overflow: 'hidden' }}>
          {isLoading ? (
            <div style={{ padding: '0.25rem 0' }}>
              {/* Table header placeholder */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(280px, 3fr) 110px 80px 110px 200px 90px',
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-app)',
                  borderBottom: '1px solid var(--border-default)',
                  gap: '8px',
                }}
              >
                {[1, 2, 3, 4, 5, 6].map((col) => (
                  <div key={col} className="skeleton-shimmer" style={{ height: '11px', width: col === 1 ? '110px' : '50px' }} />
                ))}
              </div>

              {/* 4 Skeleton Shimmer Rows */}
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(280px, 3fr) 110px 80px 110px 200px 90px',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 'none',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="skeleton-shimmer" style={{ width: '24px', height: '24px', borderRadius: '4px', flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                      <div className="skeleton-shimmer" style={{ width: `${180 + i * 30}px`, height: '13px' }} />
                      <div className="skeleton-shimmer" style={{ width: '100px', height: '10px' }} />
                    </div>
                  </div>
                  <div className="skeleton-shimmer" style={{ width: '55px', height: '14px', borderRadius: '3px' }} />
                  <div className="skeleton-shimmer" style={{ width: '35px', height: '14px', borderRadius: '3px' }} />
                  <div className="skeleton-shimmer" style={{ width: '70px', height: '16px', borderRadius: '10px' }} />
                  <div className="skeleton-shimmer" style={{ width: '130px', height: '12px' }} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                    <div className="skeleton-shimmer" style={{ width: '22px', height: '22px', borderRadius: '3px' }} />
                    <div className="skeleton-shimmer" style={{ width: '50px', height: '22px', borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredGaps.length === 0 ? (
            <div style={{ padding: '3.5rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px',
                  color: 'var(--color-success)',
                }}
              >
                <CheckCircle2 size={20} />
              </div>
              <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', margin: 0 }}>
                {statusFilter === 'open'
                  ? (language === 'en' ? 'No Open Knowledge Gaps' : 'Tidak Ada Kesenjangan Pengetahuan Terbuka')
                  : (language === 'en' ? 'No Gaps Recorded' : 'Tidak Ada Data Kesenjangan')}
              </p>
              <p style={{ fontSize: '12px', marginTop: '4px', maxWidth: '380px', margin: '4px auto 0', color: 'var(--text-secondary)' }}>
                {statusFilter === 'open'
                  ? (language === 'en'
                      ? 'All user questions are addressed or indexed in active knowledge bases.'
                      : 'Seluruh pertanyaan pengguna saat ini berhasil dijawab atau telah dilengkapi oleh dokumen SOP aktif.')
                  : (language === 'en' ? 'Try adjusting your search query or filter.' : 'Cobalah gunakan kata kunci pencarian yang berbeda.')}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: 'var(--bg-app)',
                      borderBottom: '1px solid var(--border-default)',
                      color: 'var(--text-secondary)',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <th style={{ padding: '7px 12px' }}>{language === 'en' ? 'User Question' : 'Pertanyaan Pengguna'}</th>
                    <th style={{ padding: '7px 10px' }}>{language === 'en' ? 'Division' : 'Divisi'}</th>
                    <th style={{ padding: '7px 10px' }}>{language === 'en' ? 'Freq' : 'Frekuensi'}</th>
                    <th style={{ padding: '7px 10px' }}>{language === 'en' ? 'Status' : 'Status'}</th>
                    <th style={{ padding: '7px 10px' }}>{language === 'en' ? 'Resolution / Note' : 'Penyelesaian / Catatan'}</th>
                    <th style={{ padding: '7px 12px', textAlign: 'right' }}>{language === 'en' ? 'Actions' : 'Aksi'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGaps.map((gap) => (
                    <tr
                      key={gap.id}
                      style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background-color 0.15s ease' }}
                      className="hover:bg-subtle"
                    >
                      {/* Query Text */}
                      <td style={{ padding: '8px 12px', maxWidth: '380px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <div
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: 'var(--radius-xs)',
                              backgroundColor: gap.status === 'open' ? 'var(--color-warning-subtle)' : 'var(--bg-subtle)',
                              color: gap.status === 'open' ? 'var(--color-warning)' : 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: '1px',
                            }}
                          >
                            <FileQuestion size={12} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word', fontSize: '12px' }}>
                              &ldquo;{gap.query_text}&rdquo;
                            </div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {language === 'en' ? 'Last queried: ' : 'Terakhir ditanyakan: '}
                              {new Date(gap.updated_at).toLocaleDateString(language === 'en' ? 'en-US' : 'id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Division */}
                      <td style={{ padding: '8px 10px' }}>
                        <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', padding: '1px 5px' }}>
                          <Building2 size={9} />
                          <span>{gap.division_id || 'General'}</span>
                        </span>
                      </td>

                      {/* Frequency */}
                      <td style={{ padding: '8px 10px' }}>
                        <span className="badge badge-accent font-mono font-bold tabular-nums" style={{ fontSize: '10.5px', padding: '1px 6px' }}>
                          {gap.frequency}x
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '8px 10px' }}>
                        <span
                          className={`badge ${
                            gap.status === 'resolved'
                              ? 'badge-success'
                              : gap.status === 'in_progress'
                              ? 'badge-accent'
                              : 'badge-warning'
                          }`}
                          style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px' }}
                        >
                          {gap.status === 'open'
                            ? (language === 'en' ? 'Open' : 'Terbuka')
                            : gap.status === 'in_progress'
                            ? (language === 'en' ? 'In Progress' : 'Diproses')
                            : (language === 'en' ? 'Resolved' : 'Selesai')}
                        </span>
                      </td>

                      {/* Resolution Note */}
                      <td style={{ padding: '8px 10px', maxWidth: '240px' }}>
                        {gap.resolution_note ? (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {gap.resolved_by ? `${gap.resolved_by}: ` : ''}
                            </span>
                            {gap.resolution_note}
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            {language === 'en' ? 'No notes yet' : 'Belum ada catatan'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Link
                            href={`/chat?q=${encodeURIComponent(gap.query_text)}`}
                            className="btn btn-ghost btn-xs"
                            title={language === 'en' ? 'Ask AI Chatbot' : 'Coba tanyakan ke AI Chatbot'}
                            style={{ color: 'var(--color-primary)', padding: '3px 5px' }}
                          >
                            <MessageSquare size={13} />
                          </Link>

                          {gap.status !== 'resolved' && (
                            <button
                              onClick={() => handleOpenResolveModal(gap)}
                              className="btn btn-outline btn-xs"
                              style={{ gap: '3px', fontSize: '10.5px', padding: '2px 7px' }}
                              title="Tandai kesenjangan ini telah diselesaikan setelah mengunggah SOP terkait"
                            >
                              <Check size={11} />
                              <span>{language === 'en' ? 'Resolve' : 'Selesaikan'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Enterprise Resolution Modal */}
      {resolvingGap && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => {
            if (!isSubmitting) setResolvingGap(null);
          }}
        >
          <div
            className="enterprise-card"
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <CheckCircle2 size={16} color="var(--color-success)" />
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {language === 'en' ? 'Resolve Knowledge Gap' : 'Selesaikan Kesenjangan Pengetahuan'}
                </h3>
              </div>
              <button
                onClick={() => setResolvingGap(null)}
                disabled={isSubmitting}
                className="btn btn-ghost"
                style={{ padding: '3px' }}
              >
                <X size={15} />
              </button>
            </div>

            <div>
              <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>
                {language === 'en' ? 'Resolved query:' : 'Pertanyaan yang diselesaikan:'}
              </p>
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-default)',
                  fontWeight: 600,
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                }}
              >
                &ldquo;{resolvingGap.query_text}&rdquo;
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                {language === 'en'
                  ? 'Resolution note (Which SOP or document was added):'
                  : 'Catatan Penyelesaian (SOP / Dokumen apa yang telah diunggah):'}
              </label>
              <textarea
                rows={3}
                placeholder={
                  language === 'en'
                    ? 'e.g. Uploaded SOP Vacation Policy 2026 v2.0 into Document Studio...'
                    : 'Contoh: Telah diunggah SOP Pengajuan Cuti 2026 versi 2.0 ke Document Studio...'
                }
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                className="input-text"
                style={{ width: '100%', resize: 'vertical', fontSize: '12px', borderRadius: 'var(--radius-xs)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setResolvingGap(null)}
                disabled={isSubmitting}
                className="btn btn-ghost btn-sm"
                style={{ height: '30px', fontSize: '11.5px' }}
              >
                {language === 'en' ? 'Cancel' : 'Batal'}
              </button>
              <button
                type="button"
                onClick={handleConfirmResolve}
                disabled={isSubmitting}
                className="btn btn-primary btn-sm"
                style={{ gap: '5px', height: '30px', fontSize: '11.5px' }}
              >
                {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                <span>{language === 'en' ? 'Confirm Resolution' : 'Konfirmasi Selesai'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
