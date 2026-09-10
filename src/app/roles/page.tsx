'use client';

import React from 'react';
import Link from 'next/link';
import { Users, MessageSquare } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import RolesPermissionsView from '@/components/roles/RolesPermissionsView';
import { useLanguage } from '@/context/LanguageContext';

export default function RolesPage() {
  const { language } = useLanguage();

  return (
    <AppShell
      title={language === 'en' ? 'Roles & Permissions (RBAC)' : 'Role & Hak Akses (RBAC)'}
      subtitle={
        language === 'en'
          ? 'Define permission privileges and granular controls for workspace members and managers.'
          : 'Atur hierarki kewenangan pengguna melalui matriks perizinan bertingkat (Role-Based Access Control).'
      }
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href="/users" className="btn btn-outline btn-sm">
            <Users size={15} />
            <span>{language === 'en' ? 'Manage Users' : 'Kelola Pengguna'}</span>
          </Link>
          <Link href="/logs" className="btn btn-outline btn-sm">
            <MessageSquare size={15} />
            <span>{language === 'en' ? 'Audit Logs' : 'Log Percakapan'}</span>
          </Link>
        </div>
      }
    >
      <RolesPermissionsView />
    </AppShell>
  );
}
