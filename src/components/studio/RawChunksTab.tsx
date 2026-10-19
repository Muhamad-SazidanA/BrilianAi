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
    <div className="flex flex-col gap-4">
      {/* Uncurated Notification Banner */}
      {!isLoading && curatedCount === 0 && chunks.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200/80 dark:border-blue-900/50 rounded-2xl p-4 md:p-5 flex items-center justify-between gap-4 flex-wrap shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Sparkles size={18} className="animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs md:text-sm font-bold text-slate-900 dark:text-slate-100">
                {language === 'en'
                  ? 'Document is not yet curated'
                  : 'Dokumen ini belum memiliki kurasi insight'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'en'
                  ? `Extract key insights from ${chunks.length} raw chunks into structured knowledge cards with real-time 1-100% progress.`
                  : `Ekstrak intisari dari ${chunks.length} raw chunk menjadi kartu insight terstruktur dengan progres 1-100%.`}
              </p>
            </div>
          </div>

          {onStartCuration && (
            <button
              type="button"
              onClick={onStartCuration}
              className="h-8 px-4 rounded-full text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/25 transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={13} />
              <span>{language === 'en' ? 'Start AI Curation' : 'Mulai Kurasi AI'}</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}

      {/* Search Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100">
              Raw Chunks ({chunks.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('chunks.subtitle')}
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder={t('chunks.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-9 pr-3 rounded-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:bg-white transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Chunks List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2.5" />
          <p className="text-xs">{t('chunks.loading')}</p>
        </div>
      ) : filteredChunks.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
          <Layers size={36} strokeWidth={1.5} className="text-slate-300 mx-auto mb-2.5" />
          <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
            {search ? t('chunks.empty_search') : t('chunks.empty')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredChunks.map((chunk) => {
            const pageLabel =
              chunk.source_page_start === chunk.source_page_end
                ? `${t('chunks.page')} ${chunk.source_page_start}`
                : `${t('chunks.page')} ${chunk.source_page_start} - ${chunk.source_page_end}`;

            const isCopied = copiedId === chunk.id;

            return (
              <div
                key={chunk.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                {/* Chunk Header */}
                <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/80">
                      Chunk #{chunk.chunk_index}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60">
                      {pageLabel}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono text-slate-500 bg-slate-50 dark:bg-slate-800/60">
                      {chunk.content.length} {t('chunks.chars')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-mono bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/60">
                      Vector 1024-dim
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(chunk.id, chunk.content)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title={t('chunks.copy')}
                    >
                      {isCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      <span className="text-[11px]">{isCopied ? t('chunks.copied') : t('chunks.copy')}</span>
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

