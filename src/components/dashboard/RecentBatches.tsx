'use client';

import React from 'react';
import Link from 'next/link';
import { FileText, ArrowRight, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { UploadBatch } from '@/types/document';
import { useLanguage } from '@/context/LanguageContext';

interface RecentBatchesProps {
  batches: UploadBatch[];
  isLoading: boolean;
}

export default function RecentBatches({ batches, isLoading }: RecentBatchesProps) {
  const { language, t } = useLanguage();

  return (
    <div className="ui-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Card Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-default)', paddingBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('dash.recent_title')}
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {t('dash.recent_subtitle')}
          </p>
        </div>
        <Link href="/documents" className="btn btn-ghost btn-sm" style={{ gap: '4px', fontSize: '13px' }}>
          <span>{t('dash.see_all')}</span>
          <ChevronRight size={15} />
        </Link>
      </div>

      {/* Card Content */}
      {isLoading ? (
        <div style={{ padding: '2.5rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div
            className="animate-spin"
            style={{
              width: '22px',
              height: '22px',
              border: '2px solid var(--border-default)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              margin: '0 auto 10px',
            }}
          />
          <p style={{ fontSize: '13px' }}>{t('dash.loading_activity')}</p>
        </div>
      ) : batches.length === 0 ? (
        <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
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
          <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
            {t('dash.empty_recent_title')}
          </p>
          <p style={{ fontSize: '12.5px', marginTop: '4px', maxWidth: '320px', margin: '4px auto 0' }}>
            {t('dash.empty_recent_desc')}
          </p>
          <Link href="/upload" className="btn btn-primary btn-sm" style={{ marginTop: '14px' }}>
            {t('dash.start_upload')}
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {batches.map((batch) => {
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

            return (
              <Link
                key={batch.id}
                href={`/documents/${batch.id}`}
                className="ui-card-interactive"
                style={{
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Left: icon + filename + details */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
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

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '13.5px',
                        fontWeight: 600,
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
                        gap: '8px',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        marginTop: '2px',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={11} />
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  {batch.is_active_knowledge ? (
                    <span className="badge badge-success">
                      <CheckCircle2 size={11} />
                      {t('table.status_active')}
                    </span>
                  ) : (
                    <span className="badge badge-neutral">{t('table.status_inactive')}</span>
                  )}
                  <ChevronRight size={16} color="var(--text-muted)" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
