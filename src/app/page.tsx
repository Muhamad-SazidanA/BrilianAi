'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { UploadCloud, MessageSquare } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import UserDashboard from '@/components/dashboard/UserDashboard';
import { DashboardStats } from '@/types/stats';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';

export default function DashboardPage() {
  const { t } = useLanguage();
  const { currentUser, hasPermission } = useUserSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Determine if active user is an administrator or editor
  const isAdminOrEditor =
    currentUser?.role_id === 'admin' ||
    currentUser?.role_id === 'editor' ||
    hasPermission('users:manage') ||
    hasPermission('documents:upload');

  // Allow admin/editor to preview user dashboard
  const [viewMode, setViewMode] = useState<'admin' | 'user'>('admin');

  // If user is a regular member, force 'user' view mode
  const effectiveViewMode = isAdminOrEditor ? viewMode : 'user';

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <AppShell
      title={effectiveViewMode === 'admin' ? 'Dashboard Operasional' : 'Dashboard Workspace'}
      subtitle={
        effectiveViewMode === 'admin'
          ? 'Pusat pemantauan infrastruktur, ingestion dokumen, dan kurasi pengetahuan AI'
          : 'Pusat eksplorasi dokumen perusahaan dan asisten tanya jawab AI'
      }
      actions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isAdminOrEditor && (
            <div className="view-mode-pill" style={{ display: 'flex' }}>
              <button
                type="button"
                onClick={() => setViewMode('admin')}
                className={`view-mode-btn ${effectiveViewMode === 'admin' ? 'active' : ''}`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => setViewMode('user')}
                className={`view-mode-btn ${effectiveViewMode === 'user' ? 'active' : ''}`}
              >
                User
              </button>
            </div>
          )}

          {hasPermission('documents:upload') && (
            <Link href="/upload" className="btn btn-primary btn-sm">
              <UploadCloud size={15} />
              <span>{t('header.upload_btn')}</span>
            </Link>
          )}
          {hasPermission('chat:query') && (
            <Link href="/chat" className="btn btn-outline btn-sm">
              <MessageSquare size={15} />
              <span>{t('header.chat_btn')}</span>
            </Link>
          )}
        </div>
      }
    >
      {effectiveViewMode === 'admin' ? (
        <AdminDashboard
          stats={stats}
          isLoading={isLoading}
          onSwitchToUser={() => setViewMode('user')}
          canSwitchToUser={isAdminOrEditor}
        />
      ) : (
        <UserDashboard
          onSwitchToAdmin={() => setViewMode('admin')}
          canSwitchToAdmin={isAdminOrEditor}
        />
      )}
    </AppShell>
  );
}

