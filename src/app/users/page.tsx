'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Users, ShieldCheck, MessageSquare } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import UsersManagementView from '@/components/users/UsersManagementView';
import RolesPermissionsView from '@/components/roles/RolesPermissionsView';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';

function UsersContent() {
  const { language } = useLanguage();
  const { hasPermission } = useUserSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>(
    tabParam === 'roles' ? 'roles' : 'users'
  );

  useEffect(() => {
    if (tabParam === 'roles' || tabParam === 'users') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab: 'users' | 'roles') => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    router.replace(url.pathname + url.search);
  };

  const canManageUsers = hasPermission('users:manage');
  const canManageRoles = hasPermission('roles:manage');

  return (
    <AppShell
      title={language === 'en' ? 'Users & Access Control' : 'Pengguna & Hak Akses'}
      subtitle={
        language === 'en'
          ? 'Manage workspace accounts, departmental clearance, and granular RBAC role matrices.'
          : 'Kelola akun pengguna, persetujuan akses, departemen, dan matriks hak akses berjenjang (RBAC).'
      }
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          {hasPermission('audit:read') && (
            <Link href="/logs" className="btn btn-outline btn-sm">
              <MessageSquare size={15} />
              <span>{language === 'en' ? 'Audit Logs' : 'Log Percakapan'}</span>
            </Link>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderBottom: '1px solid var(--border-default)',
            paddingBottom: '2px',
          }}
        >
          {canManageUsers && (
            <button
              type="button"
              onClick={() => handleTabChange('users')}
              className={`btn btn-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', padding: '8px 16px' }}
            >
              <Users size={15} />
              <span>{language === 'en' ? 'Users & Clearance' : 'Daftar Pengguna'}</span>
            </button>
          )}

          {canManageRoles && (
            <button
              type="button"
              onClick={() => handleTabChange('roles')}
              className={`btn btn-sm ${activeTab === 'roles' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', padding: '8px 16px' }}
            >
              <ShieldCheck size={15} />
              <span>{language === 'en' ? 'Roles & Permissions (RBAC)' : 'Peran & Hak Izin (RBAC)'}</span>
            </button>
          )}
        </div>

        {/* Tab Panes */}
        {activeTab === 'users' && canManageUsers && <UsersManagementView />}
        {activeTab === 'roles' && canManageRoles && <RolesPermissionsView />}
      </div>
    </AppShell>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Memuat...</div>}>
      <UsersContent />
    </Suspense>
  );
}
