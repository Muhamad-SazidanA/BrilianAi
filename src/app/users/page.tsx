'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import UsersManagementView from '@/components/users/UsersManagementView';

export default function UsersPage() {
  return (
    <AppShell requiredPermission="users:manage">
      <UsersManagementView />
    </AppShell>
  );
}
