'use client';

import React from 'react';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import UsersManagementView from '@/components/users/UsersManagementView';
import { useLanguage } from '@/context/LanguageContext';

export default function UsersPage() {
  const { language } = useLanguage();

  return (
    <AppShell
      title={language === 'en' ? 'User Management' : 'Kelola Pengguna'}
      subtitle={
        language === 'en'
          ? 'Manage accounts, access privileges, departmental roles, and operational activity.'
          : 'Kelola akun pengguna, peran akses (RBAC), departemen, dan pantau keaktifan tanya-jawab AI.'
      }
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href="/roles" className="btn btn-outline btn-sm">
            <span>{language === 'en' ? 'Manage Roles' : 'Kelola Role'}</span>
          </Link>
          <Link href="/logs" className="btn btn-outline btn-sm">
            <MessageSquare size={15} />
            <span>{language === 'en' ? 'Audit Logs' : 'Log Percakapan'}</span>
          </Link>
        </div>
      }
    >
      <UsersManagementView />
    </AppShell>
  );
}
