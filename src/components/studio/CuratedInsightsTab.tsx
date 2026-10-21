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
  Globe,
} from 'lucide-react';
import { CuratedInsightItem } from '@/types/curation';
import InsightEditorModal from './InsightEditorModal';
import MarkdownContent from '@/components/ui/MarkdownContent';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
import { toast } from 'sonner';

function formatSourcePages(sourcePages?: string, defaultLabel: string = 'Halaman'): string {
  if (!sourcePages || sourcePages.trim() === '' || sourcePages === 'N/A') return 'N/A';
  const cleaned = sourcePages.replace(/^(halaman|page|hal\.?|record)\s+/i, '').trim();
  return `${defaultLabel} ${cleaned || sourcePages}`;
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
  isApiBatch?: boolean;
}

export default function CuratedInsightsTab({
  batchId,
  insights,
  totalChunks = 0,
  isLoading,
  onRefresh,
  isApiBatch = false,
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
    const isRecurate = totalChunks > 0 && (insights.length > 0 || (progress?.curatedChunks ?? 0) >= totalChunks);

    setIsCurating(true);
    setFeedbackMsg(null);
    setProgress((prev) => ({
      batchId,
      totalChunks: prev?.totalChunks || totalChunks,
      curatedChunks: 0,
      currentPercent: 1,
      status: 'running',
      currentChunkTitle: isRecurate
        ? (language === 'en' ? 'Resetting & regenerating AI insights...' : 'Mereset & meregenerasi intisari AI...')
        : (language === 'en' ? 'Starting AI engine...' : 'Memulai AI engine...'),
    }));

    try {
      const res = await fetch(`/api/documents/${batchId}/curate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurate: isRecurate }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || (language === 'en' ? 'Failed to start AI curation' : 'Gagal memulai kurasi AI')
        );
      }

      toast.info(
        isRecurate
          ? (language === 'en'
              ? 'AI re-curation started. Regenerating all chunks (1-100%)...'
              : 'Kurasi ulang AI dimulai. Meregenerasi seluruh halaman (1-100%)...')
          : (language === 'en'
              ? 'AI curation started. Monitoring progress (1-100%)...'
              : 'Kurasi AI dimulai. Memantau progres (1-100%)...')
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
      <div
        style={{
          padding: '1.125rem 1.5rem',
          borderRadius: 'var(--radius-lg, 12px)',
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-default, #e2e8f0)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                Curated Insights
              </h3>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted, #94a3b8)', fontWeight: 500 }}>
                ({insights.length})
              </span>
              {(() => {
                if (isCompleted) {
                  return (
                    <span
                      style={{
                        padding: '2px 9px',
                        fontSize: '11px',
                        fontWeight: 500,
                        borderRadius: '9999px',
                        backgroundColor: 'var(--color-success-subtle, #ecfdf5)',
                        color: 'var(--color-success-text, #047857)',
                        border: '1px solid var(--color-success-border, #a7f3d0)',
                      }}
                    >
                      100% Terkurasi ({insights.length} Insight)
                    </span>
                  );
                }

                if (processedCount > 0 && targetTotal > 0) {
                  return (
                    <span
                      style={{
                        padding: '2px 9px',
                        fontSize: '11px',
                        fontWeight: 500,
                        borderRadius: '9999px',
                        backgroundColor: 'var(--color-warning-subtle, #fffbeb)',
                        color: 'var(--color-warning-text, #b45309)',
                        border: '1px solid var(--color-warning-border, #fde68a)',
                      }}
                    >
                      {pct}% ({insights.length} Insight)
                    </span>
                  );
                }

                if (insights.length > 0) {
                  return (
                    <span
                      style={{
                        padding: '2px 9px',
                        fontSize: '11px',
                        fontWeight: 500,
                        borderRadius: '9999px',
                        backgroundColor: 'var(--color-success-subtle, #ecfdf5)',
                        color: 'var(--color-success-text, #047857)',
                        border: '1px solid var(--color-success-border, #a7f3d0)',
                      }}
                    >
                      Terkurasi ({insights.length} Insight)
                    </span>
                  );
                }

                return (
                  <span
                    style={{
                      padding: '2px 9px',
                      fontSize: '11px',
                      fontWeight: 500,
                      borderRadius: '9999px',
                      backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                      color: 'var(--text-muted, #94a3b8)',
                      border: '1px solid var(--border-default, #e2e8f0)',
                    }}
                  >
                    Belum Dikurasi
                  </span>
                );
              })()}
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary, #64748b)', margin: '4px 0 0' }}>
              {t('curate.subtitle')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleExport('json')}
              disabled={insights.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                borderRadius: '9999px',
                padding: '4px 12px',
                fontSize: '11.5px',
                fontWeight: 500,
                height: '28px',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary, #64748b)',
                border: '1px solid var(--border-default, #e2e8f0)',
                cursor: insights.length === 0 ? 'not-allowed' : 'pointer',
                opacity: insights.length === 0 ? 0.5 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              <Download size={13} />
              <span>{t('curate.export_json')}</span>
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={insights.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                borderRadius: '9999px',
                padding: '4px 12px',
                fontSize: '11.5px',
                fontWeight: 500,
                height: '28px',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary, #64748b)',
                border: '1px solid var(--border-default, #e2e8f0)',
                cursor: insights.length === 0 ? 'not-allowed' : 'pointer',
                opacity: insights.length === 0 ? 0.5 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              <FileSpreadsheet size={13} />
              <span>{t('curate.export_csv')}</span>
            </button>
            {hasPermission('curation:edit') && (
              <button
                onClick={() => {
                  setEditingInsight(null);
                  setIsModalOpen(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  borderRadius: '9999px',
                  padding: '4px 12px',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  height: '28px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary, #0f172a)',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Plus size={13} />
                <span>{t('curate.add_manual')}</span>
              </button>
            )}
            {hasPermission('curation:trigger') && (
              <button
                onClick={handleStartCuration}
                disabled={isCurating}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '9999px',
                  padding: '4px 14px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  height: '28px',
                  backgroundColor: 'var(--text-primary, #0f172a)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isCurating ? 'wait' : 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.1)',
                }}
              >
                {isCurating ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Memproses ({currentPercent}%)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={12} />
                    <span>
                      {insights.length === 0
                        ? (language === 'en' ? 'Mulai Kurasi AI' : 'Mulai Kurasi AI')
                        : isCompleted
                        ? (language === 'en' ? 'Kurasi Ulang AI' : 'Kurasi Ulang AI')
                        : (language === 'en' ? `Lanjutkan Kurasi (${pct}%)` : `Lanjutkan Kurasi (${pct}%)`)}
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
              marginTop: '12px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm, 8px)',
              backgroundColor:
                feedbackMsg.type === 'success' ? 'var(--color-success-subtle, #ecfdf5)' : 'var(--color-danger-subtle, #fef2f2)',
              border: `1px solid ${
                feedbackMsg.type === 'success' ? 'var(--color-success-border, #a7f3d0)' : 'var(--color-danger-border, #fecaca)'
              }`,
              color: feedbackMsg.type === 'success' ? 'var(--color-success-text, #047857)' : 'var(--color-danger-text, #b91c1c)',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 500,
            }}
          >
            {feedbackMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}
      </div>

      {/* Real-time 1-100% Curation Progress Bar Card */}
      {isCurating && (
        <div
          style={{
            padding: '1.25rem 1.5rem',
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-default, #e2e8f0)',
            borderRadius: 'var(--radius-lg, 12px)',
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
                  backgroundColor: 'var(--color-primary-subtle, #eff6ff)',
                  color: 'var(--color-primary, #2563eb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Loader2 size={16} className="animate-spin" />
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                  {language === 'en' ? 'AI Curation in Progress...' : 'Kurasi AI Sedang Berjalan...'}
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', margin: '2px 0 0' }}>
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
                  fontSize: '20px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-primary, #2563eb)',
                }}
              >
                {Math.max(1, currentPercent)}%
              </span>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
                {progress?.processedChunks || progress?.curatedChunks || 0} / {progress?.totalChunks || '?'} raw chunk diproses
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-primary, #2563eb)', fontWeight: 500, marginTop: '2px' }}>
                {progress?.curatedInsightsCount || insights.length} insight dibuat
              </div>
            </div>
          </div>

          {/* Progress Bar Track */}
          <div
            style={{
              width: '100%',
              height: '6px',
              backgroundColor: 'var(--bg-subtle, #f1f5f9)',
              borderRadius: '9999px',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: `${Math.max(2, Math.min(100, currentPercent))}%`,
                height: '100%',
                backgroundColor: 'var(--color-primary, #2563eb)',
                borderRadius: '9999px',
                transition: 'width 0.4s ease-in-out',
              }}
            />
          </div>
        </div>
      )}

      {/* Uncurated Callout Banner (jika belum dikurasi dan tidak sedang loading) */}
      {!isCurating && insights.length === 0 && !isLoading && (
        <div
          style={{
            padding: '2rem 1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px dashed var(--border-default, #e2e8f0)',
            borderRadius: 'var(--radius-lg, 12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary-subtle, #eff6ff)',
              color: 'var(--color-primary, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={20} />
          </div>
          <div style={{ maxWidth: '480px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
              {language === 'en' ? 'Document Not Yet Curated' : 'Dokumen Ini Belum Dikurasi'}
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary, #64748b)', marginTop: '4px', lineHeight: '20px' }}>
              {language === 'en'
                ? 'Run AI Curation to transform raw extracted chunks into clean, structured insights with tables, key metrics, and importance tags.'
                : 'Jalankan Kurasi AI untuk menyaring teks mentah hasil ekstraksi menjadi intisari berkualitas tinggi, tabel Markdown, dan metrik operasional dengan progres 1-100%.'}
            </p>
          </div>

          {hasPermission('curation:trigger') && (
            <button
              onClick={handleStartCuration}
              style={{
                marginTop: '4px',
                padding: '8px 18px',
                fontSize: '12.5px',
                fontWeight: 600,
                borderRadius: '9999px',
                backgroundColor: 'var(--text-primary, #0f172a)',
                color: '#ffffff',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <Sparkles size={14} />
              <span>{language === 'en' ? 'Start AI Curation' : 'Mulai Kurasi AI Sekarang'}</span>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '14px' }}>
          {insights.map((item) => {
            const importanceConfig = {
              high: {
                label: language === 'en' ? 'High' : 'Tinggi',
                bg: 'var(--color-danger-subtle, #fef2f2)',
                text: 'var(--color-danger-text, #b91c1c)',
                border: 'var(--color-danger-border, #fecaca)',
              },
              medium: {
                label: language === 'en' ? 'Medium' : 'Sedang',
                bg: 'var(--color-warning-subtle, #fffbeb)',
                text: 'var(--color-warning-text, #b45309)',
                border: 'var(--color-warning-border, #fde68a)',
              },
              low: {
                label: language === 'en' ? 'Low' : 'Rendah',
                bg: 'var(--bg-subtle, #f8fafc)',
                text: 'var(--text-secondary, #64748b)',
                border: 'var(--border-default, #e2e8f0)',
              },
            }[item.importance || 'medium'] || {
              label: 'Sedang',
              bg: 'var(--color-warning-subtle, #fffbeb)',
              text: 'var(--color-warning-text, #b45309)',
              border: 'var(--color-warning-border, #fde68a)',
            };

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '16px',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  borderRadius: 'var(--radius-md, 10px)',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 600,
                      padding: '1px 8px',
                      borderRadius: '9999px',
                      backgroundColor: importanceConfig.bg,
                      color: importanceConfig.text,
                      border: `1px solid ${importanceConfig.border}`,
                    }}
                  >
                    {importanceConfig.label}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {hasPermission('curation:edit') && (
                      <button
                        onClick={() => {
                          setEditingInsight(item);
                          setIsModalOpen(true);
                        }}
                        style={{
                          padding: '5px',
                          borderRadius: '4px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: 'var(--text-secondary, #64748b)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Edit insight"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    {hasPermission('curation:delete') && (
                      <button
                        onClick={() => handleDeleteInsight(item.id)}
                        style={{
                          padding: '5px',
                          borderRadius: '4px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: 'var(--text-muted, #94a3b8)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Hapus insight"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <h4
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-primary, #0f172a)',
                    lineHeight: '20px',
                    margin: 0,
                  }}
                >
                  {item.title}
                </h4>

                <div style={{ flex: 1, minHeight: 0, fontSize: '13px', lineHeight: '20px', color: 'var(--text-secondary, #334155)' }}>
                  <MarkdownContent content={item.content} compact />
                </div>

                {/* Footer: Source Pages and Tags */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border-default, #e2e8f0)',
                    paddingTop: '10px',
                    fontSize: '11px',
                    color: 'var(--text-secondary, #64748b)',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-mono)' }}>
                    {isApiBatch ? (
                      <Globe size={12} style={{ color: '#2563eb' }} />
                    ) : (
                      <BookOpen size={12} style={{ color: 'var(--text-muted, #94a3b8)' }} />
                    )}
                    <span>{formatSourcePages(item.source_pages, isApiBatch ? 'Record' : 'Hal.')}</span>
                  </div>

                  {item.tags && item.tags.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      {item.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10.5px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                            color: 'var(--text-secondary, #64748b)',
                            border: '1px solid var(--border-default, #e2e8f0)',
                          }}
                        >
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
        isApiBatch={isApiBatch}
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
