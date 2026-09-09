'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  UploadCloud,
  FolderTree,
  MessageSquare,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import NavUser from './NavUser';
import { useLanguage } from '@/context/LanguageContext';

interface SidebarProps {
  stats?: {
    totalDocuments: number;
    activeKnowledgeCount: number;
  } | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  stats,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const { language, t } = useLanguage();
  const [docCount, setDocCount] = useState<number>(stats?.totalDocuments || 0);

  useEffect(() => {
    async function checkDocCount() {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) {
          const data = await res.json();
          setDocCount(data.totalDocuments || 0);
        }
      } catch {
        // quiet fallback
      }
    }
    checkDocCount();
  }, [pathname]);

  const navGroups = [
    {
      group: language === 'en' ? 'AI Workspace' : 'Workspace AI',
      items: [
        {
          label: t('nav.dashboard'),
          href: '/',
          icon: LayoutDashboard,
          badge: null,
          isActive: pathname === '/',
        },
        {
          label: t('nav.upload'),
          href: '/upload',
          icon: UploadCloud,
          badge: null,
          isActive: pathname === '/upload',
        },
        {
          label: t('nav.documents'),
          href: '/documents',
          icon: FolderTree,
          badge: docCount > 0 ? `${docCount}` : null,
          badgeVariant: 'badge-neutral',
          isActive: pathname.startsWith('/documents'),
        },
      ],
    },
    {
      group: language === 'en' ? 'Assistant & Analytics' : 'Asisten & Analisis',
      items: [
        {
          label: t('nav.chat'),
          href: '/chat',
          icon: MessageSquare,
          badge: null,
          isActive: pathname === '/chat',
        },
      ],
    },
  ];

  return (
    <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* ── Collapse / Expand Toggle Button ── */}
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          style={{
            position: 'absolute',
            right: '-13px',
            top: '22px',
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 60,
            color: 'var(--text-secondary)',
            transition: 'all 0.15s ease',
            outline: 'none',
          }}
          className="hover:text-primary hover:border-blue-400"
          title={isCollapsed ? t('nav.open_sidebar') : t('nav.close_sidebar')}
          aria-label={isCollapsed ? t('nav.open_sidebar') : t('nav.close_sidebar')}
        >
          {isCollapsed ? (
            <ChevronsRight size={14} strokeWidth={2} />
          ) : (
            <ChevronsLeft size={14} strokeWidth={2} />
          )}
        </button>
      )}

      {/* ── Brand Header (Brilian.Ai Logo) ── */}
      <div
        style={{
          padding: '0 0.5rem',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '70px',
          boxSizing: 'border-box',
        }}
      >
        <Link
          href="/"
          aria-label="Brilian.Ai Dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '2px 4px',
            transition: 'background-color 0.15s ease',
          }}
          className="hover:bg-subtle"
          title="Brilian.Ai Dashboard"
        >
          {isCollapsed ? (
            <img
              src="/images/BrilianLogo-Close.svg"
              alt="Brilian.Ai"
              style={{
                width: '38px',
                height: '38px',
                aspectRatio: '1 / 1',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <img
              src="/images/BrilianLogo-Open.svg"
              alt="Brilian.Ai"
              style={{
                width: '136px',
                height: '68px',
                aspectRatio: '2 / 1',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          )}
        </Link>
      </div>

      {/* ── Navigation Links ─────────────────────────────────── */}
      <div
        style={{
          padding: isCollapsed ? '0.75rem 0.35rem' : '1rem 0.75rem',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: isCollapsed ? '0.75rem' : '1.25rem',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {navGroups.map((group) => (
          <div key={group.group} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {!isCollapsed && (
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.06em',
                  padding: '4px 12px',
                  marginBottom: '2px',
                }}
              >
                {group.group}
              </div>
            )}

            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${item.isActive ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '10px 0' : '9px 12px',
                    position: 'relative',
                  }}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon size={18} strokeWidth={item.isActive ? 2.2 : 1.75} />
                  {!isCollapsed && (
                    <>
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.label}
                      </span>
                      {item.badge && (
                        <span
                          className={`badge ${item.isActive ? 'badge-accent' : item.badgeVariant || 'badge-neutral'}`}
                          style={{ fontSize: '10.5px', padding: '1px 7px' }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                  {isCollapsed && item.badge && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '12px',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: item.isActive ? 'var(--color-primary)' : 'var(--text-muted)',
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── User Footer Section ──────────────────────────────── */}
      <div
        style={{
          padding: isCollapsed ? '8px 4px' : '8px',
          borderTop: '1px solid var(--border-default)',
          backgroundColor: 'var(--bg-card)',
        }}
      >
        <NavUser
          user={{
            name: 'Admin',
            email: 'admin@brilian.ai',
          }}
          version="Brilian.Ai v1.0.0"
          isCollapsed={isCollapsed}
        />
      </div>
    </aside>
  );
}
