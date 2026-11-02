'use client';

import React from 'react';
import Link from 'next/link';
import { FileQuestion, MessageSquare, FolderTree, ArrowLeft } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import { useLanguage } from '@/context/LanguageContext';

export default function NotFound() {
  const { language } = useLanguage();

  return (
    <AppShell allowGuest={true}>
      <div
        className="ui-card"
        style={{
          maxWidth: '560px',
          margin: 'clamp(2.5rem, 12vh, 7rem) auto',
          padding: 'clamp(2rem, 5vw, 3.5rem)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid var(--border-default)',
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
            background: 'var(--color-primary-subtle)',
            color: 'var(--color-accent)',
          }}
        >
          <FileQuestion size={32} strokeWidth={1.75} />
        </div>

        <div style={{ marginBottom: '0.85rem' }}>
          <span
            className="badge badge-neutral"
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            404 Not Found
          </span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(1.4rem, 2.5vw, 1.85rem)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.65rem',
            lineHeight: 1.3,
          }}
        >
          {language === 'en' ? 'Page Not Found' : 'Halaman Tidak Ditemukan'}
        </h1>

        <p
          style={{
            maxWidth: '440px',
            margin: '0 auto 1.75rem',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            lineHeight: 1.6,
          }}
        >
          {language === 'en'
            ? 'The page or resource you are looking for does not exist, has been removed, or the link is incorrect.'
            : 'Halaman atau berkas yang Anda cari tidak tersedia, telah dipindahkan, atau alamat URL yang dimasukkan kurang tepat.'}
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <Link href="/chat" className="btn btn-primary btn-md">
            <MessageSquare size={15} />
            {language === 'en' ? 'AI Chat Workspace' : 'Buka Chat AI'}
          </Link>
          <Link href="/documents" className="btn btn-outline btn-md">
            <FolderTree size={15} />
            {language === 'en' ? 'Knowledge Base' : 'Repositori Dokumen'}
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-md"
            onClick={() => window.history.back()}
          >
            <ArrowLeft size={15} />
            {language === 'en' ? 'Go back' : 'Kembali'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
