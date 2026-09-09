'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  MessageSquare,
  FolderTree,
  ArrowRight,
  Zap,
  ShieldCheck,
  Search,
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import StatCards from '@/components/dashboard/StatCards';
import RecentBatches from '@/components/dashboard/RecentBatches';
import SystemHealth from '@/components/dashboard/SystemHealth';
import { DashboardStats } from '@/types/stats';
import { useLanguage } from '@/context/LanguageContext';

export default function DashboardPage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      title="Dashboard"
      subtitle={t('docs.subtitle')}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href="/upload" className="btn btn-primary btn-sm">
            <UploadCloud size={15} />
            <span>{t('header.upload_btn')}</span>
          </Link>
          <Link href="/chat" className="btn btn-outline btn-sm">
            <MessageSquare size={15} />
            <span>{t('header.chat_btn')}</span>
          </Link>
        </div>
      }
    >
      {/* 1. Hero Welcome Banner (Clean Brilian.Ai Look) */}
      <div
        className="ui-card hero-gradient"
        style={{
          marginBottom: '2rem',
          padding: '1.75rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem',
          flexWrap: 'wrap',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ maxWidth: '640px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              className="badge badge-accent"
              style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}
            >
              {t('dash.badge')}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              pgvector RAG · In-Memory Buffer
            </span>
          </div>

          <h2
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              lineHeight: '28px',
              letterSpacing: '-0.025em',
            }}
          >
            {t('dash.welcome_title')}
          </h2>
          <p
            style={{
              fontSize: '13.5px',
              color: 'var(--text-secondary)',
              marginTop: '6px',
              lineHeight: '22px',
              fontWeight: 500,
            }}
          >
            {t('dash.welcome_desc')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative', zIndex: 1 }}>
          <Link href="/upload" className="btn btn-primary btn-md" style={{ padding: '11px 20px' }}>
            <UploadCloud size={16} />
            <span>{t('dash.upload_new')}</span>
          </Link>
          <Link href="/documents" className="btn btn-outline btn-md" style={{ padding: '11px 18px' }}>
            <FolderTree size={16} />
            <span>{t('dash.manage_docs')}</span>
          </Link>
        </div>
      </div>

      {/* 2. Key Metrics Stat Cards */}
      <StatCards stats={stats} isLoading={isLoading} />

      {/* 3. Main Operational Grid: Recent Activity + System Health */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 360px',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        <RecentBatches
          batches={stats?.recentBatches || []}
          isLoading={isLoading}
        />

        <SystemHealth stats={stats} />
      </div>
    </AppShell>
  );
}
