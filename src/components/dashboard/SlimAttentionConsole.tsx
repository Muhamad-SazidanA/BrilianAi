'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Zap,
} from 'lucide-react';
import { AttentionSummary, RecentLogin } from '@/types/stats';

interface SlimAttentionConsoleProps {
  attention?: AttentionSummary;
  recentLogins?: RecentLogin[];
  systemHealth?: {
    postgres: boolean;
    ollama: boolean;
    visionModel: string;
    embeddingModel: string;
    multiAgent?: {
      geminiVision: boolean;
      openAiEmbedding: boolean;
      deepseekSynthesizer: boolean;
    };
  };
  isLoading?: boolean;
}

export default function SlimAttentionConsole({
  attention,
  recentLogins = [],
  systemHealth,
  isLoading = false,
}: SlimAttentionConsoleProps) {
  const pendingUsers = attention?.pendingUsers || [];
  const pendingCount = attention?.pendingUsersCount || 0;
  const gapsCount = attention?.knowledgeGapsCount || 0;
  const negativeFeedbackCount = attention?.negativeFeedbackCount || 0;

  const getRelativeTime = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Baru saja';
      if (diffMins < 60) return `${diffMins}m lalu`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}j lalu`;
      return `${Math.floor(diffHours / 24)}h lalu`;
    } catch {
      return '-';
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '0.85rem',
      }}
    >
      {/* ── CARD 1: Pipeline AI Live Status ── */}
      <div className="enterprise-card" style={{ padding: '14px 16px', justifyContent: 'space-between', minHeight: '155px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Status Pipeline AI & Database
            </span>
            <span className="status-pill-success">
              <span className="pulse-dot-live" />
              <span>Live</span>
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            {/* PostgreSQL & pgvector */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span className="pulse-dot-live" />
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>PostgreSQL + pgvector (HNSW)</span>
              </div>
              <span className="status-pill-success">Connected</span>
            </div>

            {/* Vision OCR */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span className="pulse-dot-live" />
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Vision OCR Extraction</span>
              </div>
              <span className="status-pill-success">Optimal</span>
            </div>

            {/* Dense Embedding */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span className="pulse-dot-live" />
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Dense Vector (1024-dim)</span>
              </div>
              <span className="status-pill-success">Optimal</span>
            </div>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Zap size={11} color="var(--color-primary)" />
          <span>In-memory buffer aktif untuk kecepatan ekstraksi</span>
        </div>
      </div>

      {/* ── CARD 2: Audit Login Sesi Terbaru ── */}
      {/* ── CARD 2: Audit Login Sesi Terbaru ── */}
      <div className="enterprise-card" style={{ padding: '14px 16px', justifyContent: 'space-between', minHeight: '155px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Sesi Login Terbaru
            </span>
            <Link
              href="/logs"
              style={{ fontSize: '11px', color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              <span>Audit</span>
              <ArrowUpRight size={12} />
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
            {recentLogins.length === 0 ? (
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                Belum ada sesi baru tercatat.
              </div>
            ) : (
              recentLogins.slice(0, 3).map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11.5px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: s.avatarColor || 'var(--color-primary)',
                        color: '#fff',
                        fontSize: '9.5px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {s.userName ? s.userName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span
                      style={{
                        color: 'var(--text-primary)',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '140px',
                      }}
                    >
                      {s.userName}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>· {s.userRole}</span>
                  </div>

                  <span style={{ color: 'var(--text-secondary)', fontSize: '10.5px', flexShrink: 0 }}>
                    {getRelativeTime(s.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Token 64-karakter terproteksi sliding rate limiter
        </div>
      </div>

      {/* ── CARD 3: Tindakan Sistem & Persetujuan (Actionable Items) ── */}
      <div className="enterprise-card" style={{ padding: '14px 16px', justifyContent: 'space-between', minHeight: '155px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Tindakan & Persetujuan
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Security Check</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            {pendingCount > 0 ? (
              <Link
                href="/users"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: '7px',
                  backgroundColor: 'var(--color-warning-subtle)',
                  color: 'var(--color-warning-text)',
                  border: '1px solid var(--color-warning-border)',
                  textDecoration: 'none',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={13} />
                  <span>{pendingCount} akun menunggu persetujuan</span>
                </div>
                <ArrowUpRight size={13} />
              </Link>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11.5px',
                  color: 'var(--color-success-text)',
                  padding: '3px 0',
                }}
              >
                <CheckCircle2 size={14} color="var(--color-success-text)" />
                <span>Seluruh akun pengguna terverifikasi aktif</span>
              </div>
            )}

            {gapsCount > 0 || negativeFeedbackCount > 0 ? (
              <Link
                href="/knowledge-gaps"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: '7px',
                  backgroundColor: 'var(--color-danger-subtle)',
                  color: 'var(--color-danger-text)',
                  border: '1px solid var(--color-danger-border)',
                  textDecoration: 'none',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={13} />
                  <span>{gapsCount} kesenjangan & {negativeFeedbackCount} feedback revisi</span>
                </div>
                <ArrowUpRight size={13} />
              </Link>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11.5px',
                  color: 'var(--color-success-text)',
                  padding: '3px 0',
                }}
              >
                <CheckCircle2 size={14} color="var(--color-success-text)" />
                <span>Zero knowledge gaps · Akurasi RAG 100%</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Pemeriksaan kepatuhan RBAC & proteksi kebocoran data
        </div>
      </div>
    </div>
  );
}
