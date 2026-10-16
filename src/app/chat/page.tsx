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
      allowGuest={true}
    >
      <Suspense fallback={null}>
        <ChatWorkspace />
      </Suspense>
    </AppShell>
  );
}

