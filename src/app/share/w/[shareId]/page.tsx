'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import ChatWorkspace from '@/components/chat/ChatWorkspace';
import { useUserSession } from '@/context/UserSessionContext';

function SharedChatWorkspaceContent() {
  const params = useParams();
  const shareId = typeof params?.shareId === 'string' ? params.shareId : '';
  const { currentUser } = useUserSession();

  // Sembunyikan sidebar jika pengguna yang mengakses tautan share belum login
  const hideSidebar = !currentUser;

  if (!shareId) {
    return (
      <AppShell allowGuest={true} hideSidebar={hideSidebar}>
        <div className="ui-card" style={{ margin: '5rem auto', maxWidth: '560px', padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Tautan Tidak Valid</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Identifier percakapan tidak ditemukan.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      noPadding={true}
      hideHeader={true}
      allowGuest={true}
      hideSidebar={hideSidebar}
    >
      <ChatWorkspace shareId={shareId} isPublicShare={true} />
    </AppShell>
  );
}

export default function SharedChatWorkspacePage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>...</div>}>
      <SharedChatWorkspaceContent />
    </Suspense>
  );
}
