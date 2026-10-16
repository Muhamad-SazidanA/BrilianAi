'use client';

import React from 'react';
import { FileText, Layers, BookCheck, FileCode } from 'lucide-react';
import { DashboardStats } from '@/types/stats';
import { useLanguage } from '@/context/LanguageContext';

interface StatCardsProps {
  stats: DashboardStats | null;
  isLoading: boolean;
}

export default function StatCards({ stats, isLoading }: StatCardsProps) {
  const { language, t } = useLanguage();

  const cards = [
    {
      title: t('dash.stat_total_docs'),
      value: stats?.totalDocuments ?? 0,
      description: t('dash.stat_total_docs_desc'),
      icon: FileText,
      badge: 'Batches',
    },
    {
      title: t('dash.stat_total_chunks'),
      value: stats?.totalChunks ?? 0,
      description: t('dash.stat_total_chunks_desc'),
      icon: Layers,
      badge: '800 char',
    },
    {
      title: t('dash.stat_active_ai'),
      value: stats?.activeKnowledgeCount ?? 0,
      description: t('dash.stat_active_ai_desc'),
      icon: BookCheck,
      badge: 'Curated',
    },
    {
      title: t('dash.stat_total_pages'),
      value: stats?.totalPages ?? 0,
      description: t('dash.stat_total_pages_desc'),
      icon: FileCode,
      badge: 'Vision OCR',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1rem',
      }}
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.title} className="ui-card ui-card-interactive" style={{ padding: '0.65rem 0.85rem' }}>
            {/* Header: Title & Icon */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {card.title}
              </span>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={13} strokeWidth={2} />
              </div>
            </div>

            {/* Metric Value */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                  lineHeight: '22px',
                }}
              >
                {isLoading ? '...' : card.value.toLocaleString(language === 'en' ? 'en-US' : 'id-ID')}
              </span>
              <span className="badge badge-neutral" style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                {card.badge}
              </span>
            </div>

            {/* Description */}
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 400 }}>
              {card.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
