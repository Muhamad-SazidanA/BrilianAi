'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DashboardStats } from '@/types/stats';
import { useUserSession } from '@/context/UserSessionContext';
import { useLanguage } from '@/context/LanguageContext';
import EnterprisePageHeader from '@/components/layout/EnterprisePageHeader';
import AdminDashboardView from './AdminDashboardView';
import DocumentDashboardView from './DocumentDashboardView';
import PersonalDashboardView from './PersonalDashboardView';

export type DashboardTabKey = 'admin' | 'documents' | 'personal';

interface ModernDashboardProps {
  initialStats?: DashboardStats | null;
}

export default function ModernDashboard({ initialStats }: ModernDashboardProps) {
  const { language } = useLanguage();
  const { currentUser, hasPermission } = useUserSession();

  const [stats, setStats] = useState<DashboardStats | null>(initialStats || null);
  const [isLoading, setIsLoading] = useState(!initialStats);
  const [syncTime, setSyncTime] = useState<string>(() => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');

  // ── Determine Granular RBAC Permissions for Dashboard Views ──
  const canViewAdmin = Boolean(
    hasPermission('dashboard:admin') ||
    currentUser?.role_id === 'admin' ||
    hasPermission('users:manage') ||
    hasPermission('audit:read')
  );

  const canViewDocuments = Boolean(
    hasPermission('dashboard:documents') ||
    currentUser?.role_id === 'admin' ||
    hasPermission('documents:upload') ||
    hasPermission('documents:read')
  );

  const canViewPersonal = Boolean(
    hasPermission('dashboard:personal') ||
    hasPermission('chat:query') ||
    true
  );

  // Available tabs for the current user's role
  const availableTabs = useMemo(() => {
    const list: { key: DashboardTabKey; label: string }[] = [];
    if (canViewAdmin) {
      list.push({ key: 'admin', label: language === 'en' ? 'Admin & System' : 'Admin & Sistem' });
    }
    if (canViewDocuments) {
      list.push({ key: 'documents', label: language === 'en' ? 'Documents & OCR' : 'Dokumen & OCR' });
    }
    if (canViewPersonal) {
      list.push({ key: 'personal', label: language === 'en' ? 'Personal' : 'Pribadi' });
    }
    return list;
  }, [canViewAdmin, canViewDocuments, canViewPersonal, language]);

  // Active tab state: default to first allowed tab
  const [activeTab, setActiveTab] = useState<DashboardTabKey>(() => {
    if (canViewAdmin) return 'admin';
    if (canViewDocuments) return 'documents';
    return 'personal';
  });

  useEffect(() => {
    if (activeTab === 'admin' && !canViewAdmin) {
      setActiveTab(canViewDocuments ? 'documents' : 'personal');
    } else if (activeTab === 'documents' && !canViewDocuments) {
      setActiveTab('personal');
    }
  }, [canViewAdmin, canViewDocuments, activeTab]);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        const d = new Date();
        setSyncTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (err) {
      console.warn('[ModernDashboard] Failed to fetch stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialStats) {
      fetchStats();
    }
  }, [fetchStats, initialStats]);

  const subtitle = useMemo(() => {
    if (activeTab === 'admin') {
      return 'Kondisi kesehatan AI, audit login, dan keamanan.';
    }
    if (activeTab === 'documents') {
      return 'Vision OCR per halaman, volume dokumen, dan kurasi.';
    }
    return 'Eksplorasi AI pribadi dan penelusuran dokumen.';
  }, [activeTab]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        padding: '0 0.25rem 3.5rem',
      }}
    >
      {/* ── Top Header (Enterprise Reusable Component) ── */}
      <EnterprisePageHeader
        title={language === 'en' ? 'Dashboard' : 'Dasbor'}
        subtitle={subtitle}
        syncTime={syncTime}
        onRefresh={fetchStats}
        isLoading={isLoading}
        timeRange={timeRange}
        onTimeRangeChange={(r) => setTimeRange(r as '7d' | '30d' | 'all')}
        timeOptions={[
          { key: '7d', label: '7 Hari' },
          { key: '30d', label: '30 Hari' },
          { key: 'all', label: 'Semua Waktu' },
        ]}
        tabs={availableTabs}
        activeTab={activeTab}
        onTabChange={(k) => setActiveTab(k as DashboardTabKey)}
      />

      {/* ── Active Perspective Content (Ultra-Compact) ── */}
      {activeTab === 'admin' && (
        <AdminDashboardView
          stats={stats}
          isLoading={isLoading}
          onRefresh={fetchStats}
          syncTime={syncTime}
        />
      )}

      {activeTab === 'documents' && (
        <DocumentDashboardView
          stats={stats}
          isLoading={isLoading}
          onRefresh={fetchStats}
          syncTime={syncTime}
        />
      )}

      {activeTab === 'personal' && (
        <PersonalDashboardView
          stats={stats}
          isLoading={isLoading}
          onRefresh={fetchStats}
          syncTime={syncTime}
        />
      )}
    </div>
  );
}
