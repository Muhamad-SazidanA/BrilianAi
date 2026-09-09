'use client';

import React from 'react';
import { X, FileText, Layers, Percent, ExternalLink } from 'lucide-react';
import { ChatSource } from '@/types/chat';
import { useLanguage } from '@/context/LanguageContext';

interface CitationDrawerProps {
  source: ChatSource | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function CitationDrawer({ source, isOpen, onClose }: CitationDrawerProps) {
  const { language, t } = useLanguage();

  if (!isOpen || !source) return null;

  const similarityPercent = Math.round((source.similarity || 0) * 100);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          height: '100%',
          backgroundColor: 'var(--bg-card)',
          borderLeft: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-float)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
          gap: '1.25rem',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-default)', paddingBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('chat.drawer_badge')}
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
              {t('chat.drawer_title')}
            </h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* File & Page info */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-subtle)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} color="var(--color-primary)" />
            <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
              {source.filename}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="badge badge-accent">
              {language === 'en' ? 'Page' : 'Halaman'} {source.pageStart === source.pageEnd ? source.pageStart : `${source.pageStart} - ${source.pageEnd}`}
            </span>
            <span className="badge badge-neutral font-mono">
              Chunk #{source.chunkId}
            </span>
            <span className="badge badge-success">
              {language === 'en' ? 'Relevance' : 'Relevansi'}: {similarityPercent}%
            </span>
          </div>
        </div>

        {/* Exact chunk text */}
        <div>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            {t('chat.original_text')}
          </div>
          <div
            style={{
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '14px',
              fontSize: '13px',
              lineHeight: '21px',
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              maxHeight: '400px',
              overflowY: 'auto',
            }}
          >
            {source.content}
          </div>
        </div>

        {/* Footer info */}
        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-default)', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {t('chat.drawer_footnote')}
        </div>
      </div>
    </div>
  );
}
