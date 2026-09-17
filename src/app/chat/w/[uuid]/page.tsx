'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import ChatWorkspace from '@/components/chat/ChatWorkspace';
import { useLanguage } from '@/context/LanguageContext';
import { isUuidV4 } from '@lib/auth/uuid';

function ChatSessionPageContent() {
  const { t } = useLanguage();
  const params = useParams();
  const uuid = typeof params?.uuid === 'string' ? params.uuid : '';

  if (!isUuidV4(uuid)) {
    return (
      <AppShell requiredPermission="chat:query">
        <div className="ui-card" style={{ margin: '5rem auto', maxWidth: '560px', padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Sesi Chat Tidak Valid</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Identifier harus berupa UUID v4 yang valid.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t('chat.title')}
      subtitle={t('chat.subtitle')}
      noPadding={true}
      hideHeader={true}
      requiredPermission="chat:query"
    >
      <ChatWorkspace sessionId={uuid} />
    </AppShell>
  );
}

export default function ChatSessionPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>...</div>}>
      <ChatSessionPageContent />
    </Suspense>
  );
}
