'use client';

import React from 'react';
import { FileText, Layers, BookCheck, FileCode, ArrowUpRight } from 'lucide-react';
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
      iconBg: 'var(--color-primary-subtle)',
      iconColor: 'var(--color-primary)',
      badge: 'Batches',
      badgeVariant: 'badge-accent',
    },
    {
      title: t('dash.stat_total_chunks'),
      value: stats?.totalChunks ?? 0,
      description: t('dash.stat_total_chunks_desc'),
      icon: Layers,
      iconBg: 'var(--bg-subtle)',
      iconColor: 'var(--text-primary)',
      badge: '800 char',
      badgeVariant: 'badge-neutral',
    },
    {
      title: t('dash.stat_active_ai'),
      value: stats?.activeKnowledgeCount ?? 0,
      description: t('dash.stat_active_ai_desc'),
      icon: BookCheck,
      iconBg: 'var(--color-success-subtle)',
      iconColor: 'var(--color-success)',
      badge: 'Curated',
      badgeVariant: 'badge-success',
    },
    {
      title: t('dash.stat_total_pages'),
      value: stats?.totalPages ?? 0,
      description: t('dash.stat_total_pages_desc'),
      icon: FileCode,
      iconBg: 'var(--color-warning-subtle)',
      iconColor: 'var(--color-warning)',
      badge: 'Qwen 2.5',
      badgeVariant: 'badge-warning',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2rem',
      }}
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.title} className="ui-card ui-card-interactive">
            {/* Header: Title & Icon */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {card.title}
              </span>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: card.iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: card.iconColor,
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                <Icon size={19} strokeWidth={2} />
              </div>
            </div>

            {/* Metric Value */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span
                style={{
                  fontSize: '32px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.03em',
                  lineHeight: '36px',
                }}
              >
                {isLoading ? '...' : card.value.toLocaleString(language === 'en' ? 'en-US' : 'id-ID')}
              </span>
              <span className={`badge ${card.badgeVariant}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                {card.badge}
              </span>
            </div>

            {/* Description */}
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '8px', fontWeight: 500 }}>
              {card.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
