'use client';

import React from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  FolderTree,
  Users,
  ShieldCheck,
  ScrollText,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import StatCards from '@/components/dashboard/StatCards';
import RecentBatches from '@/components/dashboard/RecentBatches';
import SystemHealth from '@/components/dashboard/SystemHealth';
import { DashboardStats } from '@/types/stats';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';

interface AdminDashboardProps {
  stats: DashboardStats | null;
  isLoading: boolean;
  onSwitchToUser?: () => void;
  canSwitchToUser?: boolean;
}

export default function AdminDashboard({
  stats,
  isLoading,
  onSwitchToUser,
  canSwitchToUser = true,
}: AdminDashboardProps) {
  const { t } = useLanguage();
  const { hasPermission } = useUserSession();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* ── 1. Hero Admin Overview Banner ── */}
      <div
        className="ui-card hero-gradient"
        style={{
          padding: '1.75rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem',
          flexWrap: 'wrap',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: '640px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              className="badge badge-accent"
              style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}
            >
              Konsol Operasional Sistem
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              pgvector RAG · Vision OCR · In-Memory Buffer
            </span>
          </div>

          <h1
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              lineHeight: '28px',
              letterSpacing: '-0.025em',
            }}
          >
            Pusat Kendali & Operasional AI
          </h1>
          <p
            style={{
              fontSize: '13.5px',
              color: 'var(--text-secondary)',
              marginTop: '6px',
              lineHeight: '22px',
              fontWeight: 500,
            }}
          >
            Monitor status pipeline ingestion dokumen, kurasi insight, manajemen pengguna berjenjang (RBAC), dan kesehatan database vektor.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative', zIndex: 1 }}>
          {canSwitchToUser && (
            <div className="view-mode-pill" style={{ marginRight: '6px' }}>
              <button
                type="button"
                className="view-mode-btn active"
              >
                Tampilan Admin
              </button>
              <button
                type="button"
                onClick={onSwitchToUser}
                className="view-mode-btn"
                title="Pratinjau tampilan yang dilihat oleh pengguna umum"
              >
                Tampilan Pengguna
              </button>
            </div>
          )}

          {hasPermission('documents:upload') && (
            <Link href="/upload" className="btn btn-primary btn-md" style={{ padding: '10px 18px' }}>
              <UploadCloud size={16} />
              <span>{t('dash.upload_new')}</span>
            </Link>
          )}
          {hasPermission('documents:read') && (
            <Link href="/documents" className="btn btn-outline btn-md" style={{ padding: '10px 16px' }}>
              <FolderTree size={16} />
              <span>{t('dash.manage_docs')}</span>
            </Link>
          )}
        </div>
      </div>

      {/* ── 2. Admin Quick Navigation Bar ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        {hasPermission('users:manage') && (
          <Link
            href="/users"
            className="ui-card ui-card-interactive"
            style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-primary-subtle)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Users size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Kelola Pengguna
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Akun & Persetujuan
                </div>
              </div>
            </div>
            <ArrowRight size={14} color="var(--text-muted)" />
          </Link>
        )}

        {hasPermission('roles:manage') && (
          <Link
            href="/roles"
            className="ui-card ui-card-interactive"
            style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-success-subtle)',
                  color: 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Role & Hak Akses
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Matriks Perizinan
                </div>
              </div>
            </div>
            <ArrowRight size={14} color="var(--text-muted)" />
          </Link>
        )}

        {hasPermission('audit:read') && (
          <Link
            href="/logs"
            className="ui-card ui-card-interactive"
            style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--color-warning-subtle)',
                  color: 'var(--color-warning)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ScrollText size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Audit Log
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Riwayat Pertanyaan
                </div>
              </div>
            </div>
            <ArrowRight size={14} color="var(--text-muted)" />
          </Link>
        )}

        {hasPermission('chat:query') && (
          <Link
            href="/chat"
            className="ui-card ui-card-interactive"
            style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MessageSquare size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Asisten AI
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Workspace Chat RAG
                </div>
              </div>
            </div>
            <ArrowRight size={14} color="var(--text-muted)" />
          </Link>
        )}
      </div>

      {/* ── 3. Key Metrics Stat Cards ── */}
      <StatCards stats={stats} isLoading={isLoading} />

      {/* ── 4. Main Operational Grid: Recent Activity + System Health ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 360px',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {hasPermission('documents:read') && (
          <RecentBatches
            batches={stats?.recentBatches || []}
            isLoading={isLoading}
          />
        )}

        <SystemHealth stats={stats} />
      </div>
    </div>
  );
}
