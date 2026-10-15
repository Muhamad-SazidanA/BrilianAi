'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  FileQuestion,
  Search,
  CheckCircle2,
  Building2,
  MessageSquare,
  UploadCloud,
  RefreshCw,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
import { toast } from 'sonner';

export interface KnowledgeGapItem {
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

export interface GapStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
}

export default function KnowledgeGapsView() {
  const { language } = useLanguage();
  const { hasPermission } = useUserSession();

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Action Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {language === 'en' ? 'Knowledge Gaps Analysis' : 'Analisis Kesenjangan Pengetahuan'}
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {language === 'en'
              ? 'Track queries with low AI confidence or unanswered topics to enrich enterprise SOPs.'
              : 'Lacak pertanyaan dengan skor relevansi rendah atau belum terjawab untuk memperkaya dokumen SOP.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {hasPermission('documents:upload') && (
            <Link href="/documents?action=upload" className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
              <UploadCloud size={14} />
              <span>{language === 'en' ? 'Upload SOP Document' : 'Unggah Dokumen SOP'}</span>
            </Link>
          )}
          {hasPermission('chat:query') && (
            <Link href="/chat" className="btn btn-outline btn-sm" style={{ gap: '6px' }}>
              <MessageSquare size={14} />
              <span>{language === 'en' ? 'Test in AI Chat' : 'Uji di Chatbot'}</span>
            </Link>
          )}
        </div>
      </div>

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
            {language === 'en' ? 'Open Gaps' : 'Belum Terjawab (Open)'}
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            {stats.open}
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {language === 'en' ? 'Requires new document or SOP' : 'Memerlukan dokumen atau SOP baru'}
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
            {language === 'en' ? 'In Progress' : 'Sedang Ditangani'}
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            {stats.inProgress}
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {language === 'en' ? 'Being curated by SMEs' : 'Dalam proses kurasi SME'}
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
            {language === 'en' ? 'Resolved' : 'Berhasil Diselesaikan'}
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            {stats.resolved}
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {language === 'en' ? 'Complementary SOP available' : 'SOP pelengkap telah tersedia'}
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
            {language === 'en' ? 'Total Gaps' : 'Total Kesenjangan'}
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
            {stats.total}
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {language === 'en' ? 'Queries logged across workspace' : 'Pertanyaan masuk dari pengguna'}
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
              placeholder={language === 'en' ? 'Search query or requesting division...' : 'Cari pertanyaan atau divisi pemohon...'}
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
              {language === 'en' ? 'Open' : 'Terbuka'} ({stats.open})
            </button>
            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`btn btn-sm ${statusFilter === 'in_progress' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ borderRadius: 'var(--radius-xs)', padding: '5px 12px', fontSize: '12.5px', fontWeight: 600 }}
            >
              {language === 'en' ? 'In Progress' : 'Diproses'} ({stats.inProgress})
            </button>
            <button
              onClick={() => setStatusFilter('resolved')}
              className={`btn btn-sm ${statusFilter === 'resolved' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ borderRadius: 'var(--radius-xs)', padding: '5px 12px', fontSize: '12.5px', fontWeight: 600 }}
            >
              {language === 'en' ? 'Resolved' : 'Selesai'} ({stats.resolved})
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ borderRadius: 'var(--radius-xs)', padding: '5px 12px', fontSize: '12.5px', fontWeight: 600 }}
            >
              {language === 'en' ? 'All' : 'Semua'} ({stats.total})
            </button>
          </div>

          <button onClick={fetchGaps} disabled={isLoading} className="btn btn-outline btn-sm">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>{language === 'en' ? 'Refresh' : 'Segarkan'}</span>
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
            <p style={{ fontSize: '13.5px', fontWeight: 500 }}>
              {language === 'en' ? 'Loading knowledge gaps...' : 'Memuat daftar kesenjangan pengetahuan...'}
            </p>
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
                ? (language === 'en' ? 'No Open Knowledge Gaps' : 'Tidak Ada Kesenjangan Pengetahuan Terbuka')
                : (language === 'en' ? 'No Knowledge Gaps Found' : 'Tidak Ada Data Kesenjangan')}
            </p>
            <p style={{ fontSize: '13px', marginTop: '4px', maxWidth: '380px', margin: '4px auto 0' }}>
              {statusFilter === 'open'
                ? (language === 'en'
                    ? 'All user questions are currently answered accurately by active SOP documents.'
                    : 'Seluruh pertanyaan pengguna saat ini berhasil dijawab atau telah dilengkapi oleh dokumen SOP aktif.')
                : (language === 'en' ? 'Try adjusting your search criteria.' : 'Cobalah gunakan kata kunci pencarian yang berbeda.')}
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
                  <th style={{ padding: '14px 1.5rem' }}>{language === 'en' ? 'User Question' : 'Pertanyaan Pengguna'}</th>
                  <th style={{ padding: '14px 1rem' }}>{language === 'en' ? 'Division' : 'Divisi Pemohon'}</th>
                  <th style={{ padding: '14px 1rem' }}>{language === 'en' ? 'Frequency' : 'Frekuensi'}</th>
                  <th style={{ padding: '14px 1rem' }}>Status</th>
                  <th style={{ padding: '14px 1rem' }}>{language === 'en' ? 'Resolution / Notes' : 'Penyelesaian / Catatan'}</th>
                  <th style={{ padding: '14px 1.5rem', textAlign: 'right' }}>{language === 'en' ? 'Action' : 'Aksi'}</th>
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
                        {gap.status === 'open'
                          ? (language === 'en' ? 'Open' : 'Terbuka (Open)')
                          : gap.status === 'in_progress'
                          ? (language === 'en' ? 'In Progress' : 'Diproses')
                          : (language === 'en' ? 'Resolved' : 'Selesai')}
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
                          {language === 'en' ? 'No note recorded' : 'Belum ada catatan'}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 1.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Link
                          href={`/chat?q=${encodeURIComponent(gap.query_text)}`}
                          className="btn btn-ghost btn-sm"
                          title={language === 'en' ? 'Test query in AI Chatbot' : 'Coba tanyakan ke AI Chatbot'}
                          style={{ color: 'var(--color-primary)' }}
                        >
                          <MessageSquare size={14} />
                        </Link>

                        {gap.status !== 'resolved' && (
                          <button
                            onClick={() => handleOpenResolveModal(gap)}
                            className="btn btn-outline btn-sm"
                            style={{ gap: '4px', fontSize: '11.5px' }}
                            title={language === 'en' ? 'Mark gap as resolved' : 'Tandai kesenjangan ini telah diselesaikan'}
                          >
                            <Check size={13} />
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
                  {language === 'en' ? 'Resolve Knowledge Gap' : 'Selesaikan Kesenjangan Pengetahuan'}
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
                {language === 'en' ? 'Question being resolved:' : 'Pertanyaan yang diselesaikan:'}
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
                {language === 'en'
                  ? 'Resolution Note (Which SOP / Document was added):'
                  : 'Catatan Penyelesaian (SOP / Dokumen apa yang telah diunggah):'}
              </label>
              <textarea
                rows={3}
                placeholder={
                  language === 'en'
                    ? 'E.g., Added SOP 2026 v2.0 into Document Studio...'
                    : 'Contoh: Telah diunggah SOP Pengajuan Cuti 2026 versi 2.0 ke Document Studio...'
                }
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
                {language === 'en' ? 'Cancel' : 'Batal'}
              </button>
              <button
                type="button"
                onClick={handleConfirmResolve}
                disabled={isSubmitting}
                className="btn btn-primary btn-sm"
                style={{ gap: '6px' }}
              >
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span>{language === 'en' ? 'Confirm Resolved' : 'Konfirmasi Selesai'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
