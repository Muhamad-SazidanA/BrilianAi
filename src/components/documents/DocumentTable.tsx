'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  ExternalLink,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { UploadBatch } from '@/types/document';
import RenameModal from './RenameModal';
import { useLanguage } from '@/context/LanguageContext';

interface DocumentTableProps {
  batches: UploadBatch[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onDelete: (batchId: string, filename: string) => Promise<void>;
  onRename: (batchId: string, newFilename: string) => Promise<void>;
  onToggleActive: (batchId: string, active: boolean) => Promise<void>;
  onActivateAll?: () => Promise<void>;
}

export default function DocumentTable({
  batches,
  isLoading,
  onRefresh,
  onDelete,
  onRename,
  onToggleActive,
  onActivateAll,
}: DocumentTableProps) {
  const { language, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedForRename, setSelectedForRename] = useState<UploadBatch | null>(null);
  const [isActivatingAll, setIsActivatingAll] = useState(false);

  const inactiveCount = batches.filter((b) => !b.is_active_knowledge).length;

  // Filter batches
  const filteredBatches = batches.filter((batch) => {
    const matchesSearch = batch.original_filename.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterActive === 'active') return !!batch.is_active_knowledge;
    if (filterActive === 'inactive') return !batch.is_active_knowledge;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Controls Bar: Search, Filter Tabs, Refresh Button */}
      <div className="ui-card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Search box */}
          <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
            <Search
              size={16}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder={t('table.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-text"
              style={{ paddingLeft: '38px', borderRadius: 'var(--radius-sm)' }}
            />
          </div>

          {/* Filter Pills */}
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
              onClick={() => setFilterActive('all')}
              className={`btn btn-sm ${filterActive === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                borderRadius: 'var(--radius-xs)',
                padding: '5px 12px',
                fontSize: '12.5px',
                fontWeight: 600,
              }}
            >
              {t('table.filter_all')} ({batches.length})
            </button>
            <button
              onClick={() => setFilterActive('active')}
              className={`btn btn-sm ${filterActive === 'active' ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                borderRadius: 'var(--radius-xs)',
                padding: '5px 12px',
                fontSize: '12.5px',
                fontWeight: 600,
              }}
            >
              {t('table.filter_active')} ({batches.filter((b) => b.is_active_knowledge).length})
            </button>
            <button
              onClick={() => setFilterActive('inactive')}
              className={`btn btn-sm ${filterActive === 'inactive' ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                borderRadius: 'var(--radius-xs)',
                padding: '5px 12px',
                fontSize: '12.5px',
                fontWeight: 600,
              }}
            >
              {t('table.filter_inactive')} ({batches.filter((b) => !b.is_active_knowledge).length})
            </button>
          </div>

          {/* Action Group: Activate All & Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onActivateAll && inactiveCount > 0 && (
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
                className="btn btn-primary btn-sm"
                style={{ fontWeight: 600 }}
                title="Aktifkan seluruh dokumen yang masih Standby agar dapat langsung dijawab oleh AI Chatbot"
              >
                <CheckCircle2 size={14} className={isActivatingAll ? 'animate-spin' : ''} />
                <span>
                  {language === 'en'
                    ? `Activate All (${inactiveCount})`
                    : `Aktifkan Semua (${inactiveCount})`}
                </span>
              </button>
            )}

            {/* Refresh Action */}
            <button onClick={onRefresh} disabled={isLoading} className="btn btn-outline btn-sm">
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>{t('table.refresh')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table Card (Brilian.Ai Clean Look) */}
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
            <p style={{ fontSize: '13.5px', fontWeight: 500 }}>{t('table.loading')}</p>
          </div>
        ) : filteredBatches.length === 0 ? (
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
                color: 'var(--text-muted)',
              }}
            >
              <FileText size={24} />
            </div>
            <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
              {searchQuery ? t('table.empty_search_title') : t('table.empty_title')}
            </p>
            <p style={{ fontSize: '13px', marginTop: '4px', maxWidth: '340px', margin: '4px auto 0' }}>
              {searchQuery ? t('table.empty_search_desc') : t('table.empty_desc')}
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
                  <th style={{ padding: '14px 1.5rem' }}>{t('table.col_doc')}</th>
                  <th style={{ padding: '14px 1rem' }}>{t('table.col_pages')}</th>
                  <th style={{ padding: '14px 1rem' }}>{t('table.col_chunks')}</th>
                  <th style={{ padding: '14px 1rem' }}>{t('table.col_time')}</th>
                  <th style={{ padding: '14px 1rem' }}>{t('table.col_curation')}</th>
                  <th style={{ padding: '14px 1rem' }}>{t('table.col_status')}</th>
                  <th style={{ padding: '14px 1.5rem', textAlign: 'right' }}>{t('table.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.map((batch) => {
                  const formattedDate = new Date(batch.uploaded_at).toLocaleDateString(
                    language === 'en' ? 'en-US' : 'id-ID',
                    {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }
                  );

                  const isCurated = (batch.curated_count || 0) > 0;

                  return (
                    <tr
                      key={batch.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background-color 0.15s ease',
                      }}
                      className="hover:bg-subtle"
                    >
                      {/* Name & ID */}
                      <td style={{ padding: '14px 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--color-primary-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--color-primary)',
                              flexShrink: 0,
                            }}
                          >
                            <FileText size={18} />
                          </div>
                          <div>
                            <Link
                              href={`/documents/${batch.id}`}
                              style={{ fontWeight: 600, color: 'var(--text-primary)' }}
                              className="hover:text-primary hover:underline"
                            >
                              {batch.original_filename}
                            </Link>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                              ID: {batch.id.substring(0, 14)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Pages */}
                      <td style={{ padding: '14px 1rem' }}>
                        <span className="badge badge-neutral font-mono">
                          {batch.page_count} {language === 'en' ? 'pgs' : 'hal'}
                        </span>
                      </td>

                      {/* Chunks */}
                      <td style={{ padding: '14px 1rem' }}>
                        <span className="badge badge-accent font-mono">{batch.chunk_count} chunks</span>
                      </td>

                      {/* Upload Date */}
                      <td style={{ padding: '14px 1rem', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                        {formattedDate}
                      </td>

                      {/* Curation Status */}
                      <td style={{ padding: '14px 1rem' }}>
                        {(() => {
                          const total = batch.chunk_count || 0;
                          const processed = batch.processed_chunks || 0;
                          const count = batch.curated_count || 0;
                          const isCompleted = total > 0 && processed >= total;
                          const isPartial = processed > 0 && !isCompleted;

                          if (isCompleted) {
                            return (
                              <span
                                className="badge badge-success"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontSize: '11.5px',
                                  padding: '4px 8px',
                                  fontWeight: 600,
                                }}
                                title={`Seluruh ${total} raw chunks telah selesai dikurasi menjadi ${count} insight.`}
                              >
                                <CheckCircle2 size={12} />
                                <span>100% Terkurasi ({count} Insight)</span>
                              </span>
                            );
                          }

                          if (isPartial) {
                            const pct = Math.round((processed / total) * 100);
                            return (
                              <span
                                className="badge badge-warning"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontSize: '11.5px',
                                  padding: '4px 8px',
                                  fontWeight: 600,
                                }}
                                title={`${processed} dari ${total} raw chunk diproses.`}
                              >
                                <span>{pct}% ({count} Insight)</span>
                              </span>
                            );
                          }

                          return (
                            <span
                              className="badge"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '11.5px',
                                padding: '4px 8px',
                                fontWeight: 600,
                                backgroundColor: 'var(--bg-subtle)',
                                color: 'var(--text-muted)',
                                border: '1px solid var(--border-default)',
                              }}
                            >
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-warning)' }} />
                              <span>{t('table.uncurated_badge')}</span>
                            </span>
                          );
                        })()}
                      </td>

                      {/* AI Knowledge Base Toggle (Separated Status and Clear Action Button) */}
                      <td style={{ padding: '14px 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                          {/* Visual Status Indicator */}
                          {batch.is_active_knowledge ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: 'var(--color-success)',
                                letterSpacing: '0.02em',
                              }}
                            >
                              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--color-success)', boxShadow: '0 0 6px var(--color-success)' }} />
                              {t('table.status_active_rag')}
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                              }}
                            >
                              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--border-default)' }} />
                              {t('table.status_standby')}
                            </span>
                          )}

                          {/* Explicit Action Button */}
                          <button
                            onClick={() => onToggleActive(batch.id, !batch.is_active_knowledge)}
                            className={`btn btn-xs ${batch.is_active_knowledge ? 'btn-ghost-danger' : 'btn-outline'}`}
                            style={{
                              padding: '2px 8px',
                              fontSize: '11px',
                              borderRadius: 'var(--radius-xs)',
                              fontWeight: 600,
                            }}
                            title={t('table.toggle_tooltip')}
                          >
                            {batch.is_active_knowledge ? (
                              <>
                                <XCircle size={11} />
                                <span>{t('table.action_deactivate')}</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={11} />
                                <span>{t('table.action_activate')}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 1.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Link
                            href={`/documents/${batch.id}`}
                            className="btn btn-ghost btn-sm"
                            title={t('table.open_studio_tooltip')}
                          >
                            <ExternalLink size={15} />
                          </Link>
                          <button
                            onClick={() => setSelectedForRename(batch)}
                            className="btn btn-ghost btn-sm"
                            title={t('table.rename_tooltip')}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => onDelete(batch.id, batch.original_filename)}
                            className="btn btn-ghost-danger btn-sm"
                            title={t('table.delete_tooltip')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rename Modal */}
      <RenameModal
        batch={selectedForRename}
        isOpen={!!selectedForRename}
        onClose={() => setSelectedForRename(null)}
        onSave={onRename}
      />
    </div>
  );
}
