'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  FileQuestion,
  Search,
  CheckCircle2,
  Clock,
  Building2,
  MessageSquare,
  ArrowRight,
  UploadCloud,
  RefreshCw,
  Sliders,
  Check,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'open' | 'in_progress' | 'resolved' | 'all'>('open');

  // Modal resolution state
  const [resolvingGap, setResolvingGap] = useState<KnowledgeGapItem | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchGaps = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/knowledge-gaps?status=${statusFilter}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setGaps(data.gaps || []);
        if (data.stats) setStats(data.stats);
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
    <AppShell
      requiredPermission="documents:read"
      title={language === 'en' ? 'Knowledge Gaps' : 'Kesenjangan Pengetahuan (Knowledge Gaps)'}
      subtitle={
        language === 'en'
          ? 'Track unanswered queries and user feedback to continuously enrich organizational knowledge.'
          : 'Lacak pertanyaan yang belum terjawab atau tidak akurat agar tim ahli (SME) dapat segera melengkapi dokumen SOP terkait.'
      }
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          {hasPermission('documents:upload') && (
            <Link href="/upload" className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
              <UploadCloud size={14} />
              <span>Unggah SOP Baru</span>
            </Link>
          )}
          {hasPermission('chat:query') && (
            <Link href="/chat" className="btn btn-outline btn-sm" style={{ gap: '6px' }}>
              <MessageSquare size={14} />
              <span>Uji Tanya AI</span>
            </Link>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px' }}>
        {/* Metric Cards Banner */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {/* Open Gaps */}
          <div
            className="ui-card"
            style={{
              padding: '1.25rem',
              borderLeft: '4px solid var(--color-warning)',
              cursor: 'pointer',
              backgroundColor: statusFilter === 'open' ? 'var(--color-warning-subtle)' : 'var(--bg-card)',
            }}
            onClick={() => setStatusFilter('open')}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Belum Terjawab (Open)
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              {stats.open}
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Memerlukan dokumen atau SOP baru
            </p>
          </div>

          {/* In Progress */}
          <div
            className="ui-card"
            style={{
              padding: '1.25rem',
              borderLeft: '4px solid var(--color-primary)',
              cursor: 'pointer',
              backgroundColor: statusFilter === 'in_progress' ? 'var(--color-primary-subtle)' : 'var(--bg-card)',
            }}
            onClick={() => setStatusFilter('in_progress')}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Sedang Ditangani
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              {stats.inProgress}
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Dalam proses kurasi SME
            </p>
          </div>

          {/* Resolved */}
          <div
            className="ui-card"
            style={{
              padding: '1.25rem',
              borderLeft: '4px solid var(--color-success)',
              cursor: 'pointer',
              backgroundColor: statusFilter === 'resolved' ? 'var(--color-success-subtle)' : 'var(--bg-card)',
            }}
            onClick={() => setStatusFilter('resolved')}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Berhasil Diselesaikan
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              {stats.resolved}
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              SOP pelengkap telah tersedia
            </p>
          </div>

          {/* Total Recorded */}
          <div
            className="ui-card"
            style={{
              padding: '1.25rem',
              borderLeft: '4px solid var(--border-default)',
              cursor: 'pointer',
              backgroundColor: statusFilter === 'all' ? 'var(--bg-subtle)' : 'var(--bg-card)',
            }}
            onClick={() => setStatusFilter('all')}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Kesenjangan
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              {stats.total}
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Pertanyaan masuk dari pengguna
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="ui-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
              <Search
                size={16}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Cari pertanyaan atau divisi pemohon..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-text"
                style={{ paddingLeft: '38px', borderRadius: 'var(--radius-sm)' }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-app)',
                padding: '4px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                gap: '2px',
              }}
            >
              <button
                onClick={() => setStatusFilter('open')}
                className={`btn btn-sm ${statusFilter === 'open' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 'var(--radius-xs)', padding: '5px 12px', fontSize: '12.5px', fontWeight: 600 }}
              >
                Terbuka ({stats.open})
              </button>
              <button
                onClick={() => setStatusFilter('in_progress')}
                className={`btn btn-sm ${statusFilter === 'in_progress' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 'var(--radius-xs)', padding: '5px 12px', fontSize: '12.5px', fontWeight: 600 }}
              >
                Diproses ({stats.inProgress})
              </button>
              <button
                onClick={() => setStatusFilter('resolved')}
                className={`btn btn-sm ${statusFilter === 'resolved' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 'var(--radius-xs)', padding: '5px 12px', fontSize: '12.5px', fontWeight: 600 }}
              >
                Selesai ({stats.resolved})
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 'var(--radius-xs)', padding: '5px 12px', fontSize: '12.5px', fontWeight: 600 }}
              >
                Semua ({stats.total})
              </button>
            </div>

            <button onClick={fetchGaps} disabled={isLoading} className="btn btn-outline btn-sm">
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        {/* Knowledge Gaps Table */}
        <div className="ui-card" style={{ padding: 0, overflow: 'hidden' }}>
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
              <p style={{ fontSize: '13.5px', fontWeight: 500 }}>Memuat daftar kesenjangan pengetahuan...</p>
            </div>
          ) : filteredGaps.length === 0 ? (
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
                  color: 'var(--color-success)',
                }}
              >
                <CheckCircle2 size={24} />
              </div>
              <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                {statusFilter === 'open'
                  ? 'Tidak Ada Kesenjangan Pengetahuan Terbuka'
                  : 'Tidak Ada Data Kesenjangan'}
              </p>
              <p style={{ fontSize: '13px', marginTop: '4px', maxWidth: '380px', margin: '4px auto 0' }}>
                {statusFilter === 'open'
                  ? 'Seluruh pertanyaan pengguna saat ini berhasil dijawab atau telah dilengkapi oleh dokumen SOP aktif.'
                  : 'Cobalah gunakan kata kunci pencarian yang berbeda.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: 'var(--bg-app)',
                      borderBottom: '1px solid var(--border-default)',
                      color: 'var(--text-secondary)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    <th style={{ padding: '14px 1.5rem' }}>Pertanyaan Pengguna</th>
                    <th style={{ padding: '14px 1rem' }}>Divisi Pemohon</th>
                    <th style={{ padding: '14px 1rem' }}>Frekuensi</th>
                    <th style={{ padding: '14px 1rem' }}>Status</th>
                    <th style={{ padding: '14px 1rem' }}>Penyelesaian / Catatan</th>
                    <th style={{ padding: '14px 1.5rem', textAlign: 'right' }}>Aksi</th>
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
                      <td style={{ padding: '14px 1.5rem', maxWidth: '360px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--color-warning-subtle)',
                              color: 'var(--color-warning)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: '2px',
                            }}
                          >
                            <FileQuestion size={15} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                              &ldquo;{gap.query_text}&rdquo;
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                              Terakhir ditanyakan:{' '}
                              {new Date(gap.updated_at).toLocaleDateString('id-ID', {
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
                      <td style={{ padding: '14px 1rem' }}>
                        <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Building2 size={11} />
                          <span>{gap.division_id || 'General'}</span>
                        </span>
                      </td>

                      {/* Frequency */}
                      <td style={{ padding: '14px 1rem' }}>
                        <span className="badge badge-accent font-mono font-bold" style={{ fontSize: '12px' }}>
                          {gap.frequency}x
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 1rem' }}>
                        <span
                          className={`badge ${
                            gap.status === 'resolved'
                              ? 'badge-success'
                              : gap.status === 'in_progress'
                              ? 'badge-primary'
                              : 'badge-warning'
                          }`}
                          style={{ fontSize: '11.5px', fontWeight: 600, textTransform: 'capitalize' }}
                        >
                          {gap.status === 'open' ? 'Terbuka (Open)' : gap.status === 'in_progress' ? 'Diproses' : 'Selesai'}
                        </span>
                      </td>

                      {/* Resolution Note */}
                      <td style={{ padding: '14px 1rem', maxWidth: '240px' }}>
                        {gap.resolution_note ? (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {gap.resolved_by ? `${gap.resolved_by}: ` : ''}
                            </span>
                            {gap.resolution_note}
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Belum ada catatan
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 1.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Link
                            href={`/chat?q=${encodeURIComponent(gap.query_text)}`}
                            className="btn btn-ghost btn-sm"
                            title="Coba tanyakan ke AI Chatbot"
                            style={{ color: 'var(--color-primary)' }}
                          >
                            <MessageSquare size={14} />
                          </Link>

                          {gap.status !== 'resolved' && (
                            <button
                              onClick={() => handleOpenResolveModal(gap)}
                              className="btn btn-outline btn-sm"
                              style={{ gap: '4px', fontSize: '11.5px' }}
                              title="Tandai kesenjangan ini telah diselesaikan setelah mengunggah SOP terkait"
                            >
                              <Check size={13} />
                              <span>Selesaikan</span>
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

      {/* Resolution Modal */}
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
            className="ui-card"
            style={{
              width: '100%',
              maxWidth: '500px',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              padding: '1.5rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} color="var(--color-success)" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Selesaikan Kesenjangan Pengetahuan
                </h3>
              </div>
              <button
                onClick={() => setResolvingGap(null)}
                disabled={isSubmitting}
                className="btn btn-ghost"
                style={{ padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Pertanyaan yang diselesaikan:
              </p>
              <div
                style={{
                  marginTop: '6px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-default)',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                }}
              >
                &ldquo;{resolvingGap.query_text}&rdquo;
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Catatan Penyelesaian (SOP / Dokumen apa yang telah diunggah):
              </label>
              <textarea
                rows={3}
                placeholder="Contoh: Telah diunggah SOP Pengajuan Cuti 2026 versi 2.0 ke Document Studio..."
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                className="input-text"
                style={{ width: '100%', resize: 'vertical', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setResolvingGap(null)}
                disabled={isSubmitting}
                className="btn btn-ghost btn-sm"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmResolve}
                disabled={isSubmitting}
                className="btn btn-primary btn-sm"
                style={{ gap: '6px' }}
              >
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span>Konfirmasi Selesai</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
