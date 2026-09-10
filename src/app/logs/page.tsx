'use client';

import React from 'react';
import Link from 'next/link';
import { MessageSquare, Download } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import AuditLogsView from '@/components/logs/AuditLogsView';
import { useLanguage } from '@/context/LanguageContext';

export default function AuditLogsPage() {
  const { language } = useLanguage();

  return (
    <AppShell
      title={language === 'en' ? 'Chat Audit Logs' : 'Audit Log Percakapan'}
      subtitle={
        language === 'en'
          ? 'Enterprise query volume monitoring, topic analysis, and cited document inspection.'
          : 'Monitoring volume pertanyaan pengguna, analisis topik bahasan, dan audit rujukan dokumen AI.'
      }
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => window.open('/api/audit-logs/export', '_blank')}
            className="btn btn-outline btn-sm"
          >
            <Download size={15} />
            <span>{language === 'en' ? 'Export CSV' : 'Ekspor CSV'}</span>
          </button>
          <Link href="/chat" className="btn btn-primary btn-sm">
            <MessageSquare size={15} />
            <span>{language === 'en' ? 'Open Chatbot' : 'Buka Chatbot'}</span>
          </Link>
        </div>
      }
    >
      <AuditLogsView />
    </AppShell>
  );
}
