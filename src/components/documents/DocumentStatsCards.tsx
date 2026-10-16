'use client';

import React from 'react';
import { BookCheck, CheckCircle2, PauseCircle, Files } from 'lucide-react';
import { UploadBatch } from '@/types/document';
import { useLanguage } from '@/context/LanguageContext';

interface DocumentStatsCardsProps {
  batches: UploadBatch[];
  activeFilter?: string | null;
  onSelectFilter?: (_filter: string | null) => void;
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '10px',
        marginBottom: '1rem',
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
              borderRadius: '8px',
              padding: '0.65rem 0.85rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '78px',
              boxShadow: isSelected
                ? `0 0 0 2px ${card.activeBorder}25, 0 1px 2px rgba(0,0,0,0.08)`
                : '0 1px 2px rgba(0,0,0,0.04)',
              cursor: onSelectFilter ? 'pointer' : 'default',
              transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
            }}
            className="hover:shadow-sm transition-all"
            title={`${language === 'en' ? 'Click to filter' : 'Klik untuk memfilter'}: ${card.title}`}
          >
            {/* Top Row: Title Label & Icon */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '6px',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'var(--text-secondary, #64748B)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  lineHeight: '13px',
                }}
              >
                {card.title}
              </span>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  backgroundColor: card.bgTint,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: card.color,
                  flexShrink: 0,
                }}
              >
                <Icon size={13} strokeWidth={2.2} />
              </div>
            </div>

            {/* Middle: Big Stat Number + Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '6px',
                marginBottom: '4px',
              }}
            >
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: card.color,
                  lineHeight: '22px',
                  letterSpacing: '-0.02em',
                }}
              >
                {card.count}
              </span>
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 600,
                  padding: '1px 5px',
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
                fontSize: '11px',
                color: 'var(--text-secondary, #64748B)',
                lineHeight: '14px',
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
