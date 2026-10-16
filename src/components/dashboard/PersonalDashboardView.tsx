'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  Search,
  ArrowRight,
  ArrowUpRight,
  MessageSquare,
  FileText,
  ChevronRight,
  FolderTree,
  FileQuestion,
  Clock,
} from 'lucide-react';
import DashboardMetricCard from './DashboardMetricCard';
import { DashboardStats } from '@/types/stats';
import { ChatSession } from '@/types/chat';
import { UploadBatch } from '@/types/document';
import { useUserSession } from '@/context/UserSessionContext';
import { useLanguage } from '@/context/LanguageContext';

interface PersonalDashboardViewProps {
  stats: DashboardStats | null;
  isLoading: boolean;
  onRefresh: () => void;
  syncTime: string;
}

const STARTER_PROMPTS = [
  {
    id: 'sop',
    title: 'Ringkasan SOP & Kebijakan',
    desc: 'Intisari prosedur kerja, hak kewajiban, dan tata tertib.',
    prompt: 'Tolong ringkaskan poin-poin utama dari SOP dan panduan kerja yang terdaftar di sistem.',
    code: 'SOP',
  },
  {
    id: 'claims',
    title: 'Panduan Klaim & Operasional',
    desc: 'Mekanisme reimbursement dan berkas syarat operasional.',
    prompt: 'Bagaimana prosedur dan syarat pengajuan klaim operasional atau reimbursement yang berlaku?',
    code: 'Ops',
  },
  {
    id: 'compliance',
    title: 'Regulasi & Kepatuhan',
    desc: 'Standar internal, audit kepatuhan, dan etika kerja.',
    prompt: 'Jelaskan poin-poin regulasi dan kepatuhan yang harus dipatuhi seluruh anggota tim.',
    code: 'Legal',
  },
  {
    id: 'tech',
    title: 'Dokumentasi & Laporan Teknis',
    desc: 'Spesifikasi teknis, arsitektur, dan laporan arsip.',
    prompt: 'Tolong cari informasi spesifikasi teknis dan rangkuman laporan yang ada dalam arsip.',
    code: 'Teknis',
  },
];

export default function PersonalDashboardView({
  stats,
  isLoading,
  onRefresh,
  syncTime,
}: PersonalDashboardViewProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const { currentUser } = useUserSession();

  const [queryInput, setQueryInput] = useState('');
  const [recentSessions, setRecentSessions] = useState<ChatSession[]>([]);
  const [activeDocuments, setActiveDocuments] = useState<UploadBatch[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const userName = currentUser?.name || 'Pengguna';
  const firstName = userName.split(' ')[0];
  const department = currentUser?.department || 'Internal';
  const roleName = currentUser?.role?.name || 'Member';

  // Keyboard shortcut listener: '/' or 'Ctrl+K' focuses search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      if ((e.key === '/' && !isInput) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch recent sessions & documents for personal view
  useEffect(() => {
    async function fetchPersonalData() {
      setIsDataLoading(true);
      try {
        const [sessionsRes, docsRes] = await Promise.all([
          fetch('/api/chat-sessions').catch(() => null),
          fetch('/api/documents').catch(() => null),
        ]);

        if (sessionsRes && sessionsRes.ok) {
          const data = await sessionsRes.json();
          setRecentSessions(Array.isArray(data?.sessions) ? data.sessions : []);
        }

        if (docsRes && docsRes.ok) {
          const docsData = await docsRes.json();
          const list = Array.isArray(docsData) ? docsData : [];
          setActiveDocuments(list.filter((b: UploadBatch) => b.is_active_knowledge !== false));
        }
      } catch (err) {
        console.warn('[PersonalDashboardView] Failed to load sessions/docs:', err);
      } finally {
        setIsDataLoading(false);
      }
    }

    fetchPersonalData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim()) return;
    router.push(`/chat?q=${encodeURIComponent(queryInput.trim())}`);
  };

  const handlePromptClick = (text: string) => {
    router.push(`/chat?q=${encodeURIComponent(text)}`);
  };

  const personal = stats?.personal;
  const totalSessionsCount = recentSessions.length || personal?.totalSessions || 0;

  // Format relative time helper
  const getRelativeTime = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Baru saja';
      if (diffMins < 60) return `${diffMins}m lalu`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}j lalu`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}h lalu`;
    } catch {
      return '-';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* ── 1. SLIM USER CONSOLE & SEARCH (Clean, monochrome, no emoji) ── */}
      <div
        className="enterprise-card"
        style={{
          padding: '10px 16px',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        {/* User Identity info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '220px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
              }}
            >
              Halo, {firstName}
            </span>
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 600,
                padding: '1px 7px',
                borderRadius: '4px',
                backgroundColor: 'var(--color-primary-subtle)',
                color: 'var(--color-primary)',
              }}
            >
              {department}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              · {roleName}
            </span>
          </div>
        </div>

        {/* Integrated Quick Search bar with Keyboard Hint */}
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-subtle)',
            border: '1px solid var(--border-default)',
            borderRadius: '9999px',
            padding: '3px 4px 3px 12px',
            flex: '1 1 360px',
            maxWidth: '560px',
            gap: '6px',
          }}
        >
          <Search size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Tanya dokumen... (contoh: SOP cuti, klaim operasional)"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '12px',
              color: 'var(--text-primary)',
            }}
            aria-label="Pencarian cepat dokumen"
          />
          <kbd className="kbd-shortcut" title="Tekan Ctrl+K atau / untuk mencari">
            Ctrl K
          </kbd>
          <button
            type="submit"
            className="btn btn-primary btn-xs"
            style={{
              borderRadius: '9999px',
              padding: '4px 12px',
              fontSize: '11.5px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 500,
            }}
          >
            <Sparkles size={11} />
            <span>Tanya AI</span>
          </button>
        </form>
      </div>

      {/* ── 2. METRIC CARDS ROW (Generous min-width, no text wrapping) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '0.85rem',
        }}
      >
        <DashboardMetricCard
          title="Sesi Percakapan Saya"
          value={`${totalSessionsCount} Sesi`}
          badge="Tersimpan"
          badgeType="neutral"
          footerText="Riwayat obrolan cloud"
          href="/chat"
          isLoading={isLoading}
        />

        <DashboardMetricCard
          title="Pertanyaan Diajukan"
          value={`${personal?.totalQueries ?? 0} Kueri`}
          badge="Audit Jejak"
          badgeType="accent"
          footerText="Disertai referensi halaman"
          isLoading={isLoading}
        />

        <DashboardMetricCard
          title="Dokumen Terverifikasi"
          value={`${activeDocuments.length || stats?.activeKnowledgeCount || 0} Dokumen`}
          badge="100% Siap"
          badgeType="success"
          statusDot="live"
          footerText="Rujukan RAG organisasi"
          href="/documents"
          isLoading={isLoading}
        />

        <DashboardMetricCard
          title="Kecepatan Respon RAG"
          value="< 1.2 dtk"
          badge="Optimal"
          badgeType="success"
          footerText="Presisi tanpa halusinasi"
          isLoading={isLoading}
        />
      </div>

      {/* ── 3. TWO-COLUMN WORKSPACE HUB: CHATS & DOCUMENTS ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '0.85rem',
        }}
      >
        {/* ── Column 1: Percakapan Terakhir Saya ── */}
        <div className="enterprise-card">
          {/* Header */}
          <div className="enterprise-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={13} color="var(--text-secondary)" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Percakapan Terakhir Saya
              </span>
            </div>

            <Link
              href="/chat"
              style={{
                fontSize: '11px',
                color: 'var(--color-primary)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                fontWeight: 500,
              }}
            >
              <span>Buka Chat</span>
              <ArrowUpRight size={11} />
            </Link>
          </div>

          {/* List items with Skeleton Shimmer (No Layout Shift) */}
          <div style={{ padding: '2px 0', flex: 1 }}>
            {isDataLoading ? (
              <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <span className="skeleton-shimmer" style={{ width: '22px', height: '22px', borderRadius: '4px', flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <span className="skeleton-shimmer" style={{ width: '70%', height: '12px' }} />
                        <span className="skeleton-shimmer" style={{ width: '35%', height: '9px' }} />
                      </div>
                    </div>
                    <span className="skeleton-shimmer" style={{ width: '52px', height: '18px', borderRadius: '4px', flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            ) : recentSessions.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Belum ada percakapan
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 8px' }}>
                  Mulai ajukan pertanyaan seputar dokumen perusahaan.
                </p>
                <Link href="/chat" className="btn btn-outline btn-xs" style={{ borderRadius: '6px' }}>
                  Mulai Diskusi Baru
                </Link>
              </div>
            ) : (
              recentSessions.slice(0, 5).map((session) => (
                <Link
                  key={session.id}
                  href={`/chat/w/${session.id}`}
                  className="enterprise-list-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-subtle)',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <MessageSquare size={11} />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '240px',
                        }}
                      >
                        {session.title || 'Percakapan AI'}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {getRelativeTime(session.updated_at || session.created_at)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: '9.5px',
                        color: 'var(--text-secondary)',
                        backgroundColor: 'var(--bg-subtle)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: 500,
                      }}
                    >
                      Lanjutkan
                    </span>
                    <ChevronRight size={12} color="var(--text-muted)" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* ── Column 2: Dokumen Terverifikasi Organisasi ── */}
        <div className="enterprise-card">
          {/* Header */}
          <div className="enterprise-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FolderTree size={13} color="var(--text-secondary)" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Dokumen Terverifikasi Organisasi
              </span>
            </div>

            <Link
              href="/documents"
              style={{
                fontSize: '11px',
                color: 'var(--color-primary)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                fontWeight: 500,
              }}
            >
              <span>Repositori</span>
              <ArrowUpRight size={11} />
            </Link>
          </div>

          {/* List items with Skeleton Shimmer (No Layout Shift) */}
          <div style={{ padding: '2px 0', flex: 1 }}>
            {isDataLoading ? (
              <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                      <span className="skeleton-shimmer" style={{ width: '22px', height: '22px', borderRadius: '4px', flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <span className="skeleton-shimmer" style={{ width: '65%', height: '12px' }} />
                        <span className="skeleton-shimmer" style={{ width: '40%', height: '9px' }} />
                      </div>
                    </div>
                    <span className="skeleton-shimmer" style={{ width: '44px', height: '18px', borderRadius: '4px', flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            ) : activeDocuments.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Belum ada dokumen aktif
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 8px' }}>
                  Dokumen yang diunggah akan otomatis terindeks di sini.
                </p>
                <Link href="/documents" className="btn btn-outline btn-xs" style={{ borderRadius: '6px' }}>
                  Buka Dokumen
                </Link>
              </div>
            ) : (
              activeDocuments.slice(0, 5).map((doc) => (
                <div
                  key={doc.id}
                  className="enterprise-list-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-subtle)',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FileText size={11} />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '240px',
                        }}
                        title={doc.original_filename}
                      >
                        {doc.original_filename}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {doc.page_count} Hal (OCR) · {doc.chunk_count} Chunks
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePromptClick(`Tolong jelaskan intisari dan poin-poin penting dari dokumen "${doc.original_filename}".`)}
                    className="btn btn-outline btn-xs"
                    style={{
                      fontSize: '10.5px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title="Tanyakan isi dokumen ini ke AI"
                  >
                    <span>Tanya</span>
                    <ArrowRight size={10} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── 4. PINTASAN PERTANYAAN CEPAT (Clean, Slim Pill/Card Grid, Monochrome) ── */}
      <div className="enterprise-card" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileQuestion size={13} color="var(--text-secondary)" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Pintasan Pertanyaan Cepat
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Klik untuk mulai berdiskusi</span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '8px',
          }}
        >
          {STARTER_PROMPTS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handlePromptClick(item.prompt)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                border: '1px solid var(--border-default, #e2e8f0)',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'all 0.12s ease',
              }}
              className="hover-bg-subtle"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--bg-card, #ffffff)',
                    border: '1px solid var(--border-default, #cbd5e1)',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    flexShrink: 0,
                  }}
                >
                  {item.code}
                </span>

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      fontSize: '10.5px',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.desc}
                  </div>
                </div>
              </div>

              <ChevronRight size={13} color="var(--text-muted)" style={{ flexShrink: 0, marginLeft: '6px' }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
