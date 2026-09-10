'use client';

import React, { useState } from 'react';
import { Search, Layers, Copy, Check, FileText, Sparkles, ArrowRight } from 'lucide-react';
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
          className="ui-card"
          style={{
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-subtle) 100%)',
            border: '1px solid var(--color-primary-subtle)',
            borderRadius: 'var(--radius-lg)',
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
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary-subtle)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {language === 'en'
                  ? 'Document is not yet curated'
                  : 'Dokumen ini belum memiliki kurasi insight'}
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {language === 'en'
                  ? `Extract key insights from ${chunks.length} raw chunks into structured knowledge cards with real-time 1-100% progress.`
                  : `Ekstrak intisari dari ${chunks.length} raw chunk menjadi kartu insight terstruktur dengan loading persentase 1-100%.`}
              </p>
            </div>
          </div>

          {onStartCuration && (
            <button
              onClick={onStartCuration}
              className="btn btn-primary btn-sm"
              style={{ padding: '8px 16px', fontWeight: 600 }}
            >
              <Sparkles size={14} />
              <span>{language === 'en' ? 'Start AI Curation' : 'Mulai Kurasi AI'}</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}

      {/* Search Header */}
      <div className="ui-card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Raw Chunks ({chunks.length})
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {t('chunks.subtitle')}
            </p>
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search
              size={15}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder={t('chunks.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-text"
              style={{ paddingLeft: '36px', fontSize: '13px' }}
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
        <div className="ui-card" style={{ padding: '3.5rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Layers size={38} strokeWidth={1.25} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
          <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
            {search ? t('chunks.empty_search') : t('chunks.empty')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredChunks.map((chunk) => {
            const pageLabel =
              chunk.source_page_start === chunk.source_page_end
                ? `${t('chunks.page')} ${chunk.source_page_start}`
                : `${t('chunks.page')} ${chunk.source_page_start} - ${chunk.source_page_end}`;

            const isCopied = copiedId === chunk.id;

            return (
              <div key={chunk.id} className="ui-card" style={{ padding: '1.25rem' }}>
                {/* Chunk Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-accent">Chunk #{chunk.chunk_index}</span>
                    <span className="badge badge-neutral">{pageLabel}</span>
                    <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                      {chunk.content.length} {t('chunks.chars')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-neutral font-mono" style={{ fontSize: '11px' }}>
                      Dense Vector (1024-dim)
                    </span>
                    <button
                      onClick={() => handleCopy(chunk.id, chunk.content)}
                      className="btn btn-ghost btn-sm"
                      title={t('chunks.copy')}
                    >
                      {isCopied ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                      <span style={{ fontSize: '12px' }}>{isCopied ? t('chunks.copied') : t('chunks.copy')}</span>
                    </button>
                  </div>
                </div>

                {/* Chunk Text Body */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-app)',
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13.5px',
                    lineHeight: '22px',
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-wrap',
                    border: '1px solid var(--border-default)',
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

