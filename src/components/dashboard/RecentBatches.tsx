'use client';

import React from 'react';
import Link from 'next/link';
import { FileText, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { UploadBatch } from '@/types/document';
import { useLanguage } from '@/context/LanguageContext';
import { formatDateTime } from '@lib/utils/formatters';

interface RecentBatchesProps {
  batches: UploadBatch[];
  isLoading: boolean;
}

export default function RecentBatches({ batches, isLoading }: RecentBatchesProps) {
  const { language, t } = useLanguage();

  return (
    <div className="ui-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.65rem' }}>
        <div>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('dash.recent_title')}
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>
            {t('dash.recent_subtitle')}
          </p>
        </div>
        <Link href="/documents" className="btn btn-ghost btn-xs" style={{ gap: '3px', fontSize: '11px' }}>
          <span>{t('dash.see_all')}</span>
          <ChevronRight size={12} />
        </Link>
      </div>

      {/* Card Content */}
      {isLoading ? (
        <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div
            className="animate-spin"
            style={{
              width: '18px',
              height: '18px',
              border: '2px solid var(--border-default)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              margin: '0 auto 8px',
            }}
          />
          <p style={{ fontSize: '11.5px' }}>{t('dash.loading_activity')}</p>
        </div>
      ) : batches.length === 0 ? (
        <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 10px',
              color: 'var(--text-muted)',
            }}
          >
            <FileText size={18} />
          </div>
          <p style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
            {t('dash.empty_recent_title')}
          </p>
          <p style={{ fontSize: '11.5px', marginTop: '2px', maxWidth: '300px', margin: '2px auto 0' }}>
            {t('dash.empty_recent_desc')}
          </p>
          <Link href="/upload" className="btn btn-primary btn-xs" style={{ marginTop: '10px' }}>
            {t('dash.start_upload')}
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {batches.map((batch) => {
            const formattedDate = formatDateTime(batch.uploaded_at, language);

            return (
              <Link
                key={batch.id}
                href={`/documents/${batch.id}`}
                className="ui-card-interactive"
                style={{
                  padding: '7px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Left: icon + filename + details */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
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

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {batch.original_filename}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11.5px',
                        color: 'var(--text-secondary)',
                        marginTop: '1px',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={10} />
                        {formattedDate}
                      </span>
                      <span>·</span>
                      <span className="font-mono">{batch.page_count} {language === 'en' ? 'Pgs' : 'Hal'}</span>
                      <span>·</span>
                      <span className="font-mono">{batch.chunk_count} Chunks</span>
                    </div>
                  </div>
                </div>

                {/* Right: status badge & arrow */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {batch.is_active_knowledge ? (
                    <span className="badge badge-success" style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                      <CheckCircle2 size={10} />
                      {t('table.status_active')}
                    </span>
                  ) : (
                    <span className="badge badge-neutral" style={{ fontSize: '9.5px', padding: '1px 5px' }}>{t('table.status_inactive')}</span>
                  )}
                  <ChevronRight size={13} color="var(--text-muted)" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
