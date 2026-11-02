'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, MessageSquare } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import { useLanguage } from '@/context/LanguageContext';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  const { language } = useLanguage();

  useEffect(() => {
    // Log unexpected runtime client error
    console.error('[Brilian.Ai Global Error Boundary]:', error);
  }, [error]);

  return (
    <AppShell allowGuest={true}>
      <div
        className="ui-card"
        style={{
          maxWidth: '580px',
          margin: 'clamp(2.5rem, 12vh, 7rem) auto',
          padding: 'clamp(2rem, 5vw, 3.5rem)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--color-danger-border, #FECACA)',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-card)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            marginBottom: '1.25rem',
            borderRadius: '20px',
            background: 'var(--color-danger-subtle, #FEF2F2)',
            color: 'var(--color-danger, #D64545)',
          }}
        >
          <AlertTriangle size={32} strokeWidth={1.8} />
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <span
            className="badge badge-danger"
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {language === 'en' ? 'System Error' : 'Terjadi Kesalahan Sistem'}
          </span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(1.35rem, 2.5vw, 1.75rem)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.65rem',
            lineHeight: 1.3,
          }}
        >
          {language === 'en' ? 'Something went wrong' : 'Aplikasi Mengalami Kendala Tak Terduga'}
        </h1>

        <p
          style={{
            maxWidth: '460px',
            margin: '0 auto 1.25rem',
            color: 'var(--text-secondary)',
            fontSize: '13.5px',
            lineHeight: 1.6,
          }}
        >
          {language === 'en'
            ? 'An unexpected error occurred while rendering this view. You can attempt to recover by clicking retry below.'
            : 'Terjadi kegagalan saat memuat halaman ini. Silakan coba muat ulang komponen menggunakan tombol di bawah ini.'}
        </p>

        {error?.message && (
          <div
            style={{
              maxWidth: '480px',
              margin: '0 auto 1.5rem',
              padding: '10px 14px',
              background: 'var(--color-mist)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              textAlign: 'left',
              wordBreak: 'break-word',
              maxHeight: '120px',
              overflowY: 'auto',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>Error: </span>
            {error.message}
            {error.digest && (
              <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                Digest: {error.digest}
              </div>
            )}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            className="btn btn-primary btn-md"
            onClick={() => reset()}
          >
            <RefreshCw size={15} />
            {language === 'en' ? 'Try again' : 'Coba Lagi'}
          </button>
          <Link href="/chat" className="btn btn-outline btn-md">
            <MessageSquare size={15} />
            {language === 'en' ? 'Back to chat' : 'Kembali ke Chat'}
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
