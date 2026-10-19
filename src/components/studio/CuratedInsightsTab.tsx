'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Plus,
  Download,
  Pencil,
  Trash2,
  Tag,
  BookOpen,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Sparkles,
} from 'lucide-react';
import { CuratedInsightItem } from '@/types/curation';
import InsightEditorModal from './InsightEditorModal';
import MarkdownContent from '@/components/ui/MarkdownContent';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
import { toast } from 'sonner';

function formatSourcePages(sourcePages?: string, pageLabel: string = 'Halaman'): string {
  if (!sourcePages || sourcePages.trim() === '' || sourcePages === 'N/A') return 'N/A';
  const cleaned = sourcePages.replace(/^(halaman|page|hal\.?)\s+/i, '').trim();
  return `${pageLabel} ${cleaned || sourcePages}`;
}

interface CurationProgressState {
  batchId: string;
  totalChunks: number;
  processedChunks?: number;
  curatedChunks: number;
  curatedInsightsCount?: number;
  currentPercent: number;
  status: 'idle' | 'running' | 'completed' | 'error';
  currentChunkTitle?: string;
  error?: string;
}

interface CuratedInsightsTabProps {
  batchId: string;
  insights: CuratedInsightItem[];
  totalChunks?: number;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}

export default function CuratedInsightsTab({
  batchId,
  insights,
  totalChunks = 0,
  isLoading,
  onRefresh,
}: CuratedInsightsTabProps) {
  const { language, t } = useLanguage();
  const { hasPermission } = useUserSession();
  const [isCurating, setIsCurating] = useState(false);
  const [editingInsight, setEditingInsight] = useState<CuratedInsightItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [progress, setProgress] = useState<CurationProgressState | null>(null);
  const [deletingInsightId, setDeletingInsightId] = useState<number | string | null>(null);
  const [isDeletingInsight, setIsDeletingInsight] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Stop polling helper
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Poll progress from server
  const pollProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${batchId}/curate/progress`);
      if (!res.ok) return;
      const data: CurationProgressState = await res.json();
      setProgress(data);

      const targetTotal = totalChunks || data.totalChunks || 0;
      const processedCount = data.processedChunks ?? data.curatedChunks ?? 0;
      const isCompleted =
        (data.status === 'completed' && targetTotal > 0 && processedCount >= targetTotal) ||
        (targetTotal > 0 && processedCount >= targetTotal);

      if (isCompleted) {
        stopPolling();
        setIsCurating(false);
        await onRefresh();
        setFeedbackMsg({
          type: 'success',
          text:
            language === 'en'
              ? `AI Curation 100% completed! ${processedCount} chunks successfully processed.`
              : `Kurasi AI 100% selesai! ${processedCount} chunk berhasil diproses menjadi insight.`,
        });
        toast.success(
          language === 'en' ? 'AI curation completed 100%!' : 'Kurasi AI selesai 100%!'
        );
      } else if (data.status === 'idle') {
        stopPolling();
        setIsCurating(false);
        await onRefresh();
        const donePct = targetTotal > 0 ? Math.round((processedCount / targetTotal) * 100) : (data.currentPercent ?? 0);
        setFeedbackMsg({
          type: 'success',
          text:
            language === 'en'
              ? `Curation batch completed (${donePct}%). ${processedCount} of ${targetTotal} chunks processed.`
              : `Kurasi batch selesai (${donePct}%). ${processedCount} dari ${targetTotal} chunk berhasil diproses.`,
        });
      } else if (data.status === 'error') {
        stopPolling();
        setIsCurating(false);
        setFeedbackMsg({
          type: 'error',
          text: data.error || (language === 'en' ? 'AI curation error' : 'Terjadi kendala saat kurasi'),
        });
      }
    } catch {
      // ignore network errors during poll
    }
  }, [batchId, totalChunks, language, onRefresh, stopPolling]);

  // Check initial progress status on mount
  useEffect(() => {
    let isMounted = true;

    async function checkInitialStatus() {
      try {
        const res = await fetch(`/api/documents/${batchId}/curate/progress`);
        if (!res.ok || !isMounted) return;
        const data: CurationProgressState = await res.json();
        if (!isMounted) return;
        setProgress(data);

        if (data.status === 'running') {
          setIsCurating(true);
          if (!pollingRef.current) {
            pollingRef.current = setInterval(pollProgress, 1200);
          }
        }
      } catch {
        // ignore
      }
    }

    checkInitialStatus();

    return () => {
      isMounted = false;
      stopPolling();
    };
  }, [batchId, pollProgress, stopPolling]);

  // Trigger AI Auto-Curation manually
  const handleStartCuration = async () => {
    setIsCurating(true);
    setFeedbackMsg(null);
    setProgress((prev) => ({
      batchId,
      totalChunks: prev?.totalChunks || 0,
      curatedChunks: prev?.curatedChunks || 0,
      currentPercent: 1,
      status: 'running',
      currentChunkTitle: language === 'en' ? 'Starting AI engine...' : 'Memulai AI engine...',
    }));

    try {
      const res = await fetch(`/api/documents/${batchId}/curate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || (language === 'en' ? 'Failed to start AI curation' : 'Gagal memulai kurasi AI')
        );
      }

      toast.info(
        language === 'en'
          ? 'AI curation started. Monitoring progress (1-100%)...'
          : 'Kurasi AI dimulai. Memantau progres (1-100%)...'
      );

      // Mulai polling progres secara intensif
      stopPolling();
      pollingRef.current = setInterval(pollProgress, 1200);
      pollProgress();
    } catch (err: any) {
      setIsCurating(false);
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Gagal memulai kurasi',
      });
      toast.error(err?.message || 'Gagal memulai kurasi');
    }
  };

  // Save (Create or Update)
  const handleSaveInsight = async (data: Partial<CuratedInsightItem>) => {
    const isEdit = !!editingInsight?.id;
    toast.promise(
      async () => {
        if (isEdit) {
          const res = await fetch(`/api/documents/${batchId}/curate/${editingInsight.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || (language === 'en' ? 'Failed to save changes' : 'Gagal menyimpan perubahan'));
          }
        } else {
          const res = await fetch(`/api/documents/${batchId}/curate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manualInsight: data }),
          });
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || (language === 'en' ? 'Failed to add insight' : 'Gagal menambahkan insight'));
          }
        }
        await onRefresh();
      },
      {
        loading: isEdit
          ? (language === 'en' ? 'Saving changes...' : 'Menyimpan perubahan...')
          : (language === 'en' ? 'Adding insight...' : 'Menambahkan insight...'),
        success: isEdit
          ? (language === 'en' ? 'Insight updated successfully' : 'Insight berhasil diperbarui')
          : (language === 'en' ? 'New insight added successfully' : 'Insight baru berhasil ditambahkan'),
        error: (err) => err.message,
      }
    );
  };

  // Delete modal triggers
  const handleDeleteInsight = (insightId: number | string) => {
    setDeletingInsightId(insightId);
  };

  const handleConfirmDeleteInsight = async () => {
    if (!deletingInsightId) return;
    setIsDeletingInsight(true);
    try {
      const res = await fetch(`/api/documents/${batchId}/curate/${deletingInsightId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.error || (language === 'en' ? 'Failed to delete insight' : 'Gagal menghapus insight')
        );
      }
      setDeletingInsightId(null);
      await onRefresh();
      toast.success(
        language === 'en' ? 'Curated insight deleted successfully' : 'Insight kurasi berhasil dihapus'
      );
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus insight');
    } finally {
      setIsDeletingInsight(false);
    }
  };

  // Export
  const handleExport = (format: 'json' | 'csv') => {
    toast.info(language === 'en' ? `Downloading ${format.toUpperCase()} export...` : `Mengunduh data ekspor ${format.toUpperCase()}...`);
    window.open(`/api/documents/${batchId}/export?format=${format}`, '_blank');
  };

  // Unique processed raw chunks derived from active curated insights
  const processedChunkIds = useMemo(() => {
    return new Set(
      insights.map((i) => (i.source_chunk_id ? String(i.source_chunk_id) : null)).filter(Boolean)
    );
  }, [insights]);

  const targetTotal = totalChunks || progress?.totalChunks || 0;
  const processedCount = isCurating && progress?.processedChunks
    ? Math.max(progress.processedChunks, processedChunkIds.size)
    : processedChunkIds.size;
  const isCompleted = targetTotal > 0 && processedCount >= targetTotal;
  const pct = targetTotal > 0 ? Math.min(100, Math.round((processedCount / targetTotal) * 100)) : (insights.length > 0 ? 100 : 0);
  const currentPercent = isCurating ? (progress?.currentPercent ?? pct) : pct;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Action Header Card */}
      <div className="ui-card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Curated Insights ({insights.length})
              </h3>
              {(() => {
                if (isCompleted) {
                  return (
                    <span className="badge badge-success" style={{ fontSize: '11px', fontWeight: 600 }}>
                      100% Terkurasi ({insights.length} Insight)
                    </span>
                  );
                }

                if (processedCount > 0 && targetTotal > 0) {
                  return (
                    <span className="badge badge-warning" style={{ fontSize: '11px', fontWeight: 600 }}>
                      {pct}% ({insights.length} Insight)
                    </span>
                  );
                }

                if (insights.length > 0) {
                  return (
                    <span className="badge badge-success" style={{ fontSize: '11px', fontWeight: 600 }}>
                      Terkurasi ({insights.length} Insight)
                    </span>
                  );
                }

                return (
                  <span
                    className="badge"
                    style={{
                      backgroundColor: 'var(--bg-subtle)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border-default)',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    Belum Dikurasi
                  </span>
                );
              })()}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '3px' }}>
              {t('curate.subtitle')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleExport('json')}
              className="btn btn-outline btn-sm"
              disabled={insights.length === 0}
            >
              <Download size={14} />
              <span>{t('curate.export_json')}</span>
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="btn btn-outline btn-sm"
              disabled={insights.length === 0}
            >
              <FileSpreadsheet size={14} />
              <span>{t('curate.export_csv')}</span>
            </button>
            {hasPermission('curation:edit') && (
              <button
                onClick={() => {
                  setEditingInsight(null);
                  setIsModalOpen(true);
                }}
                className="btn btn-outline btn-sm"
              >
                <Plus size={14} />
                <span>{t('curate.add_manual')}</span>
              </button>
            )}
            {hasPermission('curation:trigger') && (
              <button
                onClick={handleStartCuration}
                disabled={isCurating}
                className="btn btn-primary btn-sm"
                style={{ fontWeight: 600 }}
              >
                {isCurating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Memproses ({currentPercent}%)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>
                      {insights.length === 0
                        ? (language === 'en' ? 'Start AI Curation' : 'Mulai Kurasi AI')
                        : isCompleted
                        ? (language === 'en' ? 'Re-curate AI' : 'Kurasi Ulang AI')
                        : (language === 'en' ? `Continue AI Curation (${pct}%)` : `Lanjutkan Kurasi AI (${pct}%)`)}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Status message */}
        {feedbackMsg && (
          <div
            style={{
              marginTop: '14px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor:
                feedbackMsg.type === 'success' ? 'var(--color-success-subtle)' : 'var(--color-danger-subtle)',
              border: `1px solid ${feedbackMsg.type === 'success' ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
              color: feedbackMsg.type === 'success' ? 'var(--color-success-text)' : 'var(--color-danger-text)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 500,
            }}
          >
            {feedbackMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}
      </div>

      {/* Real-time 1-100% Curation Progress Bar Card */}
      {isCurating && (
        <div
          className="ui-card"
          style={{
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-subtle) 100%)',
            border: '1px solid var(--color-primary)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 4px 20px rgba(37, 99, 235, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary-subtle)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Loader2 size={16} className="animate-spin" />
              </div>
              <div>
                <h4 style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {language === 'en' ? 'AI Curation in Progress...' : 'Kurasi AI Sedang Berjalan...'}
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {progress?.currentChunkTitle
                    ? `${language === 'en' ? 'Current target' : 'Memproses'}: "${progress.currentChunkTitle}"`
                    : language === 'en'
                    ? 'Extracting structured knowledge and tables chunk-by-chunk...'
                    : 'Mengekstrak intisari dan tabel numerik per chunk...'}
                </p>
              </div>
            </div>

            {/* Percentage Number */}
            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-primary)',
                }}
              >
                {Math.max(1, currentPercent)}%
              </span>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                {progress?.processedChunks || progress?.curatedChunks || 0} / {progress?.totalChunks || '?'} raw chunk diproses
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600, marginTop: '2px' }}>
                {progress?.curatedInsightsCount || insights.length} insight dibuat
              </div>
            </div>
          </div>

          {/* Progress Bar Track */}
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'var(--border-default)',
              borderRadius: '999px',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: `${Math.max(2, Math.min(100, currentPercent))}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #2563eb 0%, #3b82f6 50%, #10b981 100%)',
                borderRadius: '999px',
                transition: 'width 0.4s ease-in-out',
              }}
            />
          </div>
        </div>
      )}

      {/* Uncurated Callout Banner (jika belum dikurasi dan tidak sedang loading) */}
      {!isCurating && insights.length === 0 && !isLoading && (
        <div
          className="ui-card"
          style={{
            padding: '2rem 1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-card)',
            border: '2px dashed var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary-subtle)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={26} />
          </div>
          <div style={{ maxWidth: '480px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {language === 'en' ? 'Document Not Yet Curated' : 'Dokumen Ini Belum Dikurasi'}
            </h4>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '21px' }}>
              {language === 'en'
                ? 'Run AI Curation to transform raw extracted chunks into clean, structured insights with tables, key metrics, and importance tags.'
                : 'Jalankan Kurasi AI untuk menyaring teks mentah hasil ekstraksi menjadi intisari berkualitas tinggi, tabel Markdown, dan metrik finansial/operasional dengan progres 1-100%.'}
            </p>
          </div>

          {hasPermission('curation:trigger') && (
            <button
              onClick={handleStartCuration}
              className="btn btn-primary"
              style={{ marginTop: '6px', padding: '10px 22px', fontSize: '14px', fontWeight: 700 }}
            >
              <Sparkles size={16} />
              <span>{language === 'en' ? 'Start AI Curation (1-100%)' : 'Mulai Kurasi AI Sekarang'}</span>
            </button>
          )}
        </div>
      )}

      {/* Insights Grid */}
      {isLoading ? (
        <div style={{ padding: '3.5rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div
            className="animate-spin"
            style={{
              width: '26px',
              height: '26px',
              border: '2px solid var(--border-default)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              margin: '0 auto 10px',
            }}
          />
          <p style={{ fontSize: '13px' }}>{t('curate.loading')}</p>
        </div>
      ) : insights.length === 0 ? null : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {insights.map((item) => {
            const importanceBadge =
              item.importance === 'high'
                ? 'badge-danger'
                : item.importance === 'medium'
                ? 'badge-warning'
                : 'badge-neutral';

            return (
              <div
                key={item.id}
                className="ui-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderTop: item.importance === 'high' ? '3px solid var(--color-danger)' : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div>
                    <span className={`badge ${importanceBadge}`} style={{ fontSize: '10.5px' }}>
                      {item.importance.toUpperCase()}
                    </span>
                    <h4 style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px', lineHeight: '20px' }}>
                      {item.title}
                    </h4>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {hasPermission('curation:edit') && (
                      <button
                        onClick={() => {
                          setEditingInsight(item);
                          setIsModalOpen(true);
                        }}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '6px' }}
                        title="Edit insight"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {hasPermission('curation:delete') && (
                      <button
                        onClick={() => handleDeleteInsight(item.id)}
                        className="btn btn-ghost-danger btn-sm"
                        style={{ padding: '6px' }}
                        title="Hapus insight"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ flex: 1, minHeight: 0 }}>
                  <MarkdownContent content={item.content} compact />
                </div>

                {/* Footer: Source Pages and Tags */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border-default)',
                    paddingTop: '10px',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <BookOpen size={13} color="var(--color-primary)" />
                    <span style={{ fontWeight: 500 }}>{formatSourcePages(item.source_pages, t('curate.page'))}</span>
                  </div>

                  {item.tags && item.tags.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      <Tag size={12} color="var(--text-muted)" />
                      {item.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="badge badge-neutral" style={{ fontSize: '10.5px', padding: '1px 6px' }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      <InsightEditorModal
        insight={editingInsight}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingInsight(null);
        }}
        onSave={handleSaveInsight}
      />

      {/* Confirmation Modal for Insight Deletion */}
      <ConfirmationModal
        isOpen={deletingInsightId !== null}
        onClose={() => {
          if (!isDeletingInsight) setDeletingInsightId(null);
        }}
        onConfirm={handleConfirmDeleteInsight}
        isLoading={isDeletingInsight}
        title={language === 'en' ? 'Delete Curated Insight?' : 'Hapus Insight Kurasi?'}
        description={
          language === 'en'
            ? 'Are you sure you want to delete this curated insight? It will be permanently removed from the curated knowledge repository.'
            : 'Apakah Anda yakin ingin menghapus insight kurasi ini? Catatan intisari ini akan dihapus permanen dari basis pengetahuan terverifikasi.'
        }
        confirmLabel={language === 'en' ? 'Yes, Delete Insight' : 'Ya, Hapus Insight'}
        cancelLabel={language === 'en' ? 'Cancel' : 'Batal'}
        variant="danger"
      />
    </div>
  );
}
