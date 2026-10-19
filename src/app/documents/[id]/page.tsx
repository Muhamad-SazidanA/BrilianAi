'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  FileText,
  BookOpen,
  Layers,
  Info,
  MessageSquare,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Lock,
  Users,
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import CuratedInsightsTab from '@/components/studio/CuratedInsightsTab';
import RawChunksTab from '@/components/studio/RawChunksTab';
import MetadataTab from '@/components/studio/MetadataTab';
import DocumentGrantsTab from '@/components/studio/DocumentGrantsTab';
import { UploadBatch, DocumentChunk } from '@/types/document';
import { CuratedInsightItem } from '@/types/curation';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
import { toast } from 'sonner';

export default function DocumentStudioPage() {
  const { language, t } = useLanguage();
  const { hasPermission } = useUserSession();
  const params = useParams();
  const batchId = params.id as string;

  const [activeTab, setActiveTab] = useState<'insights' | 'chunks' | 'metadata' | 'grants'>('insights');
  const [batch, setBatch] = useState<UploadBatch | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [insights, setInsights] = useState<CuratedInsightItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load document details, chunks, and insights
  const loadDocumentData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch current batch directly via /api/documents/${batchId} (ABAC validated)
      const batchRes = await fetch(`/api/documents/${batchId}`);
      if (!batchRes.ok) {
        setBatch(null);
        setChunks([]);
        setInsights([]);
        setIsLoading(false);
        return;
      }

      const current: UploadBatch = await batchRes.json();
      setBatch(current);

      // 2. Fetch Chunks and Curated Insights in parallel
      const [chunksRes, insightsRes] = await Promise.all([
        fetch(`/api/documents/${batchId}/chunks`),
        fetch(`/api/documents/${batchId}/curate`),
      ]);

      if (chunksRes.ok) {
        const chunksData = await chunksRes.json();
        setChunks(Array.isArray(chunksData) ? chunksData : []);
      }

      if (insightsRes.ok) {
        const insightsData = await insightsRes.json();
        setInsights(Array.isArray(insightsData) ? insightsData : []);
      }
    } catch (err) {
      console.error('Error loading document studio data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    if (batchId) {
      loadDocumentData();
    }
  }, [batchId, loadDocumentData]);

  const handleToggleActive = async () => {
    if (!batch) return;
    const newStatus = !batch.is_active_knowledge;

    toast.promise(
      async () => {
        const res = await fetch(`/api/documents/${batch.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActiveKnowledge: newStatus }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(
            data.error ||
              (language === 'en'
                ? 'Failed to change status'
                : 'Gagal mengubah status basis pengetahuan')
          );
        }
        setBatch((prev) => (prev ? { ...prev, is_active_knowledge: newStatus } : null));
        return newStatus;
      },
      {
        loading: language === 'en' ? 'Updating status...' : 'Memperbarui status...',
        success: (status) =>
          status
            ? language === 'en'
              ? 'Document activated for AI knowledge base'
              : 'Dokumen diaktifkan ke basis pengetahuan AI'
            : language === 'en'
            ? 'Document set to standby'
            : 'Dokumen diset ke standby',
        error: (err) => err.message,
      }
    );
  };

  if (!isLoading && !batch) {
    return (
      <AppShell requiredPermission="documents:read">
        <div
          className="ui-card"
          style={{
            maxWidth: '520px',
            margin: '5rem auto',
            padding: '2.5rem 2rem',
            textAlign: 'center',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <div
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <Lock size={24} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Dokumen Tidak Ditemukan atau Akses Dibatasi
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '20px', marginBottom: '1.75rem' }}>
            Dokumen ini tidak tersedia atau memiliki klasifikasi kerahasiaan / divisi di luar izin akun Anda.
          </p>
          <Link href="/documents" className="btn btn-primary btn-md">
            Kembali ke Knowledge Base
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      requiredPermission="documents:read"
      title={batch ? `Studio: ${batch.original_filename}` : t('studio.title')}
      subtitle={t('studio.subtitle')}
    >
      <div className="flex flex-col gap-5">
        {/* Breadcrumb Back Link */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Link
            href="/documents"
            className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Basis Pengetahuan</span>
          </Link>
          <span>/</span>
          <span className="text-slate-400">Document Studio</span>
          <span>/</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-sm">
            {batch?.original_filename || 'Dokumen'}
          </span>
        </div>

        {/* Modern Document Header Card */}
        {batch && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start md:items-center justify-between gap-4 flex-wrap">
              {/* Document Info Left */}
              <div className="flex items-start md:items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 flex-shrink-0">
                  <FileText size={22} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                    {batch.original_filename}
                  </h2>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                      {batch.page_count} {t('studio.pages')}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800">
                      {batch.chunk_count} {t('studio.chunks')}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        batch.classification === 'Publik'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : batch.classification === 'Rahasia'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                          : batch.classification === 'Sangat Rahasia'
                          ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                          : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                      }`}
                    >
                      {batch.classification || 'Internal'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                      {batch.division_id || 'General'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                      v{batch.version || '1.0'}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        batch.status === 'Aktif'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : batch.status === 'Review'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                          : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {batch.status || (batch.is_active_knowledge ? 'Aktif' : 'Draft')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status & Control Actions Right */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Curation Badge */}
                <div className="flex flex-col gap-1 items-start md:items-end">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Status Kurasi
                  </span>
                  {(() => {
                    const total = chunks.length;
                    const processedChunksSet = new Set(
                      insights.map((i) => (i.source_chunk_id ? String(i.source_chunk_id) : null)).filter(Boolean)
                    );
                    const processedCount = processedChunksSet.size;
                    const is100Percent = total > 0 && processedCount >= total;

                    if (is100Percent) {
                      return (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 size={12} className="text-emerald-600" />
                          <span>100% Terkurasi ({insights.length} Insight)</span>
                        </span>
                      );
                    }

                    if (processedCount > 0) {
                      const pct = Math.round((processedCount / total) * 100);
                      return (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <span>{pct}% ({insights.length} Insight)</span>
                        </span>
                      );
                    }

                    return (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>Belum Dikurasi</span>
                      </span>
                    );
                  })()}
                </div>

                <div className="w-[1px] h-8 bg-slate-200 dark:bg-slate-800 hidden sm:block" />

                {/* Chat Activation Status & Toggle */}
                <div className="flex flex-col gap-1 items-start md:items-end">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    RAG Knowledge Base
                  </span>
                  {hasPermission('documents:toggle_active') ? (
                    <button
                      type="button"
                      onClick={handleToggleActive}
                      className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                        batch.is_active_knowledge
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 group'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      }`}
                      title={batch.is_active_knowledge ? 'Klik untuk menonaktifkan dokumen dari pencarian AI' : 'Klik untuk mengaktifkan dokumen ke pencarian AI'}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          batch.is_active_knowledge
                            ? 'bg-emerald-500 shadow-sm shadow-emerald-400 group-hover:bg-rose-500'
                            : 'bg-slate-400'
                        }`}
                      />
                      <span>
                        {batch.is_active_knowledge ? 'Aktif di Chat' : 'Standby (Nonaktif)'}
                      </span>
                      <span className="text-[10.5px] font-normal opacity-70 group-hover:opacity-100">
                        {batch.is_active_knowledge ? '• Ubah' : '• Aktifkan'}
                      </span>
                    </button>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                        batch.is_active_knowledge
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${batch.is_active_knowledge ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      <span>{batch.is_active_knowledge ? 'Aktif di Chat' : 'Standby'}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modern Segmented Pill Tabs Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 w-fit max-w-full overflow-x-auto shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('insights')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'insights'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/80 dark:border-slate-700 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50'
            }`}
          >
            <BookOpen size={14} />
            <span>{t('studio.tab_curation')}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10.5px] font-mono ${
                activeTab === 'insights'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
              }`}
            >
              {insights.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chunks')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'chunks'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/80 dark:border-slate-700 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Layers size={14} />
            <span>{t('studio.tab_chunks')}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10.5px] font-mono ${
                activeTab === 'chunks'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
              }`}
            >
              {chunks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('metadata')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'metadata'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/80 dark:border-slate-700 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Info size={14} />
            <span>{t('studio.tab_metadata')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('grants')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'grants'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/80 dark:border-slate-700 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Users size={14} />
            <span>Akses Pengguna</span>
          </button>
        </div>

        {/* Tab Content Panes */}
        {activeTab === 'insights' && (
          <CuratedInsightsTab
            batchId={batchId}
            insights={insights}
            totalChunks={chunks.length || batch?.chunk_count || 0}
            isLoading={isLoading}
            onRefresh={loadDocumentData}
          />
        )}

        {activeTab === 'chunks' && (
          <RawChunksTab
            chunks={chunks}
            isLoading={isLoading}
            curatedCount={insights.length}
            onStartCuration={() => setActiveTab('insights')}
          />
        )}

        {activeTab === 'metadata' && (
          <MetadataTab
            batch={batch}
            chunks={chunks}
            onBatchUpdated={(updated) => setBatch(updated)}
          />
        )}

        {activeTab === 'grants' && (
          <DocumentGrantsTab
            batchId={batchId}
            batchTitle={batch?.original_filename}
          />
        )}
      </div>
    </AppShell>
  );
}
