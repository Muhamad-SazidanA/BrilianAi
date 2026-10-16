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
  MessageSquare,
  Shield,
  Lock,
  Building2,
  Calendar,
  Users,
  UploadCloud,
} from 'lucide-react';
import { UploadBatch, DocumentClassification, DocumentStatus } from '@/types/document';
import RenameModal from './RenameModal';
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
}: DocumentTableProps) {
  const { language, t } = useLanguage();
  const { hasPermission } = useUserSession();
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Controls Bar: Search, Filter Tabs, Refresh Button */}
      <div className="ui-card" style={{ padding: '0.65rem 0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Search box */}
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search
              size={13}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder={t('table.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-text"
              style={{ paddingLeft: '30px', borderRadius: 'var(--radius-xs)' }}
            />
          </div>

          {/* Filter Pills */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-app)',
              padding: '2px',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-default)',
              gap: '2px',
            }}
          >
            <button
              onClick={() => setFilterActive('all')}
              className={`btn btn-sm ${filterActive === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                borderRadius: 'var(--radius-xs)',
                padding: '3px 9px',
                fontSize: '11px',
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
                padding: '3px 9px',
                fontSize: '11px',
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
                padding: '3px 9px',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {t('table.filter_inactive')} ({batches.filter((b) => !b.is_active_knowledge).length})
            </button>
          </div>

          {/* Action Group: Activate All & Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

            {/* Upload New Document Action */}
            {onUpload && hasPermission('documents:upload') && (
              <button
                type="button"
                onClick={onUpload}
                className="btn btn-primary btn-sm"
                style={{ fontWeight: 600, gap: '6px' }}
              >
                <UploadCloud size={14} />
                <span>{t('dash.upload_new')}</span>
              </button>
            )}
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
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--bg-app)',
                    borderBottom: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <th style={{ padding: '7px 10px' }}>{t('table.col_doc')}</th>
                  <th style={{ padding: '7px 10px' }}>{t('table.col_pages')}</th>
                  <th style={{ padding: '7px 10px' }}>{t('table.col_chunks')}</th>
                  <th style={{ padding: '7px 10px' }}>{t('table.col_time')}</th>
                  <th style={{ padding: '7px 10px' }}>{t('table.col_curation')}</th>
                  <th style={{ padding: '7px 10px' }}>{t('table.col_status')}</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right' }}>{t('table.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.map((batch) => {
                  const formattedDate = formatDateTime(batch.uploaded_at, language);

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
                      <td style={{ padding: '7px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: 'var(--radius-xs)',
                              backgroundColor: 'var(--color-primary-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--color-primary)',
                              flexShrink: 0,
                            }}
                          >
                            <FileText size={13} />
                          </div>
                          <div>
                            <Link
                              href={`/documents/${batch.id}`}
                              style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}
                              className="hover:text-primary hover:underline"
                            >
                              {batch.original_filename}
                            </Link>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                              {/* Classification Badge (ABAC) */}
                              <span
                                className={`badge ${
                                  batch.classification === 'Publik'
                                    ? 'badge-success'
                                    : batch.classification === 'Rahasia'
                                    ? 'badge-warning'
                                    : batch.classification === 'Sangat Rahasia'
                                    ? 'badge-danger'
                                    : 'badge-neutral'
                                }`}
                                style={{ fontSize: '9.5px', padding: '1px 5px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                              >
                                {batch.classification === 'Sangat Rahasia' ? <Lock size={9} /> : <Shield size={9} />}
                                <span>{batch.classification || 'Internal'}</span>
                              </span>

                              {/* Division Tag */}
                              <span
                                className="badge badge-neutral"
                                style={{ fontSize: '9.5px', padding: '1px 5px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                              >
                                <Building2 size={9} />
                                <span>{batch.division_id || 'General'}</span>
                              </span>

                              {/* Version Tag */}
                              <span
                                className="badge badge-neutral font-mono"
                                style={{ fontSize: '9.5px', padding: '1px 5px' }}
                              >
                                v{batch.version || '1.0'}
                              </span>

                              {/* Explicit User Grant Badge */}
                              {batch.has_user_grant && (
                                <span
                                  className="badge badge-accent"
                                  style={{ fontSize: '9.5px', padding: '1px 5px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                  title="Anda memiliki hak akses khusus ke dokumen ini"
                                >
                                  <Users size={9} />
                                  <span>Akses Khusus</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Pages */}
                      <td style={{ padding: '7px 10px' }}>
                        <span className="badge badge-neutral font-mono" style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                          {batch.page_count} {language === 'en' ? 'pgs' : 'hal'}
                        </span>
                      </td>

                      {/* Chunks */}
                      <td style={{ padding: '7px 10px' }}>
                        <span className="badge badge-accent font-mono" style={{ fontSize: '9.5px', padding: '1px 5px' }}>{batch.chunk_count} chunks</span>
                      </td>

                      {/* Upload Date */}
                      <td style={{ padding: '7px 10px', color: 'var(--text-secondary)', fontSize: '11.5px' }}>
                        {formattedDate}
                      </td>

                      {/* Curation Status */}
                      <td style={{ padding: '7px 10px' }}>
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
                                  gap: '4px',
                                  fontSize: '10.5px',
                                  padding: '2px 6px',
                                  fontWeight: 600,
                                }}
                                title={`Seluruh ${total} raw chunks telah selesai dikurasi menjadi ${count} insight.`}
                              >
                                <CheckCircle2 size={11} />
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
                                  gap: '4px',
                                  fontSize: '10.5px',
                                  padding: '2px 6px',
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
                                gap: '4px',
                                fontSize: '10.5px',
                                padding: '2px 6px',
                                fontWeight: 600,
                                backgroundColor: 'var(--bg-subtle)',
                                color: 'var(--text-muted)',
                                border: '1px solid var(--border-default)',
                              }}
                            >
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-warning)' }} />
                              <span>{t('table.uncurated_badge')}</span>
                            </span>
                          );
                        })()}
                      </td>

                      {/* AI Knowledge Base Toggle (Separated Status and Clear Action Button) */}
                      <td style={{ padding: '7px 10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
                          {/* Lifecycle Badge */}
                          <span
                            className={`badge ${
                              batch.status === 'Aktif'
                                ? 'badge-success'
                                : batch.status === 'Review'
                                ? 'badge-warning'
                                : batch.status === 'Draft'
                                ? 'badge-neutral'
                                : 'badge-neutral'
                            }`}
                            style={{ fontSize: '10px', padding: '1px 6px', fontWeight: 600 }}
                          >
                            {batch.status || (batch.is_active_knowledge ? 'Aktif' : 'Draft')}
                          </span>

                          {/* AI RAG Indicator */}
                          {batch.is_active_knowledge ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '10px',
                                fontWeight: 600,
                                color: 'var(--color-success)',
                              }}
                            >
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
                              RAG Aktif
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '10px',
                                fontWeight: 500,
                                color: 'var(--text-muted)',
                              }}
                            >
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--border-default)' }} />
                              Standby
                            </span>
                          )}

                          {/* Review due date if set */}
                          {batch.review_due_date && (
                            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Calendar size={9} />
                              {new Date(batch.review_due_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                          )}

                          {/* Explicit Action Button */}
                          {hasPermission('documents:toggle_active') && (
                            <button
                              onClick={() => onToggleActive(batch.id, !batch.is_active_knowledge)}
                              className={`btn btn-xs ${batch.is_active_knowledge ? 'btn-ghost-danger' : 'btn-outline'}`}
                              style={{
                                padding: '1px 6px',
                                fontSize: '9.5px',
                                borderRadius: 'var(--radius-xs)',
                                fontWeight: 600,
                                marginTop: '1px',
                              }}
                              title={t('table.toggle_tooltip')}
                            >
                              {batch.is_active_knowledge ? (
                                <>
                                  <XCircle size={9} />
                                  <span>{t('table.action_deactivate')}</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={9} />
                                  <span>{t('table.action_activate')}</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          {hasPermission('chat:query') && (
                            <Link
                              href={`/chat?q=${encodeURIComponent(`Tolong jelaskan intisari dan ringkasan dari dokumen "${batch.original_filename}"`)}`}
                              className="btn btn-ghost btn-xs"
                              title="Tanya AI seputar dokumen ini"
                              style={{ color: 'var(--color-primary)', padding: '3px 5px' }}
                            >
                              <MessageSquare size={13} />
                            </Link>
                          )}
                          <Link
                            href={`/documents/${batch.id}`}
                            className="btn btn-ghost btn-xs"
                            title={t('table.open_studio_tooltip')}
                            style={{ padding: '3px 5px' }}
                          >
                            <ExternalLink size={13} />
                          </Link>
                          {hasPermission('documents:upload') && (
                            <button
                              onClick={() => setSelectedForRename(batch)}
                              className="btn btn-ghost btn-xs"
                              title={t('table.rename_tooltip')}
                              style={{ padding: '3px 5px' }}
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {hasPermission('documents:delete') && (
                            <button
                              onClick={() => onDelete(batch.id, batch.original_filename)}
                              className="btn btn-ghost-danger btn-xs"
                              title={t('table.delete_tooltip')}
                              style={{ padding: '3px 5px' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
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
