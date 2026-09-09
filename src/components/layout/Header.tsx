'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UploadCloud, MessageSquare, ChevronRight, Home } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  const pathname = usePathname();
  const { t } = useLanguage();

  // Determine breadcrumb based on pathname
  const getBreadcrumb = () => {
    if (pathname === '/') return [{ label: t('header.dashboard'), href: '/' }];
    if (pathname === '/upload') {
      return [
        { label: t('header.dashboard'), href: '/' },
        { label: t('header.upload'), href: '/upload' },
      ];
    }
    if (pathname === '/documents') {
      return [
        { label: t('header.dashboard'), href: '/' },
        { label: t('header.documents'), href: '/documents' },
      ];
    }
    if (pathname.startsWith('/documents/')) {
      return [
        { label: t('header.dashboard'), href: '/' },
        { label: t('header.documents'), href: '/documents' },
        { label: 'Document Studio', href: pathname },
      ];
    }
    if (pathname === '/chat') {
      return [
        { label: t('header.dashboard'), href: '/' },
        { label: t('header.chat'), href: '/chat' },
      ];
    }
    return [{ label: t('header.dashboard'), href: '/' }];
  };

  const breadcrumbs = getBreadcrumb();

  return (
    <header className="app-header">
      {/* Left: Breadcrumbs & Dynamic Title */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <Home size={13} />
          {breadcrumbs.map((bc, idx) => (
            <React.Fragment key={bc.href + idx}>
              <ChevronRight size={12} color="var(--text-muted)" />
              {idx === breadcrumbs.length - 1 ? (
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{bc.label}</span>
              ) : (
                <Link href={bc.href} style={{ color: 'var(--text-secondary)' }} className="hover:underline">
                  {bc.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </div>
        {title && (
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {title}
          </h1>
        )}
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {actions ? (
          actions
        ) : (
          <>
            {pathname !== '/upload' && (
              <Link href="/upload" className="btn btn-primary btn-sm">
                <UploadCloud size={15} />
                <span>{t('header.upload_btn')}</span>
              </Link>
            )}
            {pathname !== '/chat' && (
              <Link href="/chat" className="btn btn-outline btn-sm">
                <MessageSquare size={15} />
                <span>{t('header.chat_btn')}</span>
              </Link>
            )}
          </>
        )}
      </div>
    </header>
  );
}
