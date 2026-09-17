'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  BookOpen,
  Sparkles,
  ArrowRight,
  FileText,
  Clock,
  Search,
  CheckCircle2,
  Layers,
  ArrowUpRight,
  Lightbulb,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
import { formatDateOnly } from '@lib/utils/formatters';
import { UploadBatch } from '@/types/document';
import { ChatSession } from '@/types/chat';

interface UserDashboardProps {
  onSwitchToAdmin?: () => void;
  canSwitchToAdmin?: boolean;
}

const STARTER_PROMPTS = [
  {
    id: 'sop',
    title: 'Ringkasan SOP & Kebijakan',
    desc: 'Cari tahu ringkasan poin-poin penting dari dokumen SOP dan panduan kerja.',
    prompt: 'Tolong ringkaskan poin-poin utama dari SOP dan panduan kerja yang terdaftar di sistem.',
    category: 'Prosedur',
    icon: FileText,
    color: '#2563EB',
    bgColor: '#EFF6FF',
  },
  {
    id: 'claims',
    title: 'Panduan Klaim & Operasional',
    desc: 'Pelajari mekanisme reimbursement, operasional harian, dan persyaratan dokumen.',
    prompt: 'Bagaimana prosedur dan syarat pengajuan klaim operasional atau reimbursement yang berlaku?',
    category: 'Operasional',
    icon: Sparkles,
    color: '#10B981',
    bgColor: '#ECFDF5',
  },
  {
    id: 'compliance',
    title: 'Regulasi & Kepatuhan',
    desc: 'Telusuri pasal, kewajiban, dan regulasi internal yang relevan bagi anggota tim.',
    prompt: 'Jelaskan poin-poin regulasi dan kepatuhan yang harus dipatuhi seluruh anggota tim.',
    category: 'Kepatuhan',
    icon: CheckCircle2,
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
  },
  {
    id: 'tech',
    title: 'Dokumentasi & Laporan Teknis',
    desc: 'Temukan detail teknis, spesifikasi, dan laporan temuan dari arsip terverifikasi.',
    prompt: 'Tolong cari informasi spesifikasi teknis dan rangkuman laporan yang ada dalam arsip.',
    category: 'Teknis',
    icon: BookOpen,
    color: '#F59E0B',
    bgColor: '#FFFBEB',
  },
];

export default function UserDashboard({
  onSwitchToAdmin,
  canSwitchToAdmin = false,
}: UserDashboardProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const { currentUser } = useUserSession();

  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quickQuery, setQuickQuery] = useState('');

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [docsRes, chatRes] = await Promise.all([
          fetch('/api/documents').catch(() => null),
          fetch('/api/chat-sessions').catch(() => null),
        ]);

        if (docsRes && docsRes.ok) {
          const docs = await docsRes.json();
          setBatches(Array.isArray(docs) ? docs : []);
        }

        if (chatRes && chatRes.ok) {
          const chatData = await chatRes.json();
          setSessions(Array.isArray(chatData.sessions) ? chatData.sessions : []);
        }
      } catch (err) {
        console.warn('Failed to load user dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter active knowledge documents
  const activeBatches = batches.filter((b) => b.is_active_knowledge !== false);
  const totalPages = activeBatches.reduce((acc, b) => acc + (b.page_count || 0), 0);

  const handleStartPrompt = (promptText: string) => {
    router.push(`/chat?q=${encodeURIComponent(promptText)}`);
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuery.trim()) return;
    router.push(`/chat?q=${encodeURIComponent(quickQuery.trim())}`);
  };

  const userName = currentUser?.name || 'Pengguna';
  const firstName = userName.split(' ')[0];
  const department = currentUser?.department || 'Knowledge Member';
  const roleName = currentUser?.role?.name || 'Member';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* ── 1. Personalized User Welcome Hero ── */}
      <div
        className="ui-card hero-gradient"
        style={{
          padding: '2rem 2.25rem',
          borderRadius: 'var(--radius-xl)',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ maxWidth: '680px', position: 'relative', zIndex: 1 }}>
          {/* Badge line */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <span
              className="badge badge-accent"
              style={{ padding: '3px 12px', fontSize: '11px', fontWeight: 700 }}
            >
              Knowledge Assistant Hub
            </span>
            <span
              className="badge badge-neutral"
              style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 600 }}
            >
              {department}
            </span>
            <span
              style={{
                fontSize: '11.5px',
                color: 'var(--text-secondary)',
                fontWeight: 500,
              }}
            >
              Peran: {roleName}
            </span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(22px, 3vw, 28px)',
              fontWeight: 800,
              color: 'var(--text-primary)',
              lineHeight: 1.25,
              letterSpacing: '-0.025em',
            }}
          >
            Halo, {firstName}! 👋
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              marginTop: '8px',
              lineHeight: '24px',
              fontWeight: 500,
            }}
          >
            Akses seluruh dokumen pengetahuan perusahaan yang telah terverifikasi. Tanyakan apa saja mengenai SOP, kebijakan, kontrak, dan operasional dengan presisi tinggi.
          </p>

          {/* Quick Input Bar directly in Hero */}
          <form
            onSubmit={handleQuickSubmit}
            style={{
              marginTop: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: '9999px',
              padding: '6px 8px 6px 18px',
              boxShadow: 'var(--shadow-sm)',
              maxWidth: '560px',
            }}
          >
            <Search size={17} color="var(--text-muted)" style={{ flexShrink: 0, marginRight: '10px' }} />
            <input
              type="text"
              placeholder="Tanya dokumen apa saja... (contoh: Bagaimana SOP pengajuan cuti?)"
              value={quickQuery}
              onChange={(e) => setQuickQuery(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13.5px',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              style={{ borderRadius: '9999px', padding: '7px 16px', fontSize: '13px' }}
            >
              <Sparkles size={14} />
              <span>Tanya AI</span>
            </button>
          </form>
        </div>

        {/* Optional View Switcher for Admins testing User View */}
        {canSwitchToAdmin && (
          <div
            style={{
              position: 'absolute',
              top: '1.5rem',
              right: '1.5rem',
              zIndex: 2,
            }}
          >
            <div className="view-mode-pill">
              <button
                type="button"
                className="view-mode-btn active"
              >
                Tampilan Pengguna
              </button>
              <button
                type="button"
                onClick={onSwitchToAdmin}
                className="view-mode-btn"
                title="Beralih ke Dashboard Operasional Admin"
              >
                Tampilan Admin
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 2. User-Centric Stat Cards (4 Cards) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* Card 1: Dokumen Siap Diakses */}
        <div className="ui-card ui-card-interactive" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Dokumen Terverifikasi
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-primary-subtle)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BookOpen size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {isLoading ? '...' : activeBatches.length}
            </span>
            <span className="badge badge-accent" style={{ fontSize: '11px' }}>
              Aktif RAG
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            {totalPages} halaman dokumen siap dianalisis
          </p>
        </div>

        {/* Card 2: Percakapan Saya */}
        <div className="ui-card ui-card-interactive" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Sesi Percakapan Saya
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-success-subtle)',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {isLoading ? '...' : sessions.length}
            </span>
            <span className="badge badge-success" style={{ fontSize: '11px' }}>
              Tersimpan
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Riwayat sesi tanya jawab tersimpan aman
          </p>
        </div>

        {/* Card 3: Topik Pengetahuan */}
        <div className="ui-card ui-card-interactive" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Topik & Kategori
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-warning-subtle)',
                color: 'var(--color-warning)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Layers size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              4+
            </span>
            <span className="badge badge-warning" style={{ fontSize: '11px' }}>
              Kategori
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            SOP, Regulasi, Kebijakan & Laporan
          </p>
        </div>

        {/* Card 4: Status AI Knowledge Assistant */}
        <div className="ui-card ui-card-interactive" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Status AI Assistant
            </span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-success-subtle)',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-success)', letterSpacing: '-0.02em' }}>
              Online & Siap
            </span>
            <span className="badge badge-success" style={{ fontSize: '10.5px' }}>
              Llama-3 RAG
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            Vision OCR & Vektor Dense 1024-dim
          </p>
        </div>
      </div>

      {/* ── 3. Interactive Starter Prompts ("Inspirasi Pertanyaan") ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              💡 Inspirasi Pertanyaan Cepat
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Pilih topik di bawah untuk langsung menanyakan intisari dokumen ke AI Assistant:
            </p>
          </div>
          <Link href="/chat" className="btn btn-ghost btn-sm" style={{ gap: '4px', fontSize: '13px' }}>
            <span>Buka Chat Workspace</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
          }}
        >
          {STARTER_PROMPTS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.id}
                onClick={() => handleStartPrompt(p.prompt)}
                className="prompt-starter-card"
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div
                      className="prompt-icon"
                      style={{ backgroundColor: p.bgColor, color: p.color }}
                    >
                      <Icon size={17} />
                    </div>
                    <span className="badge badge-neutral" style={{ fontSize: '10.5px' }}>
                      {p.category}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {p.title}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '18px' }}>
                    {p.desc}
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-primary)',
                    marginTop: '4px',
                  }}
                >
                  <span>Tanyakan ini</span>
                  <ArrowUpRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 4. Main 2-Column Split: Knowledge Documents & Recent Activity ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Active Knowledge Hub */}
        <div className="ui-card" style={{ padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-default)',
              paddingBottom: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                📚 Dokumen Pengetahuan Terverifikasi
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Arsip resmi perusahaan yang aktif menjadi basis jawaban AI Chatbot
              </p>
            </div>
            <Link href="/documents" className="btn btn-ghost btn-sm" style={{ gap: '4px', fontSize: '13px' }}>
              <span>Lihat Semua ({batches.length})</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {isLoading ? (
            <div style={{ padding: '2.5rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div
                className="animate-spin"
                style={{
                  width: '24px',
                  height: '24px',
                  border: '2px solid var(--border-default)',
                  borderTopColor: 'var(--color-primary)',
                  borderRadius: '50%',
                  margin: '0 auto 8px',
                }}
              />
              <p style={{ fontSize: '13px' }}>Memuat daftar dokumen...</p>
            </div>
          ) : activeBatches.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
              <FileText size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Belum Ada Dokumen Aktif
              </h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Administrator belum mengaktifkan dokumen pengetahuan. Silakan hubungi admin Anda.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeBatches.slice(0, 5).map((batch) => {
                const dateStr = formatDateOnly(batch.uploaded_at, language);

                return (
                  <div
                    key={batch.id}
                    className="knowledge-list-item"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--color-primary-subtle)',
                          color: 'var(--color-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <FileText size={18} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '13.5px',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={batch.original_filename}
                        >
                          {batch.original_filename}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '11.5px',
                            color: 'var(--text-secondary)',
                            marginTop: '2px',
                          }}
                        >
                          <span className="badge badge-neutral font-mono" style={{ fontSize: '10px' }}>
                            {batch.page_count} Hal
                          </span>
                          <span>·</span>
                          <span className="badge badge-accent font-mono" style={{ fontSize: '10px' }}>
                            {batch.chunk_count} Chunks
                          </span>
                          <span>·</span>
                          <span>{dateStr}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() =>
                          handleStartPrompt(
                            `Jelaskan ringkasan dan poin penting dari dokumen "${batch.original_filename}"`
                          )
                        }
                        className="btn btn-outline btn-xs"
                        style={{
                          borderRadius: '9999px',
                          padding: '4px 12px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          gap: '5px',
                        }}
                        title={`Tanya AI seputar ${batch.original_filename}`}
                      >
                        <MessageSquare size={12} />
                        <span>Tanya Dokumen</span>
                      </button>
                      <Link
                        href={`/documents/${batch.id}`}
                        className="btn btn-ghost btn-xs"
                        style={{ padding: '4px 8px', fontSize: '11.5px' }}
                        title="Buka Studio Dokumen"
                      >
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Recent Sessions & Smart Tips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Recent Chat Sessions */}
          <div className="ui-card" style={{ padding: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-default)',
                paddingBottom: '0.75rem',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} color="var(--color-primary)" />
                <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Riwayat Percakapan
                </h3>
              </div>
              <Link href="/chat" className="btn btn-ghost btn-xs" style={{ fontSize: '11.5px' }}>
                Chat Baru
              </Link>
            </div>

            {sessions.length === 0 ? (
              <div style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <MessageSquare size={24} color="var(--text-muted)" style={{ margin: '0 auto 6px' }} />
                <p style={{ fontSize: '12.5px', fontWeight: 600 }}>Belum ada riwayat chat</p>
                <p style={{ fontSize: '11.5px', marginTop: '2px' }}>
                  Pertanyaan yang Anda ajukan akan muncul di sini.
                </p>
                <Link href="/chat" className="btn btn-primary btn-xs" style={{ marginTop: '10px' }}>
                  Mulai Chat Pertama
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sessions.slice(0, 4).map((session) => (
                  <Link
                    key={session.id}
                    href={`/chat/w/${session.id}`}
                    className="ui-card-interactive"
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textDecoration: 'none',
                    }}
                  >
                    <div style={{ minWidth: 0, paddingRight: '8px' }}>
                      <div
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {session.title || 'Percakapan Tanpa Judul'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {session.messages?.length || 0} pesan
                      </div>
                    </div>
                    <ArrowRight size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Smart Tips Card */}
          <div
            className="ui-card"
            style={{
              padding: '1.25rem',
              backgroundColor: 'var(--color-primary-subtle)',
              borderColor: 'var(--color-primary-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Lightbulb size={17} color="var(--color-primary)" />
              <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-primary)' }}>
                Tips Memaksimalkan Jawaban AI
              </h4>
            </div>
            <ul
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: '18px',
                paddingLeft: '1.2rem',
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <li>Sebutkan nama dokumen spesifik jika ingin fokus pada berkas tertentu.</li>
              <li>Klik nomor halaman sumber pada sitasi jawaban untuk melihat kutipan asli.</li>
              <li>Ekspor riwayat sesi tanya jawab ke format Markdown kapan pun dibutuhkan.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
