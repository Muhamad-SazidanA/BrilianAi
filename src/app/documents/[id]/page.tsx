'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  FileText,
  BookOpen,
  Layers,
  Info,
  MessageSquare,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Download,
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import CuratedInsightsTab from '@/components/studio/CuratedInsightsTab';
import RawChunksTab from '@/components/studio/RawChunksTab';
import MetadataTab from '@/components/studio/MetadataTab';
import { UploadBatch, DocumentChunk } from '@/types/document';
import { CuratedInsightItem } from '@/types/curation';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

export default function DocumentStudioPage() {
  const { language, t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const batchId = params.id as string;

  const [activeTab, setActiveTab] = useState<'insights' | 'chunks' | 'metadata'>('insights');
  const [batch, setBatch] = useState<UploadBatch | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [insights, setInsights] = useState<CuratedInsightItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load document details, chunks, and insights
  const loadDocumentData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch batches to find current batch
      const batchesRes = await fetch('/api/documents');
      if (batchesRes.ok) {
        const allBatches: UploadBatch[] = await batchesRes.json();
        const current = allBatches.find((b) => b.id === batchId) || null;
        setBatch(current);
      }

      // 2. Fetch Chunks and Curated Insights in parallel
      const [chunksRes, insightsRes] = await Promise.all([
        fetch(`/api/documents/${batchId}/chunks`),
        fetch(`/api/documents/${batchId}/curate`),
      ]);

      if (chunksRes.ok) {
        const chunksData = await chunksRes.json();
        setChunks(chunksData);
      }

      if (insightsRes.ok) {
        const insightsData = await insightsRes.json();
        setInsights(insightsData);
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

  return (
    <AppShell
      title={batch ? `Studio: ${batch.original_filename}` : t('studio.title')}
      subtitle={t('studio.subtitle')}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href="/documents" className="btn btn-outline btn-sm">
            <ArrowLeft size={14} />
            <span>{t('studio.back_to_docs')}</span>
          </Link>
          <Link href="/chat" className="btn btn-primary btn-sm">
            <MessageSquare size={14} />
            <span>{t('studio.ask_doc')}</span>
          </Link>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Document Header Card */}
        {batch && (
          <div className="ui-card" style={{ padding: '1.25rem 1.75rem', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-primary-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-primary)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <FileText size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    {batch.original_filename}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    <span className="font-mono" style={{ color: 'var(--text-muted)' }}>ID: {batch.id}</span>
                    <span>·</span>
                    <span className="badge badge-neutral font-mono">{batch.page_count} {t('studio.pages')}</span>
                    <span>·</span>
                    <span className="badge badge-accent font-mono">{batch.chunk_count} {t('studio.chunks')}</span>
                  </div>
                </div>
              </div>

              {/* Status Toggle & Chat Action */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={handleToggleActive}
                  className={`badge ${batch.is_active_knowledge ? 'badge-success' : 'badge-neutral'}`}
                  style={{ cursor: 'pointer', padding: '6px 14px', fontSize: '12.5px', transition: 'all 0.15s ease' }}
                  title="Klik untuk mengubah status basis pengetahuan RAG"
                >
                  {batch.is_active_knowledge ? (
                    <>
                      <CheckCircle2 size={14} />
                      <span>{t('studio.active_badge')}</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={14} />
                      <span>{t('studio.standby_badge')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation (Modern Brilian.Ai Pill Tabs) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderBottom: '1px solid var(--border-default)',
            paddingBottom: '2px',
          }}
        >
          <button
            onClick={() => setActiveTab('insights')}
            className={`btn btn-sm ${activeTab === 'insights' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', padding: '8px 16px' }}
          >
            <BookOpen size={15} />
            <span>{t('studio.tab_curation')} ({insights.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('chunks')}
            className={`btn btn-sm ${activeTab === 'chunks' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', padding: '8px 16px' }}
          >
            <Layers size={15} />
            <span>{t('studio.tab_chunks')} ({chunks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('metadata')}
            className={`btn btn-sm ${activeTab === 'metadata' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', padding: '8px 16px' }}
          >
            <Info size={15} />
            <span>{t('studio.tab_metadata')}</span>
          </button>
        </div>

        {/* Tab Content Panes */}
        {activeTab === 'insights' && (
          <CuratedInsightsTab
            batchId={batchId}
            insights={insights}
            isLoading={isLoading}
            onRefresh={loadDocumentData}
          />
        )}

        {activeTab === 'chunks' && (
          <RawChunksTab chunks={chunks} isLoading={isLoading} />
        )}

        {activeTab === 'metadata' && (
          <MetadataTab batch={batch} chunks={chunks} />
        )}
      </div>
    </AppShell>
  );
}
