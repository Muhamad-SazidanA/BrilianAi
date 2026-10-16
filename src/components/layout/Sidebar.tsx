'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FolderTree,
  MessageSquare,
  ChevronsLeft,
  ChevronsRight,
  Users,
  ShieldCheck,
  ScrollText,
  Plus,
  LogIn,
  FileQuestion,
} from 'lucide-react';

import NavUser from './NavUser';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
import { PermissionKey } from '@/types/user';
import { ChatSession } from '@/types/chat';
import ChatHistoryItem from '@/components/chat/ChatHistoryItem';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { toast } from 'sonner';

// Module-level in-memory cache for instant zero-flicker sidebar history
let cachedSidebarSessions: ChatSession[] | null = null;

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

  // ── Chat History State (Instantly seeded from in-memory cache) ──
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => cachedSidebarSessions || []);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [newChatLoading, setNewChatLoading] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // Active session UUID from URL /chat/w/[uuid] or dynamically updated
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    const match = pathname.match(/^\/chat\/w\/([0-9a-f-]{36})$/i);
    setCurrentSessionId(match ? match[1] : null);
  }, [pathname]);

  const activeSessionId = useMemo(() => {
    return currentSessionId;
  }, [currentSessionId]);

  const isNewChatActive = useMemo(() => {
    if (pathname.startsWith('/chat/w/')) return false;
    return (pathname === '/chat' || pathname.startsWith('/share')) && !activeSessionId;
  }, [pathname, activeSessionId]);

  // Fetch chat sessions with silent background revalidation (no spinner when cached)
  const fetchChatSessions = useCallback(async (silent = false) => {
    if (!hasPermission('chat:query') || !currentUser) return;
    if (!silent && !cachedSidebarSessions) {
      setSessionsLoading(true);
    }
    try {
      const res = await fetch('/api/chat-sessions');
      if (res.ok) {
        const data = await res.json();
        const list: ChatSession[] = data.sessions || [];
        cachedSidebarSessions = list;
        setChatSessions(list);
      }
    } catch {
      // Quiet fallback
    } finally {
      setSessionsLoading(false);
    }
  }, [hasPermission, currentUser]);

  const fetchChatSessionsRef = useRef(fetchChatSessions);
  fetchChatSessionsRef.current = fetchChatSessions;

  // Initial fetch on mount or when user ID changes (silent if cache exists)
  useEffect(() => {
    if (currentUser?.id) {
      fetchChatSessionsRef.current(cachedSidebarSessions !== null);
    }
  }, [currentUser?.id]);

  // Listen to new chat and session creation events across tabs/components (attached once)
  useEffect(() => {
    const onSessionCreated = (e: any) => {
      if (e?.detail?.id) {
        setCurrentSessionId(e.detail.id);
      }
      fetchChatSessionsRef.current(true);
    };
    const onNewChat = () => {
      setCurrentSessionId(null);
    };
    const onSessionsChanged = () => {
      fetchChatSessionsRef.current(true);
    };
    window.addEventListener('brilian_chat_session_created', onSessionCreated);
    window.addEventListener('brilian_new_chat', onNewChat);
    window.addEventListener('brilian_chat_sessions_changed', onSessionsChanged);
    return () => {
      window.removeEventListener('brilian_chat_session_created', onSessionCreated);
      window.removeEventListener('brilian_new_chat', onNewChat);
      window.removeEventListener('brilian_chat_sessions_changed', onSessionsChanged);
    };
  }, []);

  // ── Session Actions ───────────────────────────────────────────────
  const handleNewChat = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (newChatLoading) return;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('brilian_new_chat'));

      if (window.location.pathname.startsWith('/chat')) {
        if (pathname.startsWith('/chat/w/')) {
          router.push('/chat');
        } else if (window.location.pathname !== '/chat') {
          window.history.pushState(null, '', '/chat');
        }
        return;
      }
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
        if (cachedSidebarSessions) {
          cachedSidebarSessions = cachedSidebarSessions.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s));
        }
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
        const sortPinned = (list: typeof chatSessions) => {
          const updated = list.map((s) =>
            s.id === sessionId ? { ...s, is_pinned: !currentPinned } : s
          );
          return [...updated].sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          });
        };
        if (cachedSidebarSessions) {
          cachedSidebarSessions = sortPinned(cachedSidebarSessions);
        }
        setChatSessions((prev) => sortPinned(prev));
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
        if (cachedSidebarSessions) {
          cachedSidebarSessions = cachedSidebarSessions.filter((s) => s.id !== sessionToDelete.id);
        }
        setChatSessions((prev) => prev.filter((s) => s.id !== sessionToDelete.id));
        if (activeSessionId === sessionToDelete.id || (typeof window !== 'undefined' && window.location.pathname.includes(sessionToDelete.id))) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('brilian_new_chat'));
          }
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
        ? '/images/BrilianLogo-Close-P.svg'
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
          href: '/dashboard',
          icon: LayoutDashboard,
          badge: null,
          isActive: pathname === '/dashboard',
          permission: null,
        },

        {
          label: t('nav.documents'),
          href: '/documents',
          icon: FolderTree,
          badge: docCount > 0 ? `${docCount}` : null,
          badgeVariant: 'badge-neutral',
          isActive: pathname.startsWith('/documents') || pathname.startsWith('/upload'),
          permission: 'documents:read' as PermissionKey,
        },
        {
          label: language === 'en' ? 'Knowledge Gaps' : 'Kesenjangan Dokumen',
          href: '/knowledge-gaps',
          icon: FileQuestion,
          badge: null,
          isActive: pathname.startsWith('/knowledge-gaps'),
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
    <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''}`} suppressHydrationWarning>
      {/* ── Collapse / Expand Toggle Button ── */}
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          style={{
            position: 'absolute',
            right: '-11px',
            top: '13px',
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.12)',
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
            <ChevronsRight size={12} strokeWidth={2.2} />
          ) : (
            <ChevronsLeft size={12} strokeWidth={2.2} />
          )}
        </button>
      )}

      {/* ── Brand Header (Brilian.Ai Logo - Slim) ── */}
      <div
        style={{
          padding: '0 0.5rem',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 'var(--header-height)',
          boxSizing: 'border-box',
        }}
      >
        <Link
          href="/chat"
          onClick={(e) => {
            if (pathname.startsWith('/chat')) {
              e.preventDefault();
              handleNewChat();
            }
          }}
          aria-label="Brilian.Ai"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            borderRadius: 'var(--radius-sm)',
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
              width={26}
              height={26}
              priority
              style={{ objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <Image
              key={`open-${theme}`}
              src={logoSrc}
              alt="Brilian.Ai"
              width={120}
              height={30}
              priority
              style={{ objectFit: 'contain', display: 'block', height: '30px', width: 'auto' }}
            />
          )}
        </Link>
      </div>

      {/* ── 1. Fixed Navigation Area (AI Workspace, Admin, AI Assistant - Non-Scrollable) ── */}
      <div
        style={{
          flexShrink: 0,
          padding: isCollapsed ? '0.45rem 0' : '0.45rem 0.75rem 0.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: isCollapsed ? '0.35rem' : '0.4rem',
        }}
      >
        {/* ── Assistant Button (At the very top) ── */}
        {(hasChatAccess || !currentUser) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {!isCollapsed && (
              <div
                style={{
                  fontSize: '9.5px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.04em',
                  padding: '1px 8px',
                  marginBottom: '0',
                }}
              >
                {language === 'en' ? 'Assistant' : 'Asisten AI'}
              </div>
            )}

            <button
              type="button"
              onClick={handleNewChat}
              className={`nav-link assistant-nav-link ${isNewChatActive ? 'active' : ''}`}
              style={{
                width: isCollapsed ? '34px' : '100%',
                height: isCollapsed ? '34px' : undefined,
                minHeight: isCollapsed ? '34px' : '28px',
                margin: isCollapsed ? '0 auto' : undefined,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                padding: isCollapsed ? 0 : '3px 7px',
                borderRadius: '8px',
                backgroundColor: isNewChatActive ? undefined : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              title={isCollapsed ? t('chat.new_chat') : undefined}
              disabled={newChatLoading}
            >
              <MessageSquare
                size={14}
                strokeWidth={isNewChatActive ? 2 : 1.7}
              />
              {!isCollapsed && (
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '11.5px' }}>
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
                    width: '16px',
                    height: '16px',
                    borderRadius: '3px',
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                    transition: 'background-color 0.15s ease, color 0.15s ease',
                  }}
                  className="hover:bg-muted"
                >
                  {newChatLoading ? <span className="chat-new-spinner" /> : <Plus size={10} strokeWidth={2.5} />}
                </span>
              )}
            </button>
          </div>
        )}

        {/* ── Workspace and administration groups below Assistant ── */}
        {navGroups.map((group) => (
          <div key={group.group} style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {!isCollapsed && (
              <div
                style={{
                  fontSize: '9.5px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.04em',
                  padding: '1px 8px',
                  marginBottom: '0',
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
                    width: isCollapsed ? '34px' : '100%',
                    height: isCollapsed ? '34px' : undefined,
                    minHeight: isCollapsed ? '34px' : '28px',
                    margin: isCollapsed ? '0 auto' : undefined,
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? 0 : '3px 7px',
                    borderRadius: '8px',
                    position: 'relative',
                  }}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon size={14} strokeWidth={item.isActive ? 2 : 1.7} />
                  {!isCollapsed && (
                    <>
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '11.5px' }}>
                        {item.label}
                      </span>
                      {item.badge && (
                        <span
                          className={`badge ${item.isActive ? 'badge-accent' : (item as any).badgeVariant || 'badge-neutral'}`}
                          style={{ fontSize: '9px', padding: '0 5px', height: '15px', lineHeight: '15px' }}
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
                        top: '3px',
                        right: '6px',
                        width: '4px',
                        height: '4px',
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
      </div>

      {/* ── 2. Recents Panel (Heading is FIXED, only the session list scrolls) ── */}
      {!isCollapsed && currentUser && (
        <div
          className="chat-recents-panel"
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '4px 0.75rem 0.25rem',
            overflow: 'hidden',
          }}
        >
          {/* Header "Recent / Terkini" - Fixed at top, NEVER scrolls */}
          <div className="chat-recents-heading" style={{ flexShrink: 0 }}>
            <span>{t('chat.recents')}</span>
          </div>

          {/* Scrollable list of chats - ONLY this part scrolls, scrollbar hidden */}
          <div
            className="chat-recents-scroll-area no-scrollbar"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {sessionsLoading && chatSessions.length === 0 ? (
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
        </div>
      )}

      {/* Spacer to push user footer to bottom when collapsed or if no recents/guest */}
      {(isCollapsed || !currentUser || !hasChatAccess) && (
        <div style={{ flex: 1 }} />
      )}

      {/* ── User Footer Section ──────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          padding: isCollapsed ? '10px 0' : '8px 12px',
          borderTop: '1px solid var(--border-default)',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
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
              width: isCollapsed ? '34px' : '100%',
              height: isCollapsed ? '34px' : undefined,
              minHeight: isCollapsed ? '34px' : '28px',
              margin: isCollapsed ? '0 auto' : undefined,
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: isCollapsed ? 0 : '10px',
              padding: isCollapsed ? 0 : '8px 12px',
              borderRadius: '8px',
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
