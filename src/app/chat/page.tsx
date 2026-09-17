'use client';

import React, { Suspense } from 'react';
import AppShell from '@/components/layout/AppShell';
import ChatWorkspace from '@/components/chat/ChatWorkspace';
import { useLanguage } from '@/context/LanguageContext';

export default function ChatPage() {
  const { t } = useLanguage();

  return (
    <AppShell
      title={t('chat.title')}
      subtitle={t('chat.subtitle')}
      noPadding={true}
      hideHeader={true}
      requiredPermission="chat:query"
    >
      <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Memuat Chat Workspace...</div>}>
        <ChatWorkspace />
      </Suspense>
    </AppShell>
  );
}

