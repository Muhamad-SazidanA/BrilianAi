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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── 1. Hero Admin Overview Banner (Clean & Slim) ── */}
      <div
        className="ui-card hero-gradient"
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.25rem',
          flexWrap: 'wrap',
          borderRadius: 'var(--radius-sm)',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: '640px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span
              className="badge badge-neutral"
              style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 600 }}
            >
              Konsol Operasional Sistem
            </span>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 500 }}>
              pgvector RAG · Vision OCR · In-Memory Buffer
            </span>
          </div>

          <h1
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: '26px',
              letterSpacing: '-0.02em',
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
            <Link href="/upload" className="btn btn-primary btn-sm">
              <UploadCloud size={15} />
              <span>{t('dash.upload_new')}</span>
            </Link>
          )}
          {hasPermission('documents:read') && (
            <Link href="/documents" className="btn btn-outline btn-sm">
              <FolderTree size={15} />
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
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Users size={15} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Kelola Pengguna
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Akun & Persetujuan
                </div>
              </div>
            </div>
            <ArrowRight size={13} color="var(--text-muted)" />
          </Link>
        )}

        {hasPermission('roles:manage') && (
          <Link
            href="/roles"
            className="ui-card ui-card-interactive"
            style={{
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={15} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Role & Hak Akses
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Matriks Perizinan
                </div>
              </div>
            </div>
            <ArrowRight size={13} color="var(--text-muted)" />
          </Link>
        )}

        {hasPermission('audit:read') && (
          <Link
            href="/logs"
            className="ui-card ui-card-interactive"
            style={{
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ScrollText size={15} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Audit Log
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Riwayat Pertanyaan
                </div>
              </div>
            </div>
            <ArrowRight size={13} color="var(--text-muted)" />
          </Link>
        )}

        {hasPermission('chat:query') && (
          <Link
            href="/chat"
            className="ui-card ui-card-interactive"
            style={{
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              textDecoration: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MessageSquare size={15} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Asisten AI
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Workspace Chat RAG
                </div>
              </div>
            </div>
            <ArrowRight size={13} color="var(--text-muted)" />
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
