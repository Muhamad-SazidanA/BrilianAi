'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  FileQuestion,
  Search,
  CheckCircle2,
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

        {/* 4 Pure Enterprise Metric Cards (Strict Monochrome Slate) */}
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
            badgeType="neutral"
            statusDot="live"
            footerText={language === 'en' ? 'Requires new SOP reference' : 'Memerlukan dokumen SOP baru'}
            isLoading={isLoading}
            onClick={() => setStatusFilter('open')}
          />

          <DashboardMetricCard
            title={language === 'en' ? 'In Progress' : 'Sedang Ditangani'}
            value={`${stats.inProgress} Proses`}
            badge="In Progress"
            badgeType="neutral"
            statusDot="blue"
            footerText={language === 'en' ? 'Under SME curation' : 'Dalam proses kurasi tim SME'}
            isLoading={isLoading}
            onClick={() => setStatusFilter('in_progress')}
          />

          <DashboardMetricCard
            title={language === 'en' ? 'Resolved' : 'Telah Diselesaikan'}
            value={`${stats.resolved} Selesai`}
            badge="Resolved"
            badgeType="neutral"
            footerText={language === 'en' ? 'SOP indexed to RAG' : 'Dokumen rujukan terunggah'}
            isLoading={isLoading}
            onClick={() => setStatusFilter('resolved')}
          />

          <DashboardMetricCard
            title={language === 'en' ? 'Total Gaps' : 'Total Kesenjangan'}
            value={`${stats.total} Total`}
            badge="KMS Total"
            badgeType="neutral"
            footerText={language === 'en' ? 'Accumulated queries' : 'Akumulasi query pengguna'}
            isLoading={isLoading}
            onClick={() => setStatusFilter('all')}
          />
        </div>

        {/* ── Unified Knowledge Gaps Stream Card (Linear / Vercel style) ── */}
        <div className="enterprise-card">
          {/* Unified Header Controls */}
          <div className="enterprise-card-header" style={{ flexWrap: 'wrap', gap: '8px' }}>
            {/* Left: Title + Inline Segmented Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {language === 'en' ? 'Unanswered Queries' : 'Pertanyaan Tanpa Rujukan'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  · {filteredGaps.length} isu
                </span>
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
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: statusFilter === 'open' ? '1px solid var(--border-default)' : '1px solid transparent',
                    backgroundColor: statusFilter === 'open' ? 'var(--bg-card)' : 'transparent',
                    color: statusFilter === 'open' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: statusFilter === 'open' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
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
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: statusFilter === 'in_progress' ? '1px solid var(--border-default)' : '1px solid transparent',
                    backgroundColor: statusFilter === 'in_progress' ? 'var(--bg-card)' : 'transparent',
                    color: statusFilter === 'in_progress' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: statusFilter === 'in_progress' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
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
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: statusFilter === 'resolved' ? '1px solid var(--border-default)' : '1px solid transparent',
                    backgroundColor: statusFilter === 'resolved' ? 'var(--bg-card)' : 'transparent',
                    color: statusFilter === 'resolved' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: statusFilter === 'resolved' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
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
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: statusFilter === 'all' ? '1px solid var(--border-default)' : '1px solid transparent',
                    backgroundColor: statusFilter === 'all' ? 'var(--bg-card)' : 'transparent',
                    color: statusFilter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: statusFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {language === 'en' ? 'All' : 'Semua'} ({stats.total})
                </button>
              </div>
            </div>

            {/* Right: Slim Search + Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ position: 'relative', width: '200px' }}>
                <Search
                  size={12}
                  color="var(--text-muted)"
                  style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={language === 'en' ? 'Search query...' : 'Cari pertanyaan...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-text"
                  style={{
                    paddingLeft: '26px',
                    paddingRight: '54px',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '11.5px',
                    height: '26px',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                  }}
                >
                  <kbd className="kbd-shortcut" style={{ fontSize: '9px', padding: '1px 4px' }}>Ctrl K</kbd>
                </div>
              </div>

              <button
                onClick={fetchGaps}
                disabled={isLoading}
                className="btn btn-ghost btn-xs"
                style={{ height: '26px', width: '26px', padding: 0 }}
                title={language === 'en' ? 'Refresh' : 'Segarkan'}
              >
                <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} color="var(--text-secondary)" />
              </button>
            </div>
          </div>

          {/* Stream Body */}
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  className="enterprise-list-item"
                  style={{
                    borderBottom: n === 5 ? 'none' : '1px solid var(--border-default)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 1 }}>
                    <span className="skeleton-shimmer" style={{ width: '24px', height: '24px', borderRadius: '5px', flexShrink: 0 }} />
                    <span className="skeleton-shimmer" style={{ width: `${160 + n * 30}px`, height: '13px', borderRadius: '3px' }} />
                    <span className="skeleton-shimmer" style={{ width: '120px', height: '11px', borderRadius: '3px' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="skeleton-shimmer" style={{ width: '45px', height: '13px', borderRadius: '3px' }} />
                    <span className="skeleton-shimmer" style={{ width: '55px', height: '20px', borderRadius: '4px' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredGaps.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              <CheckCircle2 size={20} style={{ margin: '0 auto 6px', color: 'var(--text-muted)', opacity: 0.6 }} />
              <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>
                {statusFilter === 'open'
                  ? (language === 'en' ? 'No Open Knowledge Gaps' : 'Tidak Ada Kesenjangan Pengetahuan Terbuka')
                  : (language === 'en' ? 'No Gaps Recorded' : 'Tidak Ada Data Kesenjangan')}
              </p>
              <p style={{ fontSize: '11.5px', marginTop: '3px', color: 'var(--text-secondary)' }}>
                {statusFilter === 'open'
                  ? (language === 'en'
                      ? 'All user questions are addressed or indexed in active knowledge bases.'
                      : 'Seluruh pertanyaan pengguna saat ini berhasil dijawab atau telah dilengkapi oleh dokumen SOP aktif.')
                  : (language === 'en' ? 'Try adjusting your search query or filter.' : 'Cobalah gunakan kata kunci pencarian yang berbeda.')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredGaps.map((gap, idx) => (
                <div
                  key={gap.id}
                  className="enterprise-list-item"
                  style={{
                    borderBottom: idx === filteredGaps.length - 1 ? 'none' : '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-card)',
                  }}
                >
                  {/* ── Left: Icon + Question Title + Strict Monochrome Dot Metadata ── */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1, marginRight: '12px' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '5px',
                        backgroundColor: 'var(--bg-subtle)',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FileQuestion size={13} />
                    </div>

                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '300px',
                        flexShrink: 0,
                      }}
                      title={gap.query_text}
                    >
                      &ldquo;{gap.query_text}&rdquo;
                    </span>

                    {/* Strict Monochrome Slate Inline Metadata */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <span>· {gap.frequency}x Ditanyakan</span>
                      <span>· {gap.division_id || 'General'}</span>
                      <span>
                        · {new Date(gap.updated_at).toLocaleDateString(language === 'en' ? 'en-US' : 'id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      {gap.resolution_note && (
                        <span>
                          · Selesai: {gap.resolved_by ? `${gap.resolved_by}: ` : ''}{gap.resolution_note}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── Right: Live Status Dot + Sleek Actions ── */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {gap.status === 'resolved' ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11px',
                          fontWeight: 500,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span className="pulse-dot-live" />
                        {language === 'en' ? 'Resolved' : 'Selesai'}
                      </span>
                    ) : gap.status === 'in_progress' ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11px',
                          fontWeight: 500,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span className="pulse-dot-blue" />
                        {language === 'en' ? 'In Progress' : 'Diproses'}
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--border-default)' }} />
                        {language === 'en' ? 'Open' : 'Terbuka'}
                      </span>
                    )}

                    <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-default)', margin: '0 2px' }} />

                    {/* Subtle Actions */}
                    <Link
                      href={`/chat?q=${encodeURIComponent(gap.query_text)}`}
                      className="btn btn-ghost btn-xs"
                      title={language === 'en' ? 'Ask AI Chatbot' : 'Coba tanyakan ke AI Chatbot'}
                      style={{ padding: '3px 5px', color: 'var(--text-secondary)' }}
                    >
                      <MessageSquare size={12} />
                    </Link>

                    {gap.status !== 'resolved' && (
                      <button
                        onClick={() => handleOpenResolveModal(gap)}
                        className="btn btn-outline btn-xs"
                        style={{
                          gap: '3px',
                          fontSize: '10.5px',
                          padding: '0 7px',
                          height: '24px',
                          color: 'var(--text-primary)',
                          borderRadius: '4px',
                        }}
                        title="Tandai kesenjangan ini telah diselesaikan setelah mengunggah SOP terkait"
                      >
                        <Check size={11} />
                        <span>{language === 'en' ? 'Resolve' : 'Selesaikan'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
