'use client';

import React from 'react';
import { BookCheck, CheckCircle2, PauseCircle, Files } from 'lucide-react';
import { UploadBatch } from '@/types/document';
import { useLanguage } from '@/context/LanguageContext';

interface DocumentStatsCardsProps {
  batches: UploadBatch[];
  activeFilter?: string | null;
  onSelectFilter?: (filter: string | null) => void;
}

export default function DocumentStatsCards({
  batches,
  activeFilter,
  onSelectFilter,
}: DocumentStatsCardsProps) {
  const { language, t } = useLanguage();

  // Compute counts strictly from actual batches data (defaults to 0 if none exist)
  const publishedCount = batches.filter((b) => b.is_active_knowledge !== false).length;
  const activeCount = batches.filter((b) => !!b.is_active_knowledge).length;
  const inactiveCount = batches.filter((b) => b.is_active_knowledge === false).length;
  const totalCount = batches.length;

  const cards = [
    {
      id: 'published',
      title: t('docs.card_published'),
      count: publishedCount,
      description: t('docs.card_published_desc'),
      badge: 'Brilian.Ai',
      icon: BookCheck,
      color: 'var(--color-success)',
      bgTint: 'var(--color-success-subtle)',
      borderColor: 'var(--color-success-border)',
      activeBorder: 'var(--color-success)',
      activeBg: 'var(--color-success-subtle)',
    },
    {
      id: 'active',
      title: t('docs.card_active'),
      count: activeCount,
      description: t('docs.card_active_desc'),
      badge: language === 'en' ? 'Active' : 'Aktif',
      icon: CheckCircle2,
      color: 'var(--color-primary)',
      bgTint: 'var(--color-primary-subtle)',
      borderColor: 'var(--color-primary-border)',
      activeBorder: 'var(--color-primary)',
      activeBg: 'var(--color-primary-subtle)',
    },
    {
      id: 'inactive',
      title: t('docs.card_inactive'),
      count: inactiveCount,
      description: t('docs.card_inactive_desc'),
      badge: language === 'en' ? 'Inactive' : 'Non-Aktif',
      icon: PauseCircle,
      color: 'var(--color-warning)',
      bgTint: 'var(--color-warning-subtle)',
      borderColor: 'var(--color-warning-border)',
      activeBorder: 'var(--color-warning)',
      activeBg: 'var(--color-warning-subtle)',
    },
    {
      id: 'total',
      title: t('docs.card_total'),
      count: totalCount,
      description: t('docs.card_total_desc'),
      badge: language === 'en' ? 'Repository' : 'Repositori',
      icon: Files,
      color: 'var(--text-primary)',
      bgTint: 'var(--bg-subtle)',
      borderColor: 'var(--border-default)',
      activeBorder: 'var(--text-secondary)',
      activeBg: 'var(--bg-subtle)',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
        marginBottom: '1.5rem',
      }}
    >
      {cards.map((card) => {
        const isSelected = activeFilter === card.id;
        const Icon = card.icon;

        return (
          <div
            key={card.id}
            onClick={() => onSelectFilter?.(isSelected ? null : card.id)}
            style={{
              backgroundColor: isSelected ? card.activeBg : 'var(--bg-card)',
              border: isSelected
                ? `1.5px solid ${card.activeBorder}`
                : '1px solid var(--border-default)',
              borderRadius: '12px',
              padding: '1.1rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '112px',
              boxShadow: isSelected
                ? `0 0 0 3px ${card.activeBorder}25, 0 1px 3px rgba(0,0,0,0.1)`
                : '0 1px 2px rgba(0,0,0,0.05)',
              cursor: onSelectFilter ? 'pointer' : 'default',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
            }}
            className="hover:shadow-md transition-all"
            title={`${language === 'en' ? 'Click to filter' : 'Klik untuk memfilter'}: ${card.title}`}
          >
            {/* Top Row: Title Label & Icon */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '10px',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-secondary, #64748B)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  lineHeight: '14px',
                }}
              >
                {card.title}
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: card.bgTint,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: card.color,
                  flexShrink: 0,
                }}
              >
                <Icon size={16} strokeWidth={2.2} />
              </div>
            </div>

            {/* Middle: Big Stat Number + Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '8px',
                marginBottom: '6px',
              }}
            >
              <span
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  color: card.color,
                  lineHeight: '32px',
                  letterSpacing: '-0.02em',
                }}
              >
                {card.count}
              </span>
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 600,
                  padding: '1px 7px',
                  borderRadius: '9999px',
                  backgroundColor: card.bgTint,
                  color: card.color,
                  border: `1px solid ${card.borderColor}`,
                }}
              >
                {card.badge}
              </span>
            </div>

            {/* Bottom Subtitle / Description */}
            <div
              style={{
                fontSize: '11.5px',
                color: 'var(--text-secondary, #64748B)',
                lineHeight: '15px',
                fontWeight: 500,
              }}
            >
              {card.description}
            </div>
          </div>
        );
      })}
    </div>
  );
}
