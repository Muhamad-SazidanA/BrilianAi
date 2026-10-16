'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import UsersManagementView from '@/components/users/UsersManagementView';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';

export default function UsersPage() {
  const { language } = useLanguage();
  const { hasPermission } = useUserSession();

  return (
    <AppShell
      requiredPermission="users:manage"
      title={language === 'en' ? 'User Management' : 'Kelola Pengguna'}
      subtitle={
        language === 'en'
          ? 'Manage accounts, access privileges, departmental roles, and operational activity.'
          : 'Kelola akun pengguna, peran akses (RBAC), departemen, dan pantau keaktifan tanya-jawab AI.'
      }
    >
      <UsersManagementView />
    </AppShell>
  );
}
