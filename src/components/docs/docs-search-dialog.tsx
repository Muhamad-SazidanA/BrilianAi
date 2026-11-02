'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search,
  X,
  BookOpen,
  ShieldCheck,
  UploadCloud,
  Database,
  Sparkles,
  Bot,
  LayoutDashboard,
  Users,
  KeyRound,
  FileText,
  ArrowRight,
  FileQuestion,
  CornerDownLeft,
  type LucideIcon,
} from 'lucide-react';
import type { SharedProps } from 'fumadocs-ui/components/dialog/search';

interface DocItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  chapter: string;
  icon: LucideIcon;
  keywords: string[];
}

const DOCS_DATA_EN: DocItem[] = [
  {
    id: '00-index',
    slug: '00-index',
    title: 'Getting Started with Brilian.Ai',
    description: 'Introductory guide to Brilian.Ai Enterprise Knowledge Base, AI Document Ingestion, and pgvector-backed Copilot.',
    chapter: 'Ch 0',
    icon: BookOpen,
    keywords: ['start', 'introduction', 'overview', 'guide', 'copilot', 'vector', 'setup', 'welcome'],
  },
  {
    id: '01-authentication',
    slug: '01-authentication',
    title: 'Authentication & Session Security',
    description: 'Guide to system sign-in, self-service password updates, administrator password resets, and 30-minute inactivity auto-logout.',
    chapter: 'Ch 1',
    icon: ShieldCheck,
    keywords: ['login', 'signin', 'password', 'reset', 'inactivity', 'timeout', 'logout', 'security', 'session', 'scrypt', 'brute-force'],
  },
  {
    id: '02-upload-and-ingestion',
    slug: '02-upload-and-ingestion',
    title: 'Document Upload & Ingestion',
    description: 'Processing PDF, Word, Excel, and CSV files, AI Vision OCR extraction, sliding-window chunking, and pgvector storage.',
    chapter: 'Ch 2',
    icon: UploadCloud,
    keywords: ['upload', 'ingest', 'pdf', 'word', 'docx', 'excel', 'xlsx', 'csv', 'ocr', 'vision', 'chunk', 'embedding', 'vector'],
  },
  {
    id: '03-knowledge-base',
    slug: '03-knowledge-base',
    title: 'Knowledge Base Management',
    description: 'Managing active knowledge status, privacy classifications, document renaming, and safe deletion.',
    chapter: 'Ch 3',
    icon: Database,
    keywords: ['knowledge', 'active', 'inactive', 'privacy', 'confidential', 'public', 'internal', 'secret', 'rename', 'delete', 'repository'],
  },
  {
    id: '04-ai-curation',
    slug: '04-ai-curation',
    title: 'AI Curation Studio',
    description: 'Zero-Token tabular curation, page-level factual insights extraction, and verified knowledge management.',
    chapter: 'Ch 4',
    icon: Sparkles,
    keywords: ['curation', 'studio', 'insight', 'zero-token', 'tabular', 'facts', 'verification', 'verify', 'review'],
  },
  {
    id: '05-ai-chat',
    slug: '05-ai-chat',
    title: 'AI Assistant & RAG Querying',
    description: 'Conversing with the enterprise AI Assistant, source page citation tracking, automated Markdown tables, and session exports.',
    chapter: 'Ch 5',
    icon: Bot,
    keywords: ['assistant', 'chat', 'rag', 'query', 'citation', 'sources', 'table', 'markdown', 'export', 'conversations'],
  },
  {
    id: '06-ai-dashboard',
    slug: '06-ai-dashboard',
    title: 'Dynamic Dashboard & Copilot Canvas',
    description: 'Card-based interactive analytics, 2D corner resizing, draggable layout persistence, and the Floating Copilot Canvas.',
    chapter: 'Ch 6',
    icon: LayoutDashboard,
    keywords: ['dashboard', 'copilot', 'canvas', 'widget', 'resize', 'drag', 'cards', 'analytics', 'charts', 'floating'],
  },
  {
    id: '07-user-management',
    slug: '07-user-management',
    title: 'User Management',
    description: 'User account approval workflows, account suspension, and role assignment by Super Administrators.',
    chapter: 'Ch 7',
    icon: Users,
    keywords: ['user', 'users', 'management', 'approval', 'suspend', 'staff', 'admin', 'superadmin', 'accounts'],
  },
  {
    id: '08-roles-and-permissions',
    slug: '08-roles-and-permissions',
    title: 'Roles & Permissions Matrix',
    description: 'Granular RBAC permission configuration, ABAC document classification filtering, and system role governance.',
    chapter: 'Ch 8',
    icon: KeyRound,
    keywords: ['role', 'roles', 'permission', 'permissions', 'matrix', 'rbac', 'abac', 'access', 'grant', 'security'],
  },
  {
    id: '09-audit-logs',
    slug: '09-audit-logs',
    title: 'Audit Logs & Enterprise Compliance',
    description: 'System activity trail auditing, chat turn tracking, and security log exports (CSV/JSON).',
    chapter: 'Ch 9',
    icon: FileText,
    keywords: ['audit', 'logs', 'compliance', 'trail', 'tracking', 'export', 'csv', 'json', 'activity', 'enterprise'],
  },
];

const DOCS_DATA_ID: DocItem[] = [
  {
    id: '00-index',
    slug: '00-index',
    title: 'Memulai dengan Brilian.Ai',
    description: 'Panduan pengenalan platform Knowledge Base enterprise, AI Ingestion dokumen, dan AI Copilot terkurasi berbasis pgvector.',
    chapter: 'Bab 0',
    icon: BookOpen,
    keywords: ['memulai', 'pengenalan', 'panduan', 'copilot', 'vector', 'setup', 'selamat datang', 'fitur'],
  },
  {
    id: '01-authentication',
    slug: '01-authentication',
    title: 'Autentikasi & Keamanan Sesi',
    description: 'Panduan masuk ke sistem, ganti kata sandi mandiri, reset kata sandi oleh administrator, dan fitur auto-logout inactivity 30 menit.',
    chapter: 'Bab 1',
    icon: ShieldCheck,
    keywords: ['login', 'masuk', 'kata sandi', 'password', 'reset', 'inactivity', 'timeout', 'logout', 'keamanan', 'sesi', 'scrypt', 'brute force'],
  },
  {
    id: '02-upload-and-ingestion',
    slug: '02-upload-and-ingestion',
    title: 'Upload & Ingestion Dokumen',
    description: 'Alur pemrosesan berkas PDF, Word, Excel, dan CSV, ekstraksi AI Vision OCR, pemotongan sliding window, dan penyimpanan pgvector.',
    chapter: 'Bab 2',
    icon: UploadCloud,
    keywords: ['upload', 'unggah', 'ingestion', 'pdf', 'word', 'docx', 'excel', 'xlsx', 'csv', 'ocr', 'vision', 'chunk', 'embedding', 'vektor'],
  },
  {
    id: '03-knowledge-base',
    slug: '03-knowledge-base',
    title: 'Repositori Knowledge Base',
    description: 'Pengelolaan status dokumen aktif (Active Knowledge), klasifikasi hak akses keamanan, penamaan arsip, dan penghapusan data.',
    chapter: 'Bab 3',
    icon: Database,
    keywords: ['knowledge', 'pengetahuan', 'aktif', 'inaktif', 'rahasia', 'privasi', 'publik', 'internal', 'ganti nama', 'hapus', 'arsip'],
  },
  {
    id: '04-ai-curation',
    slug: '04-ai-curation',
    title: 'AI Curation Studio',
    description: 'Kurasi wawasan otomatis (Zero-Token Tabular Engine), ekstraksi fakta kunci per halaman, dan verifikasi status kurasi.',
    chapter: 'Bab 4',
    icon: Sparkles,
    keywords: ['kurasi', 'curation', 'studio', 'wawasan', 'insight', 'zero-token', 'tabular', 'fakta', 'verifikasi', 'status'],
  },
  {
    id: '05-ai-chat',
    slug: '05-ai-chat',
    title: 'AI Assistant & Tanya Jawab RAG',
    description: 'Panduan berinteraksi dengan AI Assistant, pelacakan sitasi halaman asli, pemformatan tabel Markdown otomatis, dan ekspor percakapan.',
    chapter: 'Bab 5',
    icon: Bot,
    keywords: ['assistant', 'asisten', 'chat', 'tanya jawab', 'rag', 'sitasi', 'citation', 'tabel', 'markdown', 'ekspor', 'percakapan'],
  },
  {
    id: '06-ai-dashboard',
    slug: '06-ai-dashboard',
    title: 'Dynamic Dashboard & Copilot Canvas',
    description: 'Visualisasi analitik berbasis kartu, tata letak grid interaktif (drag & 2D resize), persistensi layout, dan Floating Copilot Canvas.',
    chapter: 'Bab 6',
    icon: LayoutDashboard,
    keywords: ['dashboard', 'copilot', 'canvas', 'widget', 'kartu', 'analitik', 'grafik', 'resize', 'drag', 'tata letak'],
  },
  {
    id: '07-user-management',
    slug: '07-user-management',
    title: 'Manajemen Pengguna',
    description: 'Persetujuan pendaftaran akun baru, penonaktifan akun staf, dan penerbitan kredensial sementara oleh Super Administrator.',
    chapter: 'Bab 7',
    icon: Users,
    keywords: ['pengguna', 'user', 'manajemen', 'persetujuan', 'approval', 'suspend', 'nonaktifkan', 'staf', 'admin', 'superadmin'],
  },
  {
    id: '08-roles-and-permissions',
    slug: '08-roles-and-permissions',
    title: 'Role & Matriks Hak Akses',
    description: 'Konfigurasi izin granular (RBAC), klasifikasi keamanan dokumen yang diizinkan (ABAC), dan manajemen peran sistem.',
    chapter: 'Bab 8',
    icon: KeyRound,
    keywords: ['role', 'peran', 'hak akses', 'izin', 'permission', 'matriks', 'matrix', 'rbac', 'abac', 'keamanan'],
  },
  {
    id: '09-audit-logs',
    slug: '09-audit-logs',
    title: 'Audit Logs & Kepatuhan Enterprise',
    description: 'Pelacakan jejak aktivitas sistem, pencatatan audit percakapan chat, dan ekspor riwayat keamanan (CSV/JSON).',
    chapter: 'Bab 9',
    icon: FileText,
    keywords: ['audit', 'logs', 'kepatuhan', 'compliance', 'jejak', 'aktivitas', 'ekspor', 'csv', 'json', 'riwayat'],
  },
];

export function DocsSearchDialog({ open, onOpenChange }: SharedProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isIndonesian = pathname?.includes('/docs/id') || false;
  const lang = isIndonesian ? 'id' : 'en';
  const dataList = isIndonesian ? DOCS_DATA_ID : DOCS_DATA_EN;

  // Reset state when dialog opens or closes
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dataList;

    const terms = q.split(/\s+/).filter(Boolean);

    return dataList
      .map((item) => {
        let score = 0;
        const titleLower = item.title.toLowerCase();
        const descLower = item.description.toLowerCase();
        const keywordsLower = item.keywords.join(' ').toLowerCase();

        for (const term of terms) {
          if (titleLower.includes(term)) {
            score += titleLower.startsWith(term) ? 15 : 10;
          }
          if (keywordsLower.includes(term)) {
            score += 6;
          }
          if (descLower.includes(term)) {
            score += 3;
          }
        }

        return { item, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }, [query, dataList]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length === 0 ? 0 : (prev + 1) % filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length === 0 ? 0 : (prev - 1 + filteredItems.length) % filteredItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          const target = filteredItems[selectedIndex];
          onOpenChange(false);
          router.push(`/docs/${lang}/${target.slug}`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredItems, selectedIndex, onOpenChange, router, lang]);

  // Scroll selected item into view smoothly
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!open) return null;

  const handleSelect = (item: DocItem) => {
    onOpenChange(false);
    router.push(`/docs/${lang}/${item.slug}`);
  };

  return (
    <>
      {/* Backdrop with elegant blur */}
      <div
        className="docs-search-overlay"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Dialog Modal Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isIndonesian ? 'Pencarian Dokumentasi' : 'Documentation Search'}
        className="docs-search-modal"
      >
        {/* Search Input Bar */}
        <div className="docs-search-header">
          <Search size={19} className="docs-search-icon-search" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isIndonesian
                ? 'Cari panduan, fitur, topik (cth: login, pgvector, kurasi)...'
                : 'Search guides, features, topics (e.g. login, pgvector, curation)...'
            }
            className="docs-search-input"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="docs-search-clear"
              aria-label="Clear input"
            >
              <X size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="docs-search-esc-btn"
          >
            ESC
          </button>
        </div>

        {/* Section Label */}
        <div className="docs-search-section-bar">
          <span className="docs-search-section-title">
            {query.trim()
              ? isIndonesian
                ? `Hasil Pencarian (${filteredItems.length})`
                : `Search Results (${filteredItems.length})`
              : isIndonesian
                ? 'Daftar Panduan & Modul'
                : 'All Guides & Topics'}
          </span>
          <span className="docs-search-section-badge">
            {lang.toUpperCase()} Docs
          </span>
        </div>

        {/* Results / List Area */}
        <div ref={listRef} className="docs-search-list">
          {filteredItems.length === 0 ? (
            <div className="docs-search-empty">
              <FileQuestion size={40} className="docs-search-empty-icon" />
              <div className="docs-search-empty-title">
                {isIndonesian ? `Tidak ditemukan hasil untuk "${query}"` : `No results found for "${query}"`}
              </div>
              <div className="docs-search-empty-hint">
                {isIndonesian
                  ? 'Coba cari dengan kata kunci umum seperti login, password, upload, kurasi, atau role.'
                  : 'Try searching with common terms such as login, password, upload, curation, or role.'}
              </div>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = selectedIndex === idx;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`docs-search-item ${isSelected ? 'is-selected' : ''}`}
                >
                  <div className="docs-search-item-left">
                    <div className="docs-search-icon-box">
                      <Icon size={16} />
                    </div>
                    <div className="docs-search-text-box">
                      <div className="docs-search-title-row">
                        <span className="docs-search-item-title">
                          {item.title}
                        </span>
                        <span className="docs-search-chapter-tag">
                          {item.chapter}
                        </span>
                      </div>
                      <div className="docs-search-item-desc">
                        {item.description}
                      </div>
                    </div>
                  </div>
                  <div className="docs-search-item-right">
                    {isSelected ? (
                      <span className="docs-search-enter-badge">
                        <CornerDownLeft size={12} />
                        <span>{isIndonesian ? 'Buka' : 'Open'}</span>
                      </span>
                    ) : (
                      <ArrowRight size={14} className="docs-search-arrow" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Quick Controls */}
        <div className="docs-search-footer">
          <div className="docs-search-footer-left">
            <span>
              <kbd className="docs-search-kbd">↑</kbd>
              <kbd className="docs-search-kbd">↓</kbd>
              <span>{isIndonesian ? 'navigasi' : 'navigate'}</span>
            </span>
            <span>
              <kbd className="docs-search-kbd">↵</kbd>
              <span>{isIndonesian ? 'buka' : 'select'}</span>
            </span>
          </div>
          <div>
            <kbd className="docs-search-kbd">ESC</kbd>
            <span>{isIndonesian ? 'tutup' : 'close'}</span>
          </div>
        </div>
      </div>
    </>
  );
}
