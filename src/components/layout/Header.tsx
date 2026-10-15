'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UploadCloud, MessageSquare, ChevronRight, Home } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { hasPermission } = useUserSession();

  // Determine breadcrumb based on pathname
  const getBreadcrumb = () => {
    if (pathname === '/' || pathname === '/dashboard') return [{ label: t('header.dashboard'), href: '/dashboard' }];
    if (pathname === '/upload') {
      return [
        { label: t('header.dashboard'), href: '/dashboard' },
        { label: t('header.upload'), href: '/upload' },
      ];
    }
    if (pathname === '/documents') {
      return [
        { label: t('header.dashboard'), href: '/dashboard' },
        { label: t('header.documents'), href: '/documents' },
      ];
    }
    if (pathname.startsWith('/documents/')) {
      return [
        { label: t('header.dashboard'), href: '/dashboard' },
        { label: t('header.documents'), href: '/documents' },
        { label: 'Document Studio', href: pathname },
      ];
    }
    if (pathname === '/chat') {
      return [
        { label: t('header.dashboard'), href: '/dashboard' },
        { label: t('header.chat'), href: '/chat' },
      ];
    }
    if (pathname === '/users') {
      return [
        { label: t('header.dashboard'), href: '/dashboard' },
        { label: t('header.users'), href: '/users' },
      ];
    }
    if (pathname === '/roles') {
      return [
        { label: t('header.dashboard'), href: '/dashboard' },
        { label: t('header.roles'), href: '/roles' },
      ];
    }
    if (pathname === '/logs') {
      return [
        { label: t('header.dashboard'), href: '/dashboard' },
        { label: t('header.logs'), href: '/logs' },
      ];
    }
    return [{ label: t('header.dashboard'), href: '/dashboard' }];
  };

  const breadcrumbs = getBreadcrumb();

  return (
    <header className="app-header">
      {/* Left: Breadcrumbs & Dynamic Title (Slim Inline) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
          <Home size={13} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
          {breadcrumbs.map((bc, idx) => (
            <React.Fragment key={bc.href + idx}>
              <ChevronRight size={11} color="var(--border-hover)" style={{ flexShrink: 0 }} />
              {idx === breadcrumbs.length - 1 && !title ? (
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--border-hover)', fontSize: '12px' }}>/</span>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
              }}
              title={subtitle}
            >
              {title}
            </span>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {actions ? (
          actions
        ) : (
          <>
            {pathname !== '/upload' && hasPermission('documents:upload') && (
              <Link href="/upload" className="btn btn-primary btn-sm">
                <UploadCloud size={15} />
                <span>{t('header.upload_btn')}</span>
              </Link>
            )}
            {pathname !== '/chat' && hasPermission('chat:query') && (
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
