'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  UploadCloud,
  FolderTree,
  MessageSquare,
  ChevronsLeft,
  ChevronsRight,
  Users,
  ShieldCheck,
  ScrollText,
  Plus,
  LogIn,
} from 'lucide-react';

import NavUser from './NavUser';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
import { PermissionKey } from '@/types/user';
import { ChatSession } from '@/types/chat';
import ChatHistoryItem from '@/components/chat/ChatHistoryItem';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { toast } from 'sonner';

interface SidebarProps {
  stats?: {
    totalDocuments: number;
    activeKnowledgeCount: number;
  } | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  stats,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, t } = useLanguage();
  const { currentUser, hasPermission } = useUserSession();
  const [docCount, setDocCount] = useState<number>(stats?.totalDocuments || 0);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // ── Chat History State ────────────────────────────────────────────
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [newChatLoading, setNewChatLoading] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // Active session UUID from URL /chat/w/[uuid]
  const activeSessionId = useMemo(() => {
    const match = pathname.match(/^\/chat\/w\/([0-9a-f-]{36})$/i);
    return match ? match[1] : null;
  }, [pathname]);

  // Fetch chat sessions (only if user has chat permission)
  const fetchChatSessions = useCallback(async () => {
    if (!hasPermission('chat:query') || !currentUser) return;
    setSessionsLoading(true);
    try {
      const res = await fetch('/api/chat-sessions');
      if (res.ok) {
        const data = await res.json();
        setChatSessions(data.sessions || []);
      }
    } catch {
      // Quiet fallback
    } finally {
      setSessionsLoading(false);
    }
  }, [hasPermission, currentUser]);

  // Re-fetch whenever we navigate to/from chat routes
  useEffect(() => {
    fetchChatSessions();
  }, [fetchChatSessions, pathname]);

  // ── Session Actions ───────────────────────────────────────────────
  const handleNewChat = async () => {
    if (newChatLoading) return;
    if (!currentUser) {
      router.push('/login');
      return;
    }
    setNewChatLoading(true);
    router.push('/chat');
    setNewChatLoading(false);
  };


  const handleSessionClick = (sessionId: string) => {
    router.push(`/chat/w/${sessionId}`);
  };

  const handleRename = async (sessionId: string, newTitle: string) => {
    try {
      const res = await fetch(`/api/chat-sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        setChatSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s))
        );
      }
    } catch {
      toast.error('Gagal mengubah nama chat');
    }
  };

  const handlePin = async (sessionId: string, currentPinned: boolean) => {
    try {
      const res = await fetch(`/api/chat-sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !currentPinned }),
      });
      if (res.ok) {
        setChatSessions((prev) => {
          const updated = prev.map((s) =>
            s.id === sessionId ? { ...s, is_pinned: !currentPinned } : s
          );
          // Re-sort: pinned first
          return [...updated].sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          });
        });
      }
    } catch {
      toast.error('Gagal mengubah status pin');
    }
  };

  const handleDelete = (sessionId: string) => {
    const target = chatSessions.find((s) => s.id === sessionId);
    setSessionToDelete({ id: sessionId, title: target?.title || 'Sesi Chat' });
  };

  const handleConfirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    setIsDeletingSession(true);
    try {
      const res = await fetch(`/api/chat-sessions/${sessionToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        setChatSessions((prev) => prev.filter((s) => s.id !== sessionToDelete.id));
        if (activeSessionId === sessionToDelete.id) {
          router.push('/chat');
        }
        const title = sessionToDelete.title;
        setSessionToDelete(null);
        toast.success(
          language === 'en'
            ? `Chat session "${title}" deleted`
            : `Sesi chat "${title}" berhasil dihapus`
        );
      } else {
        throw new Error('Gagal menghapus sesi chat');
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus sesi chat');
    } finally {
      setIsDeletingSession(false);
    }
  };

  // ── Theme ─────────────────────────────────────────────────────────
  useEffect(() => {
    const updateTheme = () => {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('theme_preference') : null;
      const attr = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null;
      if (saved === 'dark' || attr === 'dark') {
        setTheme('dark');
      } else {
        setTheme('light');
      }
    };

    updateTheme();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'data-theme') {
          updateTheme();
        }
      }
    });

    if (typeof document !== 'undefined') {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'theme_preference') {
        updateTheme();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const logoSrc = useMemo(() => {
    const isDark = theme === 'dark';
    if (isCollapsed) {
      return isDark
        ? '/images/Brilian.AI%20logo-Close-P.svg'
        : '/images/BrilianLogo-Close-B.svg';
    } else {
      return isDark
        ? '/images/BrilianLogo-Open-P.svg'
        : '/images/BrilianLogo-Open-B.svg';
    }
  }, [theme, isCollapsed]);

  useEffect(() => {
    async function checkDocCount() {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) {
          const data = await res.json();
          setDocCount(data.totalDocuments || 0);
        }
      } catch {
        // quiet fallback
      }
    }
    checkDocCount();
  }, [pathname]);

  const navGroups = !currentUser ? [] : [
    {
      group: language === 'en' ? 'AI Workspace' : 'Workspace AI',
      items: [
        {
          label: t('nav.dashboard'),
          href: '/',
          icon: LayoutDashboard,
          badge: null,
          isActive: pathname === '/' || pathname === '/dashboard',
          permission: null,
        },

        {
          label: t('nav.upload'),
          href: '/upload',
          icon: UploadCloud,
          badge: null,
          isActive: pathname === '/upload',
          permission: 'documents:upload' as PermissionKey,
        },
        {
          label: t('nav.documents'),
          href: '/documents',
          icon: FolderTree,
          badge: docCount > 0 ? `${docCount}` : null,
          badgeVariant: 'badge-neutral',
          isActive: pathname.startsWith('/documents'),
          permission: 'documents:read' as PermissionKey,
        },
      ].filter((item) => !item.permission || hasPermission(item.permission)),
    },
    {
      group: language === 'en' ? 'Administration & Audit' : 'Administrasi & Keamanan',
      items: [
        {
          label: t('nav.users'),
          href: '/users',
          icon: Users,
          badge: null,
          isActive: pathname.startsWith('/users'),
          permission: 'users:manage' as PermissionKey,
        },
        {
          label: t('nav.roles'),
          href: '/roles',
          icon: ShieldCheck,
          badge: null,
          isActive: pathname.startsWith('/roles'),
          permission: 'roles:manage' as PermissionKey,
        },
        {
          label: t('nav.audit_logs'),
          href: '/logs',
          icon: ScrollText,
          badge: null,
          isActive: pathname.startsWith('/logs'),
          permission: 'audit:read' as PermissionKey,
        },
      ].filter((item) => !item.permission || hasPermission(item.permission)),
    },
  ].filter((group) => group.items.length > 0);

  const hasChatAccess = hasPermission('chat:query');

  return (
    <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* ── Collapse / Expand Toggle Button ── */}
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          style={{
            position: 'absolute',
            right: '-13px',
            top: '22px',
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 60,
            color: 'var(--text-secondary)',
            transition: 'all 0.15s ease',
            outline: 'none',
          }}
          className="hover:text-primary hover:border-blue-400"
          title={isCollapsed ? t('nav.open_sidebar') : t('nav.close_sidebar')}
          aria-label={isCollapsed ? t('nav.open_sidebar') : t('nav.close_sidebar')}
        >
          {isCollapsed ? (
            <ChevronsRight size={14} strokeWidth={2} />
          ) : (
            <ChevronsLeft size={14} strokeWidth={2} />
          )}
        </button>
      )}

      {/* ── Brand Header (Brilian.Ai Logo) ── */}
      <div
        style={{
          padding: '0 0.5rem',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '70px',
          boxSizing: 'border-box',
        }}
      >
        <Link
          href="/"
          aria-label="Brilian.Ai Dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '2px 4px',
            transition: 'background-color 0.15s ease',
          }}
          className="hover:bg-subtle"
          title="Brilian.Ai Dashboard"
        >
          {isCollapsed ? (
            <Image
              key={`collapsed-${theme}`}
              src={logoSrc}
              alt="Brilian.Ai"
              width={38}
              height={38}
              priority
              style={{ objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <Image
              key={`open-${theme}`}
              src={logoSrc}
              alt="Brilian.Ai"
              width={140}
              height={52}
              priority
              style={{ objectFit: 'contain', display: 'block', maxHeight: '52px', width: 'auto' }}
            />
          )}
        </Link>
      </div>

      {/* ── Navigation Links ─────────────────────────────────── */}
      <div
        style={{
          padding: isCollapsed ? '0.75rem 0.35rem' : '1rem 0.75rem',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: isCollapsed ? '0.75rem' : '1.25rem',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* ── Workspace and administration groups stay above Assistant ── */}
        {navGroups.map((group) => (
          <div key={group.group} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {!isCollapsed && (
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.06em',
                  padding: '4px 12px',
                  marginBottom: '2px',
                }}
              >
                {group.group}
              </div>
            )}

            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${item.isActive ? 'active' : ''}`}
                  style={{
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '10px 0' : '9px 12px',
                    position: 'relative',
                  }}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon size={18} strokeWidth={item.isActive ? 2.2 : 1.75} />
                  {!isCollapsed && (
                    <>
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.label}
                      </span>
                      {item.badge && (
                        <span
                          className={`badge ${item.isActive ? 'badge-accent' : (item as any).badgeVariant || 'badge-neutral'}`}
                          style={{ fontSize: '10.5px', padding: '1px 7px' }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                  {isCollapsed && item.badge && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '12px',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: item.isActive ? 'var(--color-primary)' : 'var(--text-muted)',
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}

        {/* ── Assistant Group (special: includes Recents) ── */}
        {(hasChatAccess || !currentUser) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>

            {!isCollapsed && (
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.06em',
                  padding: '4px 12px',
                  marginBottom: '2px',
                }}
              >
                {language === 'en' ? 'Assistant' : 'Asisten AI'}
              </div>
            )}

            <button
              type="button"
              onClick={handleNewChat}
              className={`nav-link assistant-nav-link ${pathname.startsWith('/chat') ? 'active' : ''}`}
              style={{
                width: '100%',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                padding: isCollapsed ? '10px 0' : '9px 12px',
                backgroundColor: pathname.startsWith('/chat') ? undefined : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              title={isCollapsed ? t('chat.new_chat') : undefined}
              disabled={newChatLoading}
            >
              <MessageSquare
                size={18}
                strokeWidth={pathname.startsWith('/chat') ? 2.2 : 1.75}
              />
              {!isCollapsed && (
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t('nav.chat')}
                </span>
              )}
              {!isCollapsed && (
                <span
                  title="Chat baru"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    borderRadius: '5px',
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                    transition: 'background-color 0.15s ease, color 0.15s ease',
                  }}
                  className="hover:bg-muted"
                >
                  {newChatLoading ? <span className="chat-new-spinner" /> : <Plus size={13} strokeWidth={2.5} />}
                </span>
              )}
            </button>

            {!isCollapsed && currentUser && (
              <div className="chat-recents-panel">
                <div className="chat-recents-heading">

                  <span>{t('chat.recents')}</span>
                </div>

                {sessionsLoading ? (
                  <div className="chat-recents-empty">
                    <span className="chat-history-spinner" />
                    <span>{t('chat.loading_history')}</span>
                  </div>
                ) : chatSessions.length === 0 ? (
                  <div className="chat-recents-empty">{t('chat.no_recents')}</div>
                ) : (
                  <div className="chat-recents-list">
                    {chatSessions.map((session) => (
                      <ChatHistoryItem
                        key={session.id}
                        session={session}
                        isActive={activeSessionId === session.id}
                        isCollapsed={isCollapsed}
                        onClick={() => handleSessionClick(session.id)}
                        onRename={(newTitle) => handleRename(session.id, newTitle)}
                        onPin={() => handlePin(session.id, session.is_pinned)}
                        onDelete={() => handleDelete(session.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {isCollapsed && chatSessions.slice(0, 5).map((session) => (
              <ChatHistoryItem
                key={session.id}
                session={session}
                isActive={activeSessionId === session.id}
                isCollapsed={isCollapsed}
                onClick={() => handleSessionClick(session.id)}
                onRename={(newTitle) => handleRename(session.id, newTitle)}
                onPin={() => handlePin(session.id, session.is_pinned)}
                onDelete={() => handleDelete(session.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── User Footer Section ──────────────────────────────── */}
      <div
        style={{
          padding: isCollapsed ? '8px 4px' : '8px',
          borderTop: '1px solid var(--border-default)',
          backgroundColor: 'var(--bg-card)',
        }}
      >
        {currentUser ? (
          <NavUser
            user={{
              name: currentUser.name,
              email: currentUser.email,
            }}
            version="Brilian.Ai v1.0.0"
            isCollapsed={isCollapsed}
          />
        ) : (
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="nav-link"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: '10px',
              padding: isCollapsed ? '10px 0' : '8px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-primary-subtle)',
              border: '1px solid var(--color-primary-border)',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
            title={isCollapsed ? (language === 'en' ? 'Log In' : 'Masuk ke Akun') : undefined}
          >
            <LogIn size={18} strokeWidth={2} />
            {!isCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                  {language === 'en' ? 'Log in' : 'Masuk ke Akun'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {language === 'en' ? 'Guest Mode' : 'Mode Tamu (Read-only)'}
                </span>
              </div>
            )}
          </button>
        )}
      </div>


      {/* Confirmation Modal for Session Deletion */}
      <ConfirmationModal
        isOpen={!!sessionToDelete}
        onClose={() => {
          if (!isDeletingSession) setSessionToDelete(null);
        }}
        onConfirm={handleConfirmDeleteSession}
        isLoading={isDeletingSession}
        title={language === 'en' ? 'Delete Chat Session?' : 'Hapus Sesi Chat?'}
        description={
          language === 'en' ? (
            <>
              Are you sure you want to delete <strong>&quot;{sessionToDelete?.title}&quot;</strong>?
              All messages and citations in this conversation will be permanently removed.
            </>
          ) : (
            <>
              Apakah Anda yakin ingin menghapus sesi <strong>&quot;{sessionToDelete?.title}&quot;</strong>?
              Seluruh riwayat pertanyaan dan jawaban di sesi ini akan dihapus permanen.
            </>
          )
        }
        confirmLabel={language === 'en' ? 'Yes, Delete Session' : 'Ya, Hapus Sesi'}
        cancelLabel={language === 'en' ? 'Cancel' : 'Batal'}
        variant="danger"
      />
    </aside>
  );
}
