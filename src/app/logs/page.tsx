'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import AuditLogsView from '@/components/logs/AuditLogsView';

export default function AuditLogsPage() {
  return (
    <AppShell requiredPermission="audit:read">
      <AuditLogsView />
    </AppShell>
  );
}
