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
} from 'lucide-react';
import { UploadBatch } from '@/types/document';
import RenameModal from './RenameModal';
import EnterprisePagination from '@/components/ui/EnterprisePagination';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
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
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedForRename, setSelectedForRename] = useState<UploadBatch | null>(null);
  const [isActivatingAll, setIsActivatingAll] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const inactiveCount = batches.filter((b) => !b.is_active_knowledge).length;
  const activeCount = batches.filter((b) => b.is_active_knowledge).length;

  // Filter batches
  const filteredBatches = batches.filter((batch) => {
    const matchesSearch = batch.original_filename.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterActive === 'active') return !!batch.is_active_knowledge;
    if (filterActive === 'inactive') return !batch.is_active_knowledge;
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
        {/* Left: Title + Inline Segmented Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {language === 'en' ? 'Verified Documents' : 'Arsip Dokumen'}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              · {batches.length} file
            </span>
          </div>

          {/* Segmented Filter Switcher */}
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
              onClick={() => setFilterActive('inactive')}
              style={{
                borderRadius: '9999px',
                padding: '2px 10px',
                fontSize: '11px',
                height: '22px',
                fontWeight: filterActive === 'inactive' ? 600 : 500,
                border: 'none',
                backgroundColor: filterActive === 'inactive' ? 'var(--bg-card, #ffffff)' : 'transparent',
                color: filterActive === 'inactive' ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: filterActive === 'inactive' ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {language === 'en' ? 'Standby' : 'Standby'} ({inactiveCount})
            </button>
          </div>
        </div>

        {/* Right: Slim Search + Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
          </div>

          {onActivateAll && inactiveCount > 0 && hasPermission('documents:toggle_active') && (
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
              style={{ fontWeight: 600, height: '26px', fontSize: '11px', gap: '4px', padding: '0 8px' }}
              title="Aktifkan seluruh dokumen yang masih Standby agar dapat langsung dijawab oleh AI Chatbot"
            >
              <CheckCircle2 size={12} className={isActivatingAll ? 'animate-spin' : ''} />
              <span>Aktifkan Semua ({inactiveCount})</span>
            </button>
          )}

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="btn btn-ghost btn-xs"
            style={{ height: '26px', width: '26px', padding: 0 }}
            title={t('table.refresh')}
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} color="var(--text-secondary)" />
          </button>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 1 }}>
                    <span className="skeleton-shimmer" style={{ width: '24px', height: '24px', borderRadius: '5px', flexShrink: 0 }} />
                    <span className="skeleton-shimmer" style={{ width: `${140 + n * 25}px`, height: '13px', borderRadius: '3px' }} />
                    <span className="skeleton-shimmer" style={{ width: '180px', height: '11px', borderRadius: '3px' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="skeleton-shimmer" style={{ width: '45px', height: '13px', borderRadius: '3px' }} />
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
              {paginatedBatches.map((batch, idx) => {
                const formattedDate = formatDateTime(batch.uploaded_at, language);

              return (
                <div
                  key={batch.id}
                  className="enterprise-list-item"
                  style={{
                    borderBottom: idx === filteredBatches.length - 1 ? 'none' : '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-card)',
                  }}
                >
                  {/* ── Left: File Icon + Title + Inline Strict Monochrome Metadata ── */}
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
                      <FileText size={13} />
                    </div>

                    <Link
                      href={`/documents/${batch.id}`}
                      style={{
                        fontWeight: 600,
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '280px',
                        flexShrink: 0,
                      }}
                      className="hover:underline"
                      title={batch.original_filename}
                    >
                      {batch.original_filename}
                    </Link>

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
                      <span>· {batch.page_count} Hal (OCR)</span>
                      <span>· {batch.chunk_count} Chunks</span>
                      <span>· {batch.classification || 'Internal'}</span>
                      <span>· {batch.division_id || 'General'}</span>
                      <span className="font-mono">· v{batch.version || '1.0'}</span>
                      {batch.has_user_grant && <span>· Akses Khusus</span>}
                      {batch.curated_count ? (
                        <span>· {batch.curated_count} Insight</span>
                      ) : (
                        <span>· Belum Terkurasi</span>
                      )}
                      <span>· {formattedDate}</span>
                    </div>
                  </div>

                  {/* ── Right: Live Status Dot + Sleek Actions ── */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {batch.is_active_knowledge ? (
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
                    {hasPermission('documents:toggle_active') && (
                      <button
                        onClick={() => onToggleActive(batch.id, !batch.is_active_knowledge)}
                        className="btn btn-ghost btn-xs"
                        style={{
                          fontSize: '10.5px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          color: 'var(--text-secondary)',
                          fontWeight: 500,
                        }}
                        title={batch.is_active_knowledge ? 'Nonaktifkan dari RAG AI' : 'Aktifkan untuk RAG AI'}
                      >
                        {batch.is_active_knowledge ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    )}

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
