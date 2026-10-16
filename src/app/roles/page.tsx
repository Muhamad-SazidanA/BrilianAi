'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import RolesPermissionsView from '@/components/roles/RolesPermissionsView';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';

export default function RolesPage() {
  const { language } = useLanguage();
  const { hasPermission } = useUserSession();

  return (
    <AppShell
      requiredPermission="roles:manage"
      title={language === 'en' ? 'Roles & Permissions (RBAC)' : 'Role & Hak Akses (RBAC)'}
      subtitle={
        language === 'en'
          ? 'Define permission privileges and granular controls for workspace members and managers.'
          : 'Atur hierarki kewenangan pengguna melalui matriks perizinan bertingkat (Role-Based Access Control).'
      }
    >
      <RolesPermissionsView />
    </AppShell>
  );
}
