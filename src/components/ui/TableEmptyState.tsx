'use client';

import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

export interface TableEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

export function TableEmptyState({
  icon: Icon,
  title,
  description,
  action,
  style,
}: TableEmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        margin: 'auto',
        height: '100%',
        minHeight: '220px',
        textAlign: 'center',
        userSelect: 'none',
        ...style,
      }}
    >
      {Icon && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm, 4px)',
            backgroundColor: 'var(--color-mist, #F6F6F4)',
            border: '1px solid var(--color-hairline, #E7E7E5)',
            color: 'var(--color-slate, #6B7078)',
            marginBottom: '10px',
          }}
        >
          <Icon size={18} strokeWidth={1.75} />
        </div>
      )}
      <p
        style={{
          margin: 0,
          fontWeight: 600,
          color: 'var(--color-ink, #14161B)',
          fontSize: '13px',
          lineHeight: 1.4,
        }}
      >
        {title}
      </p>
      {description && (
        <p
          style={{
            margin: '4px 0 0',
            fontSize: '11.5px',
            color: 'var(--color-slate, #6B7078)',
            maxWidth: '420px',
            lineHeight: 1.45,
          }}
        >
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: '12px' }}>{action}</div>}
    </div>
  );
}

export function TableLoadingState({
  message = 'Memuat data...',
  style,
}: {
  message?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        margin: 'auto',
        height: '100%',
        minHeight: '220px',
        textAlign: 'center',
        userSelect: 'none',
        ...style,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12.5px',
          color: 'var(--color-slate, #6B7078)',
        }}
      >
        <Loader2 size={16} className="animate-spin" color="var(--color-ink, #14161B)" />
        <span>{message}</span>
      </div>
    </div>
  );
}

export default TableEmptyState;
