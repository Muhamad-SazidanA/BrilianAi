'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export interface DashboardMetricCardProps {
  title: string;
  subtitle?: string;
  value: string | number;
  badge?: string;
  badgeType?: 'success' | 'warning' | 'neutral' | 'accent';
  footerText?: string;
  href?: string;
  onClick?: () => void;
  isLoading?: boolean;
  statusDot?: 'live' | 'blue' | 'none';
}

export default function DashboardMetricCard({
  title,
  subtitle,
  value,
  badge,
  badgeType = 'neutral',
  footerText,
  href,
  onClick,
  isLoading = false,
  statusDot = 'none',
}: DashboardMetricCardProps) {
  const content = (
    <div
      onClick={onClick}
      className={`enterprise-card ${href || onClick ? 'hover-elevate cursor-pointer' : ''}`}
      style={{
        padding: '12px 16px',
        justifyContent: 'space-between',
        minHeight: '96px',
        position: 'relative',
      }}
    >
      {/* ── 1. Top Row: Title + Live Status Dot + Arrow ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          {statusDot === 'live' && <span className="pulse-dot-live" />}
          {statusDot === 'blue' && <span className="pulse-dot-blue" />}
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: 500,
              color: 'var(--text-secondary, #64748b)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={title}
          >
            {title}
          </span>
        </div>

        {href && (
          <div style={{ color: 'var(--text-muted, #94a3b8)', flexShrink: 0, opacity: 0.8 }}>
            <ArrowUpRight size={13} strokeWidth={2.2} />
          </div>
        )}
      </div>

      {/* ── 2. Middle Row: Main Metric Value (NEVER WRAPS TO 2 LINES) ── */}
      <div style={{ margin: '6px 0 5px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        {isLoading ? (
          <span className="skeleton-shimmer" style={{ width: '80px', height: '20px', borderRadius: '4px' }} />
        ) : (
          <span
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text-primary, #0f172a)',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              fontFeatureSettings: '"tnum"',
              whiteSpace: 'nowrap', // Menjamin teks angka dan satuan selalu 1 baris utuh
            }}
          >
            {value}
          </span>
        )}
      </div>

      {/* ── 3. Bottom Row: Badge + Context Subtext (On its own dedicated line) ── */}
      {(badge || footerText) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            minWidth: 0,
          }}
        >
          {badge && !isLoading && (
            <span
              className={`badge badge-${badgeType}`}
              style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: '9999px',
                lineHeight: '13px',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {badge}
            </span>
          )}

          {footerText && (
            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-muted, #94a3b8)',
                fontWeight: 400,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={footerText}
            >
              {footerText}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        {content}
      </Link>
    );
  }

  return content;
}
