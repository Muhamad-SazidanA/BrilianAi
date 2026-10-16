'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
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
    if (pathname === '/' || pathname === '/dashboard') {
      return [{ label: t('header.dashboard'), href: '/dashboard' }];
    }
    if (pathname === '/upload') {
      return [{ label: t('header.upload'), href: '/upload' }];
    }
    if (pathname === '/documents') {
      return [{ label: t('header.documents'), href: '/documents' }];
    }
    if (pathname.startsWith('/documents/')) {
      return [
        { label: t('header.documents'), href: '/documents' },
        { label: 'Document Studio', href: pathname },
      ];
    }
    if (pathname === '/chat') {
      return [{ label: t('header.chat'), href: '/chat' }];
    }
    if (pathname === '/users') {
      return [{ label: t('header.users'), href: '/users' }];
    }
    if (pathname === '/roles') {
      return [{ label: t('header.roles'), href: '/roles' }];
    }
    if (pathname === '/logs') {
      return [{ label: t('header.logs'), href: '/logs' }];
    }
    if (pathname === '/knowledge-gaps') {
      return [{ label: 'Knowledge Gaps', href: '/knowledge-gaps' }];
    }
    return [{ label: t('header.dashboard'), href: '/dashboard' }];
  };

  const breadcrumbs = getBreadcrumb();
  const isDirectNavRoute = [
    '/',
    '/dashboard',
    '/documents',
    '/upload',
    '/chat',
    '/users',
    '/roles',
    '/logs',
    '/knowledge-gaps',
  ].includes(pathname);
  const effectiveTitle = isDirectNavRoute ? undefined : title;

  return (
    <header className="app-header">
      {/* Left: Breadcrumbs & Dynamic Title (Slim Inline) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, paddingLeft: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
          <ChevronRight size={12} strokeWidth={2.4} style={{ color: 'var(--text-muted)', flexShrink: 0, opacity: 0.9 }} />
          {breadcrumbs.map((bc, idx) => (
            <React.Fragment key={bc.href + idx}>
              {idx > 0 && <ChevronRight size={10} strokeWidth={2.2} color="var(--border-hover)" style={{ flexShrink: 0 }} />}
              {idx === breadcrumbs.length - 1 && !effectiveTitle ? (
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{bc.label}</span>
              ) : (
                <Link href={bc.href} style={{ color: 'var(--text-secondary)' }} className="hover:underline">
                  {bc.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </div>
        {effectiveTitle && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ChevronRight size={10} strokeWidth={2.2} color="var(--border-hover)" style={{ flexShrink: 0 }} />
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
              }}
              title={subtitle}
            >
              {effectiveTitle}
            </span>
          </div>
        )}
      </div>

      {/* Right: Actions (only rendered if explicitly provided) */}
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {actions}
        </div>
      )}
    </header>
  );
}
