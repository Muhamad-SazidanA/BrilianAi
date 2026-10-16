'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import ModernDashboard from '@/components/dashboard/ModernDashboard';

export default function DashboardPage() {
  return (
    <AppShell>
      <ModernDashboard />
    </AppShell>
  );
}
