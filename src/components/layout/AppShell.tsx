'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert, MessageSquare, FolderTree, LayoutDashboard } from 'lucide-react';
import { useUserSession } from '@/context/UserSessionContext';
import { PermissionKey } from '@/types/user';
import Sidebar from './Sidebar';
import Header from './Header';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  noPadding?: boolean;
  hideHeader?: boolean;
  hideSidebar?: boolean;
  requiredPermission?: PermissionKey;
  allowGuest?: boolean;
}

export default function AppShell({
  children,
  title,
  subtitle,
  actions,
  noPadding = false,
  hideHeader = false,
  hideSidebar = false,
  requiredPermission,
  allowGuest = false,
}: AppShellProps) {
  const router = useRouter();
  const { currentUser, isLoading, hasPermission } = useUserSession();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Client-side auth guard: redirect if not logged in or pending approval
  useEffect(() => {
    if (!isLoading && !allowGuest) {
      if (!currentUser) {
        router.push('/login');
      } else if (currentUser.status === 'pending_approval') {
        router.push('/pending-approval');
      }
    }
  }, [isLoading, currentUser, router, allowGuest]);

  // Load saved sidebar collapse preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
    } catch {
      // quiet fallback
    }
  }, []);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch {
        // quiet fallback
      }
      return next;
    });
  };

  // Guard against unauthenticated render flash
  if (!isLoading && !currentUser && !allowGuest) {
    return null;
  }


  const isAccessDenied = Boolean(
    !isLoading && currentUser && requiredPermission && !hasPermission(requiredPermission)
  );

  return (
    <div className="app-shell">
      {/* Collapsible Sidebar */}
      {!hideSidebar && (
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
      )}

      {/* Main Content Area */}
      <div className={`app-main ${hideSidebar ? 'no-sidebar' : isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {!hideHeader && !isAccessDenied && <Header title={title} subtitle={subtitle} actions={actions} />}
        <main
          className="app-content"
          style={
            noPadding && !isAccessDenied
              ? {
                  padding: 0,
                  maxWidth: 'none',
                  margin: 0,
                  height: hideHeader ? '100vh' : 'calc(100vh - var(--header-height))',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }
              : undefined
          }
        >
          {isAccessDenied ? (
            <div
              className="ui-card"
              style={{
                maxWidth: '560px',
                margin: '5rem auto',
                padding: '2.5rem 2rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-md)',
                backgroundColor: 'var(--bg-card)',
              }}
            >
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.25rem',
                }}
              >
                <ShieldAlert size={28} strokeWidth={2} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span
                  className="badge badge-accent"
                  style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}
                >
                  Role: {currentUser?.role?.name || currentUser?.role_id}
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  Kode: {requiredPermission}
                </span>
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Akses Ditolak (403 Forbidden)
              </h2>

              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '440px', lineHeight: '22px', marginBottom: '1.75rem' }}>
                Role akun Anda saat ini tidak memiliki izin untuk mengakses halaman ini. Izin ini dapat diaktifkan melalui menu <strong>Role & Hak Akses</strong> oleh Administrator.
              </p>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Link href="/" className="btn btn-outline btn-md">
                  <LayoutDashboard size={15} />
                  <span>Dashboard</span>
                </Link>
                {hasPermission('chat:query') && (
                  <Link href="/chat" className="btn btn-primary btn-md">
                    <MessageSquare size={15} />
                    <span>Buka Chatbot AI</span>
                  </Link>
                )}
                {hasPermission('documents:read') && (
                  <Link href="/documents" className="btn btn-primary btn-md">
                    <FolderTree size={15} />
                    <span>Buka Dokumen</span>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
