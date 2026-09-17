'use client';

import Link from 'next/link';
import { ArrowLeft, LayoutDashboard, ShieldAlert } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import { useLanguage } from '@/context/LanguageContext';

export default function ForbiddenPage() {
  const { language } = useLanguage();

  return (
    <AppShell>
      <div
        className="ui-card"
        style={{
          maxWidth: '620px',
          margin: 'clamp(2rem, 10vh, 6rem) auto',
          padding: 'clamp(2rem, 5vw, 3.5rem)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '68px',
            height: '68px',
            marginBottom: '1.25rem',
            borderRadius: '22px',
            background: 'var(--color-danger-subtle)',
            color: 'var(--color-danger-text)',
          }}
        >
          <ShieldAlert size={34} strokeWidth={1.8} />
        </div>

        <span className="badge badge-danger" style={{ marginBottom: '0.85rem' }}>
          403 Forbidden
        </span>
        <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: '0.7rem' }}>
          {language === 'en' ? 'Access restricted' : 'Akses dibatasi'}
        </h1>
        <p
          style={{
            maxWidth: '470px',
            margin: '0 auto 1.75rem',
            color: 'var(--text-secondary)',
            fontSize: '13.5px',
            lineHeight: 1.75,
          }}
        >
          {language === 'en'
            ? 'Your current role does not have permission to use AI Assistant. Contact an administrator if you need access.'
            : 'Role akun Anda belum memiliki izin untuk menggunakan AI Assistant. Hubungi Administrator jika memerlukan akses.'}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <Link href="/" className="btn btn-primary btn-md">
            <LayoutDashboard size={15} />
            {language === 'en' ? 'Back to dashboard' : 'Kembali ke dashboard'}
          </Link>
          <button type="button" className="btn btn-outline btn-md" onClick={() => window.history.back()}>
            <ArrowLeft size={15} />
            {language === 'en' ? 'Go back' : 'Kembali'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
