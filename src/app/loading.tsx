'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export default function GlobalLoading() {
  return (
    <div
      style={{
        minHeight: '70vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        color: 'var(--text-secondary)',
      }}
    >
      <Loader2
        size={28}
        className="animate-spin"
        style={{
          color: 'var(--color-accent, #2F5DFF)',
        }}
      />
      <span
        style={{
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--text-muted)',
          letterSpacing: '0.02em',
        }}
      >
        Memuat antarmuka...
      </span>
    </div>
  );
}
