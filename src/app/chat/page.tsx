'use client';

import React, { Suspense } from 'react';
import AppShell from '@/components/layout/AppShell';
import ChatWorkspace from '@/components/chat/ChatWorkspace';
import { useLanguage } from '@/context/LanguageContext';

function ChatPageContent() {
  const { t } = useLanguage();

  return (
    <AppShell
      title={t('chat.title')}
      subtitle={t('chat.subtitle')}
      noPadding={true}
      hideHeader={true}
    >
      <ChatWorkspace />
    </AppShell>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>...</div>}>
      <ChatPageContent />
    </Suspense>
  );
}
