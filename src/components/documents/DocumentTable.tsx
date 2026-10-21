'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  Search,
  CheckCircle2,
  Pencil,
  Trash2,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  UploadCloud,
  X,
  Sparkles,
  Loader2,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { UploadBatch } from '@/types/document';
import RenameModal from './RenameModal';
import EnterprisePagination from '@/components/ui/EnterprisePagination';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
import { useIngestion } from '@/context/IngestionContext';
import { formatDateTime } from '@lib/utils/formatters';

interface DocumentTableProps {
  batches: UploadBatch[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onDelete: (_batchId: string, _filename: string) => Promise<void>;
  onRename: (_batchId: string, _newFilename: string) => Promise<void>;
  onToggleActive: (_batchId: string, _active: boolean) => Promise<void>;
  onActivateAll?: () => Promise<void>;
  onUpload?: () => void;
  stickyTop?: number;
}

export default function DocumentTable({
  batches,
  isLoading,
  onRefresh,
  onDelete,
  onRename,
  onToggleActive,
  onActivateAll,
  onUpload,
  stickyTop,
}: DocumentTableProps) {
  const { language, t } = useLanguage();
  const { hasPermission } = useUserSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'pending' | 'standby'>('all');
  const [selectedForRename, setSelectedForRename] = useState<UploadBatch | null>(null);
  const [isActivatingAll, setIsActivatingAll] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Hook into active background ingestion tasks
  let activeIngestionTasks: Array<any> = [];
  try {
    const ingestion = useIngestion();
    activeIngestionTasks = (ingestion.tasks || []).filter(
      (t) => t.status !== 'completed' && t.status !== 'error'
    );
  } catch {
    // Graceful fallback
  }

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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 on search or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterActive]);

  // Klasifikasi Status Dokumen yang Ketat & Akurat
  const activeCount = batches.filter((b) => !!b.is_active_knowledge && (b.curated_count || 0) > 0).length;
  const pendingCount = batches.filter((b) => (b.curated_count || 0) === 0).length;
  const standbyCount = batches.filter((b) => !b.is_active_knowledge && (b.curated_count || 0) > 0).length;
  const activatableCount = standbyCount;

  // Filter batches
  const filteredBatches = batches.filter((batch) => {
    const matchesSearch = batch.original_filename.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterActive === 'active') return !!batch.is_active_knowledge && (batch.curated_count || 0) > 0;
    if (filterActive === 'pending') return (batch.curated_count || 0) === 0;
    if (filterActive === 'standby') return !batch.is_active_knowledge && (batch.curated_count || 0) > 0;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredBatches.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedBatches = filteredBatches.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  return (
    <>
      <div
        className="enterprise-card"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Unified Header Controls ── */}
        <div
          className="enterprise-card-header"
          style={{
            flexShrink: 0,
            flexWrap: 'wrap',
            gap: '8px',
            backgroundColor: 'var(--bg-card, #ffffff)',
            borderBottom: '1px solid var(--border-default, #e2e8f0)',
          }}
        >
        {/* Left: Page Title + Inline Segmented Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--text-primary)', lineHeight: 1.25 }}>
              {language === 'en' ? 'Knowledge Base' : 'Basis Pengetahuan'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
              {filteredBatches.length} {language === 'en' ? 'documents' : 'dokumen'}
            </div>
          </div>

          {/* Segmented Filter Switcher (Smooth Pill) */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-subtle, #f1f5f9)',
              border: '1px solid var(--border-default, #e2e8f0)',
              borderRadius: '9999px',
              padding: '2px',
              gap: '2px',
              height: '26px',
            }}
          >
            <button
              onClick={() => setFilterActive('all')}
              style={{
                borderRadius: '9999px',
                padding: '2px 10px',
                fontSize: '11px',
                height: '22px',
                fontWeight: filterActive === 'all' ? 600 : 500,
                border: 'none',
                backgroundColor: filterActive === 'all' ? 'var(--bg-card, #ffffff)' : 'transparent',
                color: filterActive === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: filterActive === 'all' ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {language === 'en' ? 'All' : 'Semua'} ({batches.length})
            </button>
            <button
              onClick={() => setFilterActive('active')}
              style={{
                borderRadius: '9999px',
                padding: '2px 10px',
                fontSize: '11px',
                height: '22px',
                fontWeight: filterActive === 'active' ? 600 : 500,
                border: 'none',
                backgroundColor: filterActive === 'active' ? 'var(--bg-card, #ffffff)' : 'transparent',
                color: filterActive === 'active' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: filterActive === 'active' ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {language === 'en' ? 'Active' : 'Aktif'} ({activeCount})
            </button>
            <button
              onClick={() => setFilterActive('pending')}
              style={{
                borderRadius: '9999px',
                padding: '2px 10px',
                fontSize: '11px',
                height: '22px',
                fontWeight: filterActive === 'pending' ? 600 : 500,
                border: 'none',
                backgroundColor: filterActive === 'pending' ? 'var(--bg-card, #ffffff)' : 'transparent',
                color: filterActive === 'pending' ? '#b45309' : 'var(--text-secondary)',
                boxShadow: filterActive === 'pending' ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {language === 'en' ? 'Pending Curation' : 'Menunggu Kurasi'} ({pendingCount})
            </button>
            <button
              onClick={() => setFilterActive('standby')}
              style={{
                borderRadius: '9999px',
                padding: '2px 10px',
                fontSize: '11px',
                height: '22px',
                fontWeight: filterActive === 'standby' ? 600 : 500,
                border: 'none',
                backgroundColor: filterActive === 'standby' ? 'var(--bg-card, #ffffff)' : 'transparent',
                color: filterActive === 'standby' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: filterActive === 'standby' ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {language === 'en' ? 'Standby' : 'Standby'} ({standbyCount})
            </button>
          </div>
        </div>

        {/* Right: Slim Search + Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Search box with smooth pill & Ctrl+K */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-subtle, #f8fafc)',
              border: '1px solid var(--border-default, #e2e8f0)',
              borderRadius: '9999px',
              padding: '0 8px 0 10px',
              height: '26px',
              width: '210px',
              gap: '6px',
            }}
          >
            <Search
              size={12}
              color="var(--text-muted)"
              style={{ flexShrink: 0 }}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={language === 'en' ? 'Search documents...' : 'Cari dokumen...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '11.5px',
                color: 'var(--text-primary)',
                padding: 0,
                minWidth: 0,
              }}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  display: 'flex',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: 0,
                }}
              >
                <X size={11} />
              </button>
            ) : (
              <kbd
                className="kbd-shortcut"
                style={{
                  fontSize: '9px',
                  padding: '1px 5px',
                  borderRadius: '9999px',
                  flexShrink: 0,
                }}
              >
                Ctrl K
              </kbd>
            )}
          </div>

          {onActivateAll && activatableCount > 0 && hasPermission('documents:toggle_active') && (
            <button
              onClick={async () => {
                setIsActivatingAll(true);
                try {
                  await onActivateAll();
                } finally {
                  setIsActivatingAll(false);
                }
              }}
              disabled={isLoading || isActivatingAll}
              className="btn btn-outline btn-xs"
              style={{ fontWeight: 600, height: '26px', fontSize: '11px', gap: '4px', padding: '0 8px', borderRadius: '9999px' }}
              title="Aktifkan seluruh dokumen terkurasi yang masih Standby agar dapat langsung dijawab oleh AI Chatbot"
            >
              <CheckCircle2 size={12} className={isActivatingAll ? 'animate-spin' : ''} />
              <span>Aktifkan Semua ({activatableCount})</span>
            </button>
          )}

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="btn btn-ghost btn-xs"
            style={{ height: '26px', width: '26px', padding: 0, borderRadius: '9999px' }}
            title={t('table.refresh')}
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} color="var(--text-secondary)" />
          </button>

          {onUpload && hasPermission('documents:upload') && (
            <button
              type="button"
              onClick={onUpload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '26px',
                padding: '0 11px',
                fontSize: '11.5px',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: '#ffffff',
                backgroundColor: '#0f172a',
                border: '1px solid #0f172a',
                borderRadius: '9999px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1e293b'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#0f172a'; }}
            >
              <UploadCloud size={11} strokeWidth={2.4} />
              <span>{language === 'en' ? 'Upload Document' : 'Unggah Dokumen'}</span>
            </button>
          )}
        </div>
      </div>
        <div
          className="enterprise-table-wrapper"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'auto',
          }}
        >
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <span className="skeleton-shimmer" style={{ width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                      <span className="skeleton-shimmer" style={{ width: `${140 + n * 25}px`, height: '13px', borderRadius: '3px' }} />
                      <span className="skeleton-shimmer" style={{ width: '200px', height: '10px', borderRadius: '3px' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="skeleton-shimmer" style={{ width: '55px', height: '14px', borderRadius: '3px' }} />
                    <span className="skeleton-shimmer" style={{ width: '60px', height: '20px', borderRadius: '4px' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredBatches.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              <FileText size={20} style={{ margin: '0 auto 6px', color: 'var(--text-muted)', opacity: 0.6 }} />
              <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>
                {searchQuery ? t('table.empty_search_title') : t('table.empty_title')}
              </p>
              <p style={{ fontSize: '11.5px', marginTop: '3px', color: 'var(--text-secondary)' }}>
                {searchQuery ? t('table.empty_search_desc') : t('table.empty_desc')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* ── Active Background Ingestion Live Progress Rows ── */}
              {activeIngestionTasks.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid #fde68a' }}>
                  {activeIngestionTasks.map((task) => (
                    <div
                      key={`task-${task.id}`}
                      className="enterprise-list-item"
                      style={{
                        backgroundColor: 'rgba(245, 158, 11, 0.05)',
                        borderBottom: '1px solid var(--border-default)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1, marginRight: '12px' }}>
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '5px',
                            backgroundColor: '#fef3c7',
                            color: '#d97706',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Loader2 size={13} className="animate-spin" />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: '13px',
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '280px',
                            }}
                            title={task.fileName}
                          >
                            {task.fileName}
                          </span>
                          <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 500 }}>
                            · {task.message || 'Memproses OCR & Vektorisasi...'}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <div
                          style={{
                            width: '90px',
                            height: '6px',
                            borderRadius: '9999px',
                            backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.max(10, task.progressPercent || 0)}%`,
                              backgroundColor: '#f59e0b',
                              borderRadius: '9999px',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            color: '#b45309',
                            backgroundColor: '#fffbeb',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            border: '1px solid #fde68a',
                          }}
                        >
                          <Loader2 size={10} className="animate-spin" />
                          {task.progressPercent || 0}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {paginatedBatches.map((batch, idx) => {
                const formattedDate = formatDateTime(batch.uploaded_at, language);
                const isTaskRunning = activeIngestionTasks.some(
                  (t) => t.result?.upload_batch_id === batch.id || t.fileName === batch.original_filename
                );
                const isCurated = (batch.curated_count || 0) > 0;
                const isApiBatch = batch.original_filename.startsWith('[API]');
                const cleanTitle = isApiBatch
                  ? batch.original_filename.replace(/^\[API\]\s*/, '')
                  : batch.original_filename;

              return (
                <div
                  key={batch.id}
                  className="enterprise-list-item"
                  style={{
                    borderBottom: idx === filteredBatches.length - 1 ? 'none' : '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-card)',
                  }}
                >
                  {/* ── Left: File/API Icon + 2-Line Hierarchy (Title/Badge + Clean Metadata) ── */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, marginRight: '16px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        backgroundColor: isApiBatch ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-subtle, #f1f5f9)',
                        color: isApiBatch ? '#2563eb' : 'var(--text-secondary, #64748b)',
                        border: isApiBatch ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid var(--border-default, #e2e8f0)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                      title={isApiBatch ? 'Sumber: Integrasi REST API (Live Ingest)' : 'Sumber: Dokumen PDF (OCR)'}
                    >
                      {isApiBatch ? <Globe size={14} /> : <FileText size={14} />}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                      {/* Line 1: Title + Subtle Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <Link
                          href={`/documents/${batch.id}`}
                          style={{
                            fontWeight: 600,
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '450px',
                          }}
                          className="hover:underline"
                          title={batch.original_filename}
                        >
                          {cleanTitle}
                        </Link>

                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '10px',
                            fontWeight: 600,
                            color: isApiBatch ? '#1d4ed8' : '#475569',
                            backgroundColor: isApiBatch ? '#eff6ff' : 'var(--bg-subtle, #f1f5f9)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            border: isApiBatch ? '1px solid #bfdbfe' : '1px solid var(--border-default, #e2e8f0)',
                            lineHeight: '14px',
                            flexShrink: 0,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {isApiBatch ? 'REST API' : 'PDF'}
                        </span>
                      </div>

                      {/* Line 2: Clean Muted Metadata (No redundant Belum Terkurasi) */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '11px',
                          color: 'var(--text-muted, #64748b)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        <span style={{ fontWeight: 500, color: 'var(--text-secondary, #475569)' }}>
                          {isApiBatch ? `${batch.page_count} Record` : `${batch.page_count} Hal (OCR)`}
                        </span>
                        <span>·</span>
                        <span>{batch.chunk_count} Chunks</span>
                        <span>·</span>
                        <span>{batch.classification || 'Internal'}</span>
                        <span>·</span>
                        <span>{batch.division_id || 'General'}</span>
                        <span>·</span>
                        <span className="font-mono">v{batch.version || '1.0'}</span>
                        {batch.has_user_grant && (
                          <>
                            <span>·</span>
                            <span style={{ color: '#2563eb', fontWeight: 500 }}>Akses Khusus</span>
                          </>
                        )}
                        {isCurated && (
                          <>
                            <span>·</span>
                            <span>{batch.curated_count} Insight</span>
                          </>
                        )}
                        <span>·</span>
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Right: Live Status Dot + Sleek Actions ── */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {isTaskRunning ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#b45309',
                          backgroundColor: '#fffbeb',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          border: '1px solid #fde68a',
                        }}
                      >
                        <Loader2 size={10} className="animate-spin" />
                        Memproses...
                      </span>
                    ) : !isCurated ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11px',
                          fontWeight: 500,
                          color: '#b45309',
                          backgroundColor: '#fffbeb',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          border: '1px solid #fde68a',
                        }}
                        title="Dokumen belum memiliki insight terkurasi. Kurasi sekarang agar dapat aktif di AI Chatbot."
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                        Menunggu Kurasi
                      </span>
                    ) : batch.is_active_knowledge ? (
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
                        Aktif
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
                        Standby
                      </span>
                    )}

                    <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-default)', margin: '0 2px' }} />

                    {/* Subtle Action Buttons */}
                    {!isCurated ? (
                      <Link
                        href={`/documents/${batch.id}?tab=insights`}
                        className="btn btn-outline btn-xs"
                        style={{
                          fontSize: '10.5px',
                          height: '22px',
                          padding: '0 8px',
                          borderRadius: '9999px',
                          color: '#b45309',
                          borderColor: '#fde68a',
                          backgroundColor: '#fffbeb',
                          gap: '4px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          textDecoration: 'none',
                        }}
                        title="Buka Document Studio untuk mengkurasi insight dokumen ini"
                      >
                        <Sparkles size={11} />
                        <span>Kurasi</span>
                      </Link>
                    ) : hasPermission('documents:toggle_active') ? (
                      <button
                        onClick={() => onToggleActive(batch.id, !batch.is_active_knowledge)}
                        className="btn btn-ghost btn-xs"
                        style={{
                          fontSize: '10.5px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          color: batch.is_active_knowledge ? 'var(--text-secondary)' : '#2563eb',
                          fontWeight: 500,
                        }}
                        title={batch.is_active_knowledge ? 'Nonaktifkan dari RAG AI' : 'Aktifkan untuk RAG AI'}
                      >
                        {batch.is_active_knowledge ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    ) : null}

                    {hasPermission('chat:query') && (
                      <Link
                        href={`/chat?q=${encodeURIComponent(`Tolong jelaskan intisari dokumen "${batch.original_filename}"`)}`}
                        className="btn btn-ghost btn-xs"
                        title="Tanya AI seputar dokumen ini"
                        style={{ padding: '3px 5px', color: 'var(--text-secondary)' }}
                      >
                        <MessageSquare size={12} />
                      </Link>
                    )}

                    <Link
                      href={`/documents/${batch.id}`}
                      className="btn btn-ghost btn-xs"
                      title="Buka Document Studio"
                      style={{ padding: '3px 5px', color: 'var(--text-secondary)' }}
                    >
                      <ExternalLink size={12} />
                    </Link>

                    {hasPermission('documents:upload') && (
                      <button
                        onClick={() => setSelectedForRename(batch)}
                        className="btn btn-ghost btn-xs"
                        title="Ubah Nama"
                        style={{ padding: '3px 5px', color: 'var(--text-secondary)' }}
                      >
                        <Pencil size={12} />
                      </button>
                    )}

                    {hasPermission('documents:delete') && (
                      <button
                        onClick={() => onDelete(batch.id, batch.original_filename)}
                        className="btn btn-ghost btn-xs"
                        title="Hapus Dokumen"
                        style={{ padding: '3px 5px', color: 'var(--text-muted)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>

        {/* ── Enterprise Pagination Bar (Always pinned at bottom) ── */}
        <EnterprisePagination
          currentPage={safeCurrentPage}
          totalItems={filteredBatches.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          language={language}
        />
      </div>

      {/* Rename Modal */}
      <RenameModal
        batch={selectedForRename}
        isOpen={!!selectedForRename}
        onClose={() => setSelectedForRename(null)}
        onSave={onRename}
      />
    </>
  );
}
