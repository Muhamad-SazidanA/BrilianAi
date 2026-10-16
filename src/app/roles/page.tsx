'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import RolesPermissionsView from '@/components/roles/RolesPermissionsView';

export default function RolesPage() {
  return (
    <AppShell requiredPermission="roles:manage">
      <RolesPermissionsView />
    </AppShell>
  );
}
