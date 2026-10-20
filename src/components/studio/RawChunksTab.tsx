'use client';

import React, { useState } from 'react';
import { Search, Layers, Copy, Check, Sparkles, ArrowRight } from 'lucide-react';
import { DocumentChunk } from '@/types/document';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface RawChunksTabProps {
  chunks: DocumentChunk[];
  isLoading: boolean;
  curatedCount?: number;
  onStartCuration?: () => void;
}

export default function RawChunksTab({
  chunks,
  isLoading,
  curatedCount = 0,
  onStartCuration,
}: RawChunksTabProps) {
  const { language, t } = useLanguage();
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  const filteredChunks = chunks.filter((c) =>
    c.content.toLowerCase().includes(search.toLowerCase())
  );

  const handleCopy = (id: string | number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(
      language === 'en'
        ? 'Chunk text copied to clipboard'
        : 'Teks chunk disalin ke clipboard'
    );
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Uncurated Notification Banner */}
      {!isLoading && curatedCount === 0 && chunks.length > 0 && (
        <div
          style={{
            padding: '1.25rem 1.5rem',
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px dashed var(--border-default, #e2e8f0)',
            borderRadius: 'var(--radius-lg, 12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary-subtle, #eff6ff)',
                color: 'var(--color-primary, #2563eb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                {language === 'en'
                  ? 'Document is not yet curated'
                  : 'Dokumen ini belum memiliki kurasi insight'}
              </h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary, #64748b)', margin: '2px 0 0' }}>
                {language === 'en'
                  ? `Extract key insights from ${chunks.length} raw chunks into structured knowledge cards with real-time 1-100% progress.`
                  : `Ekstrak intisari dari ${chunks.length} raw chunk menjadi kartu insight terstruktur dengan progres 1-100%.`}
              </p>
            </div>
          </div>

          {onStartCuration && (
            <button
              onClick={onStartCuration}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '11.5px',
                fontWeight: 600,
                backgroundColor: 'var(--text-primary, #0f172a)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Sparkles size={13} />
              <span>{language === 'en' ? 'Start AI Curation' : 'Mulai Kurasi AI'}</span>
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      )}

      {/* Search Header */}
      <div
        style={{
          padding: '1.125rem 1.5rem',
          borderRadius: 'var(--radius-lg, 12px)',
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-default, #e2e8f0)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
              Raw Chunks <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted, #94a3b8)', fontWeight: 500 }}>({chunks.length})</span>
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary, #64748b)', margin: '2px 0 0' }}>
              {t('chunks.subtitle')}
            </p>
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search
              size={14}
              color="var(--text-muted, #94a3b8)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder={t('chunks.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                height: '32px',
                borderRadius: '9999px',
                paddingLeft: '34px',
                paddingRight: '12px',
                fontSize: '12px',
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                border: '1px solid var(--border-default, #e2e8f0)',
                color: 'var(--text-primary, #0f172a)',
                outline: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* Chunks List */}
      {isLoading ? (
        <div style={{ padding: '3.5rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div className="animate-spin" style={{ width: '26px', height: '26px', border: '2px solid var(--border-default)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', margin: '0 auto 10px' }} />
          <p style={{ fontSize: '13px' }}>{t('chunks.loading')}</p>
        </div>
      ) : filteredChunks.length === 0 ? (
        <div
          style={{
            padding: '3.5rem 0',
            textAlign: 'center',
            backgroundColor: 'var(--bg-card, #ffffff)',
            borderRadius: 'var(--radius-lg, 12px)',
            border: '1px solid var(--border-default, #e2e8f0)',
          }}
        >
          <Layers size={32} strokeWidth={1.5} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
          <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
            {search ? t('chunks.empty_search') : t('chunks.empty')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredChunks.map((chunk) => {
            const pageLabel =
              chunk.source_page_start === chunk.source_page_end
                ? `Hal. ${chunk.source_page_start}`
                : `Hal. ${chunk.source_page_start} - ${chunk.source_page_end}`;

            const isCopied = copiedId === chunk.id;

            return (
              <div
                key={chunk.id}
                style={{
                  padding: '14px 16px',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  borderRadius: 'var(--radius-md, 10px)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {/* Chunk Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '1px 8px',
                        borderRadius: '9999px',
                        backgroundColor: 'var(--color-primary-subtle, #eff6ff)',
                        color: 'var(--color-primary, #2563eb)',
                        border: '1px solid var(--color-primary-border, #bfdbfe)',
                      }}
                    >
                      Chunk #{chunk.chunk_index}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        padding: '1px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                        color: 'var(--text-secondary, #64748b)',
                        border: '1px solid var(--border-default, #e2e8f0)',
                      }}
                    >
                      {pageLabel}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
                      {chunk.content.length} {t('chunks.chars')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
                      Dense Vector (1024-dim)
                    </span>
                    <button
                      onClick={() => handleCopy(chunk.id, chunk.content)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        border: '1px solid var(--border-default, #e2e8f0)',
                        backgroundColor: 'transparent',
                        fontSize: '11px',
                        color: isCopied ? 'var(--color-success, #10b981)' : 'var(--text-secondary, #64748b)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      title={t('chunks.copy')}
                    >
                      {isCopied ? <Check size={12} color="var(--color-success, #10b981)" /> : <Copy size={12} />}
                      <span>{isCopied ? t('chunks.copied') : t('chunks.copy')}</span>
                    </button>
                  </div>
                </div>

                {/* Chunk Text Body */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-subtle, #f8fafc)',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm, 8px)',
                    fontSize: '13px',
                    lineHeight: '21px',
                    color: 'var(--text-primary, #0f172a)',
                    whiteSpace: 'pre-wrap',
                    border: '1px solid var(--border-default, #e2e8f0)',
                  }}
                >
                  {chunk.content}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

