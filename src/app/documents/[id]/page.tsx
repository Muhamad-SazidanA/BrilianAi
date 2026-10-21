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
  Sparkles,
  Globe,
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

    if (newStatus && (!batch.curated_count || batch.curated_count === 0)) {
      toast.warning(
        language === 'en'
          ? 'Document cannot be activated before being curated. Please curate at least 1 insight in the AI Curation tab.'
          : 'Dokumen belum memiliki insight terkurasi. Lakukan kurasi setidaknya 1 insight pada tab "Kurasi AI" sebelum mengaktifkannya.'
      );
      return;
    }

    toast.promise(
      async () => {
        const res = await fetch(`/api/documents/${batch.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isActiveKnowledge: newStatus,
            is_active_knowledge: newStatus,
          }),
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Document Header Card */}
        {batch && (
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderRadius: 'var(--radius-lg, 12px)',
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-default, #e2e8f0)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.25rem', flexWrap: 'wrap' }}>
              {/* Left: File icon & metadata */}
              {(() => {
                const isApiBatch = batch.original_filename.startsWith('[API]');
                const cleanTitle = isApiBatch
                  ? batch.original_filename.replace(/^\[API\]\s*/, '')
                  : batch.original_filename;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        backgroundColor: isApiBatch ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-subtle, #f1f5f9)',
                        border: isApiBatch ? '1px solid #bfdbfe' : '1px solid var(--border-default, #e2e8f0)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isApiBatch ? '#2563eb' : 'var(--color-primary, #2563eb)',
                        flexShrink: 0,
                      }}
                      title={isApiBatch ? 'Sumber: Integrasi REST API' : 'Sumber: Dokumen PDF (OCR)'}
                    >
                      {isApiBatch ? <Globe size={20} /> : <FileText size={20} />}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h2
                          style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: 'var(--text-primary, #0f172a)',
                            letterSpacing: '-0.01em',
                            margin: 0,
                          }}
                        >
                          {cleanTitle}
                        </h2>
                        {isApiBatch && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#2563eb',
                              backgroundColor: '#eff6ff',
                              padding: '1px 8px',
                              borderRadius: '9999px',
                              border: '1px solid #bfdbfe',
                            }}
                          >
                            REST API Ingest
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '12px',
                          color: 'var(--text-secondary, #64748b)',
                          marginTop: '4px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>{isApiBatch ? `${batch.page_count} Record (Live Data)` : `${batch.page_count} Hal (OCR)`}</span>
                        <span style={{ color: 'var(--text-muted)' }}>·</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{batch.chunk_count} Chunks</span>
                    <span style={{ color: 'var(--text-muted)' }}>·</span>
                    <span>{batch.classification || 'Internal'}</span>
                    <span style={{ color: 'var(--text-muted)' }}>·</span>
                    <span>{batch.division_id || 'General'}</span>
                    <span style={{ color: 'var(--text-muted)' }}>·</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>v{batch.version || '1.0'}</span>
                    <span style={{ color: 'var(--text-muted)' }}>·</span>
                    <span
                      style={{
                        padding: '1px 8px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 500,
                        backgroundColor:
                          batch.status === 'Aktif'
                            ? 'var(--color-success-subtle, #ecfdf5)'
                            : 'var(--bg-subtle, #f1f5f9)',
                        color:
                          batch.status === 'Aktif'
                            ? 'var(--color-success-text, #047857)'
                            : 'var(--text-secondary, #64748b)',
                        border: `1px solid ${
                          batch.status === 'Aktif'
                            ? 'var(--color-success-border, #a7f3d0)'
                            : 'var(--border-default, #e2e8f0)'
                        }`,
                      }}
                    >
                      {batch.status || (batch.is_active_knowledge ? 'Aktif' : 'Draft')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

              {/* Right: Curation Status & AI Knowledge Base Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                {/* Curation Status Pill */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                  <span
                    style={{
                      fontSize: '10.5px',
                      color: 'var(--text-muted, #94a3b8)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
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
                        <span
                          style={{
                            padding: '3px 10px',
                            fontSize: '11.5px',
                            fontWeight: 500,
                            borderRadius: '9999px',
                            backgroundColor: 'var(--color-success-subtle, #ecfdf5)',
                            color: 'var(--color-success-text, #047857)',
                            border: '1px solid var(--color-success-border, #a7f3d0)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                          title={`Seluruh ${total} raw chunks telah selesai dikurasi menjadi ${insights.length} insight.`}
                        >
                          <CheckCircle2 size={12} />
                          <span>100% Terkurasi ({insights.length} Insight)</span>
                        </span>
                      );
                    }

                    if (processedCount > 0) {
                      const pct = Math.round((processedCount / total) * 100);
                      return (
                        <span
                          style={{
                            padding: '3px 10px',
                            fontSize: '11.5px',
                            fontWeight: 500,
                            borderRadius: '9999px',
                            backgroundColor: 'var(--color-warning-subtle, #fffbeb)',
                            color: 'var(--color-warning-text, #b45309)',
                            border: '1px solid var(--color-warning-border, #fde68a)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <span>{pct}% ({insights.length} Insight)</span>
                        </span>
                      );
                    }

                    return (
                      <span
                        style={{
                          padding: '3px 10px',
                          fontSize: '11.5px',
                          fontWeight: 500,
                          borderRadius: '9999px',
                          backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                          color: 'var(--text-muted, #94a3b8)',
                          border: '1px solid var(--border-default, #e2e8f0)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-warning, #f59e0b)' }} />
                        <span>Menunggu Kurasi</span>
                      </span>
                    );
                  })()}
                </div>

                {/* Vertical Divider */}
                <div style={{ width: '1px', height: '32px', backgroundColor: 'var(--border-default, #e2e8f0)' }} />

                {/* AI Knowledge Base Status & Action */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {(batch.curated_count || 0) === 0 ? (
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          color: 'var(--color-warning-text, #b45309)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: '#f59e0b',
                            boxShadow: '0 0 6px #f59e0b',
                          }}
                        />
                        Menunggu Kurasi (Belum Terkurasi)
                      </span>
                    ) : batch.is_active_knowledge ? (
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          color: 'var(--color-success-text, #047857)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-success, #10b981)',
                            boxShadow: '0 0 6px var(--color-success, #10b981)',
                          }}
                        />
                        Aktif di AI Chat
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 500,
                          color: 'var(--text-muted, #94a3b8)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--border-hover, #cbd5e1)',
                          }}
                        />
                        Standby (Non-aktif)
                      </span>
                    )}
                  </div>

                  {hasPermission('documents:toggle_active') && (
                    (batch.curated_count || 0) === 0 ? (
                      <button
                        onClick={() => {
                          setActiveTab('insights');
                          toast.info('Lakukan kurasi insight dokumen terlebih dahulu sebelum mengaktifkannya.');
                        }}
                        style={{
                          padding: '3px 12px',
                          fontSize: '11px',
                          borderRadius: '9999px',
                          fontWeight: 600,
                          color: '#b45309',
                          borderColor: '#fde68a',
                          backgroundColor: '#fffbeb',
                          border: '1px solid #fde68a',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          cursor: 'pointer',
                        }}
                        title="Buka tab Kurasi AI untuk mengkurasi dokumen ini"
                      >
                        <Sparkles size={11} />
                        <span>Mulai Kurasi AI</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleToggleActive}
                        style={{
                          padding: '3px 12px',
                          fontSize: '11px',
                          borderRadius: '9999px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          backgroundColor: batch.is_active_knowledge
                            ? 'var(--color-danger-subtle, #fef2f2)'
                            : 'var(--bg-subtle, #f1f5f9)',
                          color: batch.is_active_knowledge
                            ? 'var(--color-danger-text, #b91c1c)'
                            : 'var(--text-primary, #0f172a)',
                          border: `1px solid ${
                            batch.is_active_knowledge
                              ? 'var(--color-danger-border, #fecaca)'
                              : 'var(--border-default, #e2e8f0)'
                          }`,
                        }}
                        title="Klik untuk mengubah status dokumen dalam basis pencarian RAG Chat"
                      >
                        {batch.is_active_knowledge ? (
                          <>
                            <XCircle size={12} />
                            <span>Nonaktifkan dari Chat</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={12} />
                            <span>Aktifkan untuk Chat</span>
                          </>
                        )}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation (Brilian Segmented Pill Switcher) */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-subtle, #f1f5f9)',
            border: '1px solid var(--border-default, #e2e8f0)',
            borderRadius: '9999px',
            padding: '3px',
            gap: '3px',
            width: 'fit-content',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('insights')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '9999px',
              padding: '5px 14px',
              fontSize: '12px',
              height: '30px',
              fontWeight: activeTab === 'insights' ? 600 : 500,
              border: 'none',
              backgroundColor: activeTab === 'insights' ? 'var(--bg-card, #ffffff)' : 'transparent',
              color: activeTab === 'insights' ? 'var(--text-primary, #0f172a)' : 'var(--text-secondary, #64748b)',
              boxShadow: activeTab === 'insights' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <BookOpen
              size={13}
              style={{
                color: activeTab === 'insights' ? 'var(--color-primary, #2563eb)' : 'currentColor',
              }}
            />
            <span>Curated Insights</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '9999px',
                backgroundColor: activeTab === 'insights' ? 'var(--bg-subtle, #f1f5f9)' : 'rgba(0,0,0,0.04)',
                color: activeTab === 'insights' ? 'var(--text-primary, #0f172a)' : 'var(--text-secondary, #64748b)',
              }}
            >
              {insights.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chunks')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '9999px',
              padding: '5px 14px',
              fontSize: '12px',
              height: '30px',
              fontWeight: activeTab === 'chunks' ? 600 : 500,
              border: 'none',
              backgroundColor: activeTab === 'chunks' ? 'var(--bg-card, #ffffff)' : 'transparent',
              color: activeTab === 'chunks' ? 'var(--text-primary, #0f172a)' : 'var(--text-secondary, #64748b)',
              boxShadow: activeTab === 'chunks' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <Layers
              size={13}
              style={{
                color: activeTab === 'chunks' ? 'var(--color-primary, #2563eb)' : 'currentColor',
              }}
            />
            <span>Raw Chunks</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '9999px',
                backgroundColor: activeTab === 'chunks' ? 'var(--bg-subtle, #f1f5f9)' : 'rgba(0,0,0,0.04)',
                color: activeTab === 'chunks' ? 'var(--text-primary, #0f172a)' : 'var(--text-secondary, #64748b)',
              }}
            >
              {chunks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('metadata')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '9999px',
              padding: '5px 14px',
              fontSize: '12px',
              height: '30px',
              fontWeight: activeTab === 'metadata' ? 600 : 500,
              border: 'none',
              backgroundColor: activeTab === 'metadata' ? 'var(--bg-card, #ffffff)' : 'transparent',
              color: activeTab === 'metadata' ? 'var(--text-primary, #0f172a)' : 'var(--text-secondary, #64748b)',
              boxShadow: activeTab === 'metadata' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <Info
              size={13}
              style={{
                color: activeTab === 'metadata' ? 'var(--color-primary, #2563eb)' : 'currentColor',
              }}
            />
            <span>Specs & Metadata</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('grants')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '9999px',
              padding: '5px 14px',
              fontSize: '12px',
              height: '30px',
              fontWeight: activeTab === 'grants' ? 600 : 500,
              border: 'none',
              backgroundColor: activeTab === 'grants' ? 'var(--bg-card, #ffffff)' : 'transparent',
              color: activeTab === 'grants' ? 'var(--text-primary, #0f172a)' : 'var(--text-secondary, #64748b)',
              boxShadow: activeTab === 'grants' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <Users
              size={13}
              style={{
                color: activeTab === 'grants' ? 'var(--color-primary, #2563eb)' : 'currentColor',
              }}
            />
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
            isApiBatch={Boolean(batch?.original_filename?.startsWith('[API]'))}
          />
        )}

        {activeTab === 'chunks' && (
          <RawChunksTab
            chunks={chunks}
            isLoading={isLoading}
            curatedCount={insights.length}
            onStartCuration={() => setActiveTab('insights')}
            isApiBatch={Boolean(batch?.original_filename?.startsWith('[API]'))}
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
