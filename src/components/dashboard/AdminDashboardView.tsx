'use client';

import React from 'react';
import DashboardMetricCard from './DashboardMetricCard';
import CompactActivityMatrix from './CompactActivityMatrix';
import SlimAttentionConsole from './SlimAttentionConsole';
import { DashboardStats } from '@/types/stats';

interface AdminDashboardViewProps {
  stats: DashboardStats | null;
  isLoading: boolean;
  onRefresh: () => void;
  syncTime: string;
}

export default function AdminDashboardView({
  stats,
  isLoading,
  onRefresh,
  syncTime,
}: AdminDashboardViewProps) {
  const pendingUsersCount = stats?.attention?.pendingUsersCount || 0;
  const gapsCount = stats?.attention?.knowledgeGapsCount || 0;
  const loginsCount = stats?.recentLogins?.length || 0;
  const isAllAiOnline = stats?.systemHealth?.ollama ?? true;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── 1. Top Row: 4 Metric Cards (Generous min-width, no text wrapping) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '0.85rem',
        }}
      >
        <DashboardMetricCard
          title="Kesehatan Multi-Agent"
          value={isAllAiOnline ? '100% Online' : 'Standby'}
          badge={isAllAiOnline ? 'Optimal' : 'Standby'}
          badgeType={isAllAiOnline ? 'success' : 'warning'}
          footerText="Gemini · Dense · DeepSeek"
          statusDot={isAllAiOnline ? 'live' : 'none'}
          isLoading={isLoading}
        />

        <DashboardMetricCard
          title="Aktivitas Login Terbaru"
          value={`${loginsCount} Sesi`}
          badge="Token Aktif"
          badgeType="neutral"
          footerText="Sliding window limiter"
          statusDot="blue"
          href="/logs"
          isLoading={isLoading}
        />

        <DashboardMetricCard
          title="Persetujuan Pengguna"
          value={`${pendingUsersCount} Akun`}
          badge={pendingUsersCount > 0 ? 'Perlu Review' : 'Lengkap'}
          badgeType={pendingUsersCount > 0 ? 'warning' : 'neutral'}
          footerText={pendingUsersCount > 0 ? 'Menunggu verifikasi' : 'Terverifikasi aktif'}
          href="/users"
          isLoading={isLoading}
        />

        <DashboardMetricCard
          title="Kesenjangan & Error"
          value={`${gapsCount} Item`}
          badge={gapsCount > 0 ? 'Perlu Atensi' : 'Bersih'}
          badgeType={gapsCount > 0 ? 'accent' : 'success'}
          footerText="Semantik AI audit"
          href="/knowledge-gaps"
          isLoading={isLoading}
        />
      </div>

      {/* ── 2. Middle Row: Sparkline Activity & Topics Matrix ── */}
      <CompactActivityMatrix trend={stats?.trend} isLoading={isLoading} />

      {/* ── 3. Bottom Row: High Density Live Attention Console ── */}
      <SlimAttentionConsole
        attention={stats?.attention}
        recentLogins={stats?.recentLogins}
        systemHealth={stats?.systemHealth}
        isLoading={isLoading}
      />
    </div>
  );
}
