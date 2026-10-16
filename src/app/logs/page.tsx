'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import AuditLogsView from '@/components/logs/AuditLogsView';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';

export default function AuditLogsPage() {
  const { language } = useLanguage();
  const { hasPermission } = useUserSession();

  return (
    <AppShell
      requiredPermission="audit:read"
      title={language === 'en' ? 'Chat Audit Logs' : 'Audit Log Percakapan'}
      subtitle={
        language === 'en'
          ? 'Enterprise query volume monitoring, topic analysis, and cited document inspection.'
          : 'Monitoring volume pertanyaan pengguna, analisis topik bahasan, dan audit rujukan dokumen AI.'
      }
    >
      <AuditLogsView />
    </AppShell>
  );
}
