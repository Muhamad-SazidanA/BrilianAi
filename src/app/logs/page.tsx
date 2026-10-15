'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { MessageSquare, Download, ScrollText, FileQuestion, UploadCloud } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import AuditLogsView from '@/components/logs/AuditLogsView';
import KnowledgeGapsView from '@/components/logs/KnowledgeGapsView';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';

function LogsContent() {
  const { language } = useLanguage();
  const { hasPermission } = useUserSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'audit' | 'gaps'>(
    tabParam === 'gaps' ? 'gaps' : 'audit'
  );

  useEffect(() => {
    if (tabParam === 'gaps' || tabParam === 'audit') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab: 'audit' | 'gaps') => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    router.replace(url.pathname + url.search);
  };

  const canViewAudit = hasPermission('audit:read');
  const canViewGaps = hasPermission('documents:read');

  return (
    <AppShell
      title={
        language === 'en'
          ? 'Audit & AI Observability'
          : 'Audit & Observabilitas AI'
      }
      subtitle={
        language === 'en'
          ? 'Monitor enterprise query volume, track cited knowledge, and resolve organizational knowledge gaps.'
          : 'Monitoring volume pertanyaan, audit rujukan dokumen AI, dan analisis kesenjangan pengetahuan organisasi.'
      }
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'audit' && canViewAudit && (
            <button
              type="button"
              onClick={() => window.open('/api/audit-logs/export', '_blank')}
              className="btn btn-outline btn-sm"
            >
              <Download size={15} />
              <span>{language === 'en' ? 'Export CSV' : 'Ekspor CSV'}</span>
            </button>
          )}
          {activeTab === 'gaps' && hasPermission('documents:upload') && (
            <Link href="/documents?action=upload" className="btn btn-outline btn-sm">
              <UploadCloud size={15} />
              <span>{language === 'en' ? 'Upload SOP' : 'Unggah SOP'}</span>
            </Link>
          )}
          {hasPermission('chat:query') && (
            <Link href="/chat" className="btn btn-primary btn-sm">
              <MessageSquare size={15} />
              <span>{language === 'en' ? 'Open Chatbot' : 'Buka Chatbot'}</span>
            </Link>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderBottom: '1px solid var(--border-default)',
            paddingBottom: '2px',
          }}
        >
          {canViewAudit && (
            <button
              type="button"
              onClick={() => handleTabChange('audit')}
              className={`btn btn-sm ${activeTab === 'audit' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', padding: '8px 16px' }}
            >
              <ScrollText size={15} />
              <span>{language === 'en' ? 'Chat Audit Logs' : 'Audit Log Percakapan'}</span>
            </button>
          )}

          {canViewGaps && (
            <button
              type="button"
              onClick={() => handleTabChange('gaps')}
              className={`btn btn-sm ${activeTab === 'gaps' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', padding: '8px 16px' }}
            >
              <FileQuestion size={15} />
              <span>{language === 'en' ? 'Knowledge Gaps' : 'Kesenjangan Dokumen'}</span>
            </button>
          )}
        </div>

        {/* Tab Panes */}
        {activeTab === 'audit' && canViewAudit && <AuditLogsView />}
        {activeTab === 'gaps' && canViewGaps && <KnowledgeGapsView />}
      </div>
    </AppShell>
  );
}

export default function AuditLogsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Memuat...</div>}>
      <LogsContent />
    </Suspense>
  );
}
