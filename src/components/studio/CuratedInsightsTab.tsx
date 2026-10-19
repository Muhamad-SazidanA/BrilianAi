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
    <div className="flex flex-col gap-4">
      {/* Top Action Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100">
                Curated Insights ({insights.length})
              </h3>
              {(() => {
                if (isCompleted) {
                  return (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                      100% Terkurasi ({insights.length} Insight)
                    </span>
                  );
                }

                if (processedCount > 0 && targetTotal > 0) {
                  return (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                      {pct}% ({insights.length} Insight)
                    </span>
                  );
                }

                if (insights.length > 0) {
                  return (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                      Terkurasi ({insights.length} Insight)
                    </span>
                  );
                }

                return (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                    Belum Dikurasi
                  </span>
                );
              })()}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('curate.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleExport('json')}
              disabled={insights.length === 0}
              className="h-8 px-3 rounded-full text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5 shadow-xs"
            >
              <Download size={13} />
              <span>{t('curate.export_json')}</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('csv')}
              disabled={insights.length === 0}
              className="h-8 px-3 rounded-full text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5 shadow-xs"
            >
              <FileSpreadsheet size={13} />
              <span>{t('curate.export_csv')}</span>
            </button>
            {hasPermission('curation:edit') && (
              <button
                type="button"
                onClick={() => {
                  setEditingInsight(null);
                  setIsModalOpen(true);
                }}
                className="h-8 px-3.5 rounded-full text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 shadow-xs"
              >
                <Plus size={13} />
                <span>{t('curate.add_manual')}</span>
              </button>
            )}
            {hasPermission('curation:trigger') && (
              <button
                type="button"
                onClick={handleStartCuration}
                disabled={isCurating}
                className="h-8 px-4 rounded-full text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/25 disabled:opacity-50 transition-all inline-flex items-center gap-1.5"
              >
                {isCurating ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Memproses ({currentPercent}%)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
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
            className={`mt-3.5 p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
            }`}
          >
            {feedbackMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}
      </div>

      {/* Real-time 1-100% Curation Progress Bar Card */}
      {isCurating && (
        <div className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-5 shadow-sm space-y-3.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 text-blue-600 flex items-center justify-center">
                <Loader2 size={18} className="animate-spin text-blue-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {language === 'en' ? 'AI Curation in Progress...' : 'Kurasi AI Sedang Berjalan...'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {progress?.currentChunkTitle
                    ? `${language === 'en' ? 'Current target' : 'Memproses'}: "${progress.currentChunkTitle}"`
                    : language === 'en'
                    ? 'Extracting structured knowledge and tables chunk-by-chunk...'
                    : 'Mengekstrak intisari dan tabel numerik per chunk...'}
                </p>
              </div>
            </div>

            {/* Percentage Number */}
            <div className="text-right">
              <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
                {Math.max(1, currentPercent)}%
              </span>
              <div className="text-xs text-slate-400">
                {progress?.processedChunks || progress?.curatedChunks || 0} / {progress?.totalChunks || '?'} chunk diproses
              </div>
            </div>
          </div>

          {/* Progress Bar Track */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 transition-all duration-300 shadow-sm"
              style={{ width: `${Math.max(2, Math.min(100, currentPercent))}%` }}
            />
          </div>
        </div>
      )}

      {/* Uncurated Callout Banner (jika belum dikurasi dan tidak sedang loading) */}
      {!isCurating && insights.length === 0 && !isLoading && (
        <div className="bg-gradient-to-b from-slate-50/80 to-white dark:from-slate-900/40 dark:to-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 md:p-12 text-center flex flex-col items-center gap-3.5 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 text-blue-600 flex items-center justify-center shadow-sm">
            <Sparkles size={24} className="text-blue-600 animate-pulse" />
          </div>
          <div className="max-w-md">
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {language === 'en' ? 'Document Not Yet Curated' : 'Dokumen Ini Belum Dikurasi'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              {language === 'en'
                ? 'Run AI Curation to transform raw extracted chunks into clean, structured insights with tables, key metrics, and importance tags.'
                : 'Jalankan Kurasi AI untuk mengubah potongan raw chunk menjadi insight terstruktur yang siap dijadikan rujukan cerdas AI.'}
            </p>
          </div>

          {hasPermission('curation:trigger') && (
            <button
              type="button"
              onClick={handleStartCuration}
              className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/25 hover:shadow-blue-500/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <Sparkles size={14} />
              <span>{language === 'en' ? 'Start AI Curation (1-100%)' : 'Mulai Kurasi AI Sekarang (1-100%)'}</span>
            </button>
          )}
        </div>
      )}

      {/* Insights Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
          <Loader2 size={24} className="animate-spin text-blue-600" />
          <p className="text-xs font-medium text-slate-500">{t('curate.loading')}</p>
        </div>
      ) : insights.length === 0 ? null : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {insights.map((item) => {
            const badgeClasses =
              item.importance === 'high'
                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                : item.importance === 'medium'
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-3.5 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${badgeClasses}`}>
                      {item.importance.toUpperCase()}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-2 leading-snug line-clamp-2">
                      {item.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    {hasPermission('curation:edit') && (
                      <button
                        onClick={() => {
                          setEditingInsight(item);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                        title="Edit insight"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    {hasPermission('curation:delete') && (
                      <button
                        onClick={() => handleDeleteInsight(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                        title="Hapus insight"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-h-0 text-xs text-slate-600 dark:text-slate-300 leading-relaxed overflow-hidden">
                  <MarkdownContent content={item.content} compact />
                </div>

                {/* Footer: Source Pages and Tags */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-400">
                    <BookOpen size={13} className="text-blue-600 dark:text-blue-400" />
                    <span>{formatSourcePages(item.source_pages, t('curate.page'))}</span>
                  </div>

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {item.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
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
