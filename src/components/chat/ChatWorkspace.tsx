'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  ArrowUp,
  Mic,
  Loader2,
  RefreshCw,
  Share2,
  LogIn,
  Copy,
  Check,
  ExternalLink,
  X,
} from 'lucide-react';

import {
  ChatMessage,
  ChatSource,
  ChatMessageVariant,
  ChatRequestPayload,
  ChatResponsePayload,
} from '@/types/chat';
import ChatMessageItem from './ChatMessageItem';
import CitationDrawer from './CitationDrawer';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
import { toast } from 'sonner';
import { generateSessionTitle } from '@lib/chat/sessionTitleHelper';

interface ChatWorkspaceProps {
  /** UUID sesi dari URL /chat/w/[uuid]. Jika undefined, workspace dalam mode idle. */
  sessionId?: string;
  /** NanoID sesi publik dari /share/w/[shareId] */
  shareId?: string;
  /** Mode read-only (tamu / belum login) */
  isPublicShare?: boolean;
}

export default function ChatWorkspace({
  sessionId,
  shareId,
  isPublicShare = false,
}: ChatWorkspaceProps) {

  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const { currentUser, hasPermission, isLoading: isUserLoading } = useUserSession();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeQueryText, setActiveQueryText] = useState('');
  const [allowPublicKnowledge, setAllowPublicKnowledge] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('Chat Baru');
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(
    sessionId ? null : 'idle'
  );
  const [sessionLoadError, setSessionLoadError] = useState<string | null>(null);
  const [lastSharedMessageId, setLastSharedMessageId] = useState<string | null>(null);
  const [shareModalUrl, setShareModalUrl] = useState<string | null>(null);
  const [hasCopiedShareUrl, setHasCopiedShareUrl] = useState(false);
  const [sharedMeta, setSharedMeta] = useState<{
    userId?: string | null;
    sessionId?: string | null;
    title?: string;
  } | null>(null);

  const isGuestOnShare = Boolean(isPublicShare && !currentUser);

  const handleLoginRedirect = useCallback(() => {
    const currentPath =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : `/share/w/${shareId || ''}`;
    router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
  }, [router, shareId]);

  const initialQueryHandledRef = useRef(false);

  // Preload query from URL parameter ?q=... (e.g. from Dashboard starter cards)
  useEffect(() => {
    if (!initialQueryHandledRef.current && !sessionId) {
      const q = searchParams?.get('q');
      if (q && q.trim()) {
        initialQueryHandledRef.current = true;
        setInputQuery(q.trim());
        setTimeout(() => {
          inputRef.current?.focus();
        }, 150);
      }
    }
  }, [searchParams, sessionId]);

  // Citation inspection
  const [inspectingSource, setInspectingSource] = useState<ChatSource | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstMessageRef = useRef<boolean>(true);
  const sessionIdRef = useRef<string | undefined>(sessionId);
  const isCreatingSessionRef = useRef(false);
  const executeAiResponseRef = useRef<((queryText: string, targetMessageId?: string, isRetry?: boolean) => Promise<void>) | null>(null);

  // ── Load sesi dari DB saat sessionId atau shareId berubah ─────────
  useEffect(() => {
    sessionIdRef.current = sessionId;

    if (!sessionId && !shareId) {
      setMessages([]);
      setLoadedSessionId('idle');
      setSessionLoadError(null);
      setSessionTitle('Chat Baru');
      setLastSharedMessageId(null);
      isFirstMessageRef.current = true;
      return;
    }

    let cancelled = false;
    setLoadedSessionId(null);
    setSessionLoadError(null);
    setMessages([]);
    setSessionTitle('Chat Baru');
    isFirstMessageRef.current = true;

    async function loadData() {
      try {
        if (shareId) {
          // Muat snapshot percakapan publik (tanpa autentikasi)
          const res = await fetch(`/api/public/share/${shareId}`);
          if (!res.ok) {
            if (res.status === 404) {
              toast.error('Percakapan yang dibagikan tidak ditemukan.');
              router.push('/chat');
              return;
            }
            throw new Error('Gagal memuat percakapan publik');
          }
          const shared = await res.json();
          if (!cancelled) {
            const loadedMessages: ChatMessage[] = Array.isArray(shared.messages)
              ? shared.messages
              : [];
            setMessages(loadedMessages);
            setSessionTitle(shared.title || 'Percakapan AI');
            setLoadedSessionId(shareId);
            setSharedMeta({
              userId: shared.userId || null,
              sessionId: shared.sessionId || null,
              title: shared.title || 'Percakapan AI',
            });

            // Jika yang membuka adalah pemilik asli link share dan sudah login,
            // langsung arahkan ke room chat aslinya (/chat/w/[sessionId])
            if (currentUser && shared.userId && currentUser.id === shared.userId && shared.sessionId) {
              toast.info(
                language === 'en'
                  ? 'Opening your original chat room...'
                  : 'Membuka room chat asli Anda...'
              );
              router.replace(`/chat/w/${shared.sessionId}`);
              return;
            }
          }
        } else if (sessionId) {
          // Muat sesi percakapan private
          const res = await fetch(`/api/chat-sessions/${sessionId}`);
          if (!res.ok) {
            if (res.status === 404 || res.status === 403) {
              toast.error('Sesi chat tidak ditemukan atau akses ditolak.');
              router.push('/chat');
              return;
            }
            throw new Error('Gagal memuat sesi');
          }
          const session = await res.json();
          if (!cancelled) {
            const loadedMessages: ChatMessage[] = Array.isArray(session.messages)
              ? session.messages
              : [];
            setMessages(loadedMessages);
            setSessionTitle(session.title || 'Chat Baru');
            setLastSharedMessageId(session.last_shared_message_id || null);
            // If session has messages, first message already set title
            if (loadedMessages.length > 0) {
              isFirstMessageRef.current = false;
            }

            // Auto-resume unanswered question
            const lastMsg = loadedMessages[loadedMessages.length - 1];
            if (lastMsg && lastMsg.sender === 'user') {
              setTimeout(() => {
                if (!cancelled) executeAiResponseRef.current?.(lastMsg.text);
              }, 120);
            }
            setLoadedSessionId(sessionId);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setSessionLoadError(
            err instanceof Error ? err.message : 'Gagal memuat sesi chat.'
          );
          console.warn('[ChatWorkspace] loadData error:', err);
        }
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [sessionId, shareId, router, currentUser, language]);

  // Otomatis arahkan pemilik asli ke room chat pribadinya jika sesi baru selesai dimuat
  useEffect(() => {
    if (shareId && sharedMeta && currentUser && !isUserLoading) {
      if (sharedMeta.userId && currentUser.id === sharedMeta.userId && sharedMeta.sessionId) {
        toast.info(
          language === 'en'
            ? 'Opening your original chat room...'
            : 'Membuka room chat asli Anda...'
        );
        router.replace(`/chat/w/${sharedMeta.sessionId}`);
      }
    }
  }, [shareId, sharedMeta, currentUser, isUserLoading, router, language]);

  // ── Debounced DB save ─────────────────────────────────────────────
  const scheduleSave = useCallback(
    (updatedMessages: ChatMessage[]) => {
      const activeSessionId = sessionIdRef.current;
      if (!activeSessionId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/chat-sessions/${activeSessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: updatedMessages }),
          });
        } catch {
          // silent fallback
        }
      }, 1500);
    },
    []
  );

  // ── Auto-update title from first user message ─────────────────────
  const updateSessionTitle = useCallback(
    async (firstQuery: string) => {
      const activeSessionId = sessionIdRef.current;
      if (!activeSessionId) return;
      const newTitle = generateSessionTitle(firstQuery);
      setSessionTitle(newTitle);
      try {
        await fetch(`/api/chat-sessions/${activeSessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle }),
        });
      } catch {
        // silent
      }
    },
    []
  );

  // ── Execute AI query ──────────────────────────────────────────────
  const executeAiResponse = async (
    queryText: string,
    targetMessageId?: string,
    isRetry?: boolean
  ) => {
    const trimmed = queryText.trim();
    if (!trimmed || isLoading) return;
    const activeSessionId = sessionIdRef.current;

    setActiveQueryText(trimmed);
    setIsLoading(true);

    try {
      const payload: ChatRequestPayload = {
        query: trimmed,
        allowPublicKnowledge,
        bypassCache: isRetry,
        user: currentUser
          ? {
              id: currentUser.id,
              name: currentUser.name,
              email: currentUser.email,
              department: currentUser.department,
            }
          : undefined,
        sessionId: activeSessionId || `sess-${Date.now()}`,
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data: ChatResponsePayload = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses pertanyaan');
      }

      const answerText = data.answer || 'Maaf, tidak ada informasi yang ditemukan dari dokumen.';
      const sources = data.sources || [];
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (targetMessageId) {
        // Regenerate/retry: append new variant to target message
        setMessages((prev) => {
          const next = prev.map((msg) => {
            if (msg.id !== targetMessageId) return msg;
            const existingVariants: ChatMessageVariant[] =
              msg.variants && msg.variants.length > 0
                ? [...msg.variants]
                : [{ text: msg.text, sources: msg.sources, timestamp: msg.timestamp }];
            const newVariant: ChatMessageVariant = { text: answerText, sources, timestamp };
            const updatedVariants = [...existingVariants, newVariant];
            return {
              ...msg,
              variants: updatedVariants,
              currentVariantIndex: updatedVariants.length - 1,
              text: answerText,
              sources,
              timestamp,
            };
          });
          scheduleSave(next);
          return next;
        });
      } else {
        // First-time response: append AI message to list
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: answerText,
          sources,
          variants: [{ text: answerText, sources, timestamp }],
          currentVariantIndex: 0,
          timestamp,
        };

        setMessages((prev) => {
          const next = [...prev, aiMessage];
          return next;
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  executeAiResponseRef.current = executeAiResponse;

  const handleSwitchVariant = (messageId: string, newIndex: number) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId || !msg.variants || !msg.variants[newIndex]) return msg;
        const selected = msg.variants[newIndex];
        return {
          ...msg,
          currentVariantIndex: newIndex,
          text: selected.text,
          sources: selected.sources || [],
          timestamp: selected.timestamp || msg.timestamp,
        };
      })
    );
  };

  // ── Auto scroll ───────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, [sessionId, shareId]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const promptChips = ['Q4 Financial Audit', 'Compliance & SOC2', 'Curated Policies'];

  const handleSend = async (queryText?: string) => {
    if (isGuestOnShare) {
      handleLoginRedirect();
      return;
    }

    const textToSend = (queryText || inputQuery).trim();

    if (!textToSend) {
      if (messages.length > 0 && !isLoading) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.sender === 'user') {
          await executeAiResponse(lastMsg.text);
        }
      }
      return;
    }

    if (isLoading || isCreatingSessionRef.current) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // ── Kasus 1: Memulai chat dari link share milik orang lain ──
    // "ketika memulai chat di bawah link share maka akan membuat percakapan baru"
    if (shareId && currentUser) {
      isCreatingSessionRef.current = true;
      const forkedMessages = [...messages, userMessage];
      setMessages(forkedMessages);
      setInputQuery('');
      try {
        const newTitle = sessionTitle || generateSessionTitle(textToSend);

        const res = await fetch('/api/chat-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newTitle,
            messages: forkedMessages,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.id) {
          throw new Error(data.error || 'Gagal membuat percakapan baru');
        }

        sessionIdRef.current = data.id;
        window.history.replaceState(null, '', `/chat/w/${data.id}`);
        await executeAiResponse(textToSend);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal membuat sesi chat');
      } finally {
        isCreatingSessionRef.current = false;
      }
      return;
    }

    // Lazy creation: an empty /chat route never creates a database row.
    // The first user message is persisted atomically with its generated title.
    if (!sessionIdRef.current) {
      isCreatingSessionRef.current = true;
      setMessages([userMessage]);
      setInputQuery('');
      try {
        const res = await fetch('/api/chat-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [userMessage] }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.id) {
          throw new Error(data.error || 'Gagal menyimpan sesi chat');
        }

        sessionIdRef.current = data.id;
        isFirstMessageRef.current = false;
        window.history.replaceState(null, '', `/chat/w/${data.id}`);
        await executeAiResponse(textToSend);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal menyimpan sesi chat');
      } finally {
        isCreatingSessionRef.current = false;
      }
      return;
    }

    // Existing sessions only update their title when the first message is sent.
    if (isFirstMessageRef.current) {
      isFirstMessageRef.current = false;
      void updateSessionTitle(textToSend);
    }

    setMessages((prev) => {
      const next = [...prev, userMessage];
      scheduleSave(next);
      return next;
    });
    setInputQuery('');

    await executeAiResponse(textToSend);
  };

  const [isSharing, setIsSharing] = useState(false);

  const handleShareConversation = async () => {
    if (messages.length === 0 || isSharing) return;

    setIsSharing(true);
    try {
      // Panggil backend API nyata untuk menyimpan snapshot percakapan ke shared_chats di DB
      const res = await fetch('/api/chat/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          title: sessionTitle,
          messages,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.shareUrl) {
        throw new Error(data.error || 'Gagal membuat tautan berbagi');
      }

      if (data.lastSharedMessageId) {
        setLastSharedMessageId(data.lastSharedMessageId);
      }

      // Pastikan URL selalu menggunakan domain browser (contoh: https://brilian.uti.co.id)
      const currentOrigin =
        typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('0.0.0.0')
          ? window.location.origin
          : (data.shareUrl ? data.shareUrl.replace(/\/share\/w\/.*$/, '') : '');
      const publicShareUrl = `${currentOrigin}/share/w/${data.shareId}`;

      // Salin tautan ke clipboard
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(publicShareUrl);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = publicShareUrl;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
      } catch {
        // silent fallback
      }

      // Buka modal dialog share berisi link & tombol copy
      setShareModalUrl(publicShareUrl);
      setHasCopiedShareUrl(true);
      setTimeout(() => setHasCopiedShareUrl(false), 2500);

      toast.success(
        language === 'en'
          ? 'Public share link created and copied!'
          : 'Tautan percakapan publik berhasil disalin!',
        {
          description: publicShareUrl,
          action: {
            label: language === 'en' ? 'Open Link' : 'Buka Link',
            onClick: () => window.open(publicShareUrl, '_blank'),
          },
        }
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Gagal menyalin tautan berbagi'
      );
    } finally {
      setIsSharing(false);
    }
  };

  const handleNewChat = async () => {
    router.push('/chat');
  };

  const handleVoiceInput = () => {
    if (isPublicShare) {
      router.push('/login');
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.info(
        language === 'en'
          ? 'Voice input is not supported in this browser'
          : 'Input suara belum didukung di browser ini'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language === 'en' ? 'en-US' : 'id-ID';
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        toast.info(language === 'en' ? 'Listening...' : 'Mendengarkan...');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputQuery(transcript);
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const hasMessages = messages.length > 0;

  // Keep the initial assistant screen hidden until the requested session has
  // been loaded successfully. This prevents a blank-chat flash during route
  // transitions from the Recent list.
  const isWorkspaceReady = (sessionId || shareId)
    ? loadedSessionId === (sessionId || shareId)
    : loadedSessionId === 'idle';

  if (!isWorkspaceReady) {
    return (
      <div
        className="chat-container-bg"
        style={{
          position: 'relative',
          width: '100%',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
        role={sessionLoadError ? 'alert' : 'status'}
        aria-live="polite"
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
            color: 'var(--text-secondary)',
          }}
        >
          <Loader2
            size={24}
            strokeWidth={2}
            style={{ animation: 'spin 1s linear infinite' }}
          />
          <span>
            {sessionLoadError || 'Memuat sesi chat...'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="chat-container-bg"
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── 1. FLOATING TOP HEADER BAR ──────────────────────────────── */}
      {!isPublicShare && (
        <header
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: '1rem 1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'transparent',
            borderBottom: 'none',
            zIndex: 30,
            pointerEvents: 'none',
          }}
        >
          {/* Left: Session title indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
            {hasMessages && (
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                  maxWidth: '240px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={sessionTitle}
              >
                {sessionTitle}
              </span>
            )}
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
            {hasMessages && (
              <button
                onClick={handleShareConversation}
                disabled={isSharing}
                className="btn btn-outline btn-sm"
                style={{
                  borderRadius: '9999px',
                  padding: '6px 14px',
                  fontSize: '12.5px',
                  backgroundColor: 'var(--bg-card)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                  boxShadow: '0 2px 10px rgba(15, 23, 42, 0.06)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: isSharing ? 0.7 : 1,
                  cursor: isSharing ? 'not-allowed' : 'pointer',
                }}
                title="Salin tautan publik percakapan ini"
              >
                {isSharing ? (
                  <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Share2 size={13} />
                )}
                <span>{isSharing ? 'Menyimpan...' : language === 'en' ? 'Share' : 'Share Conversation'}</span>
              </button>
            )}

            <button
              onClick={handleNewChat}
              className="btn btn-outline btn-sm"
              style={{
                borderRadius: '9999px',
                padding: '6px 14px',
                fontSize: '12.5px',
                backgroundColor: 'var(--bg-card)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
                boxShadow: '0 2px 10px rgba(15, 23, 42, 0.06)',
              }}
            >
              <Plus size={13} />
              <span>{language === 'en' ? 'New Chat' : 'Chat Baru'}</span>
            </button>

            {hasPermission('documents:upload') && (
              <button
                onClick={() => router.push('/upload')}
                className="btn btn-outline btn-sm"
                style={{
                  borderRadius: '9999px',
                  padding: '6px 14px',
                  fontSize: '12.5px',
                  backgroundColor: 'var(--bg-card)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                  boxShadow: '0 2px 10px rgba(15, 23, 42, 0.06)',
                }}
              >
                <Plus size={13} />
                <span>{language === 'en' ? 'Upload PDF' : 'Unggah PDF'}</span>
              </button>
            )}
          </div>
        </header>
      )}

      {/* ── 2. SCROLLABLE MIDDLE CONTAINER ───────────────────────────── */}
      <div
        style={{
          width: '100%',
          height: '100%',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '52rem',
            margin: '0 auto',
            padding: isPublicShare
              ? '2.25rem 1.5rem 8.5rem'
              : hasMessages
              ? '4.75rem 1.5rem 8.5rem'
              : '4.5rem 1.5rem 7.5rem',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >

          {!hasMessages ? (
            /* Center Stage Hero */
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem 0',
              }}
            >
              {/* Greeting Heading */}
              <div style={{ textAlign: 'center', marginBottom: '2rem', maxWidth: '42rem' }}>
                <h1
                  style={{
                    fontSize: 'clamp(28px, 4.5vw, 44px)',
                    fontWeight: 400,
                    letterSpacing: '-0.025em',
                    color: 'var(--text-primary)',
                    lineHeight: 1.25,
                  }}
                >
                  {currentUser
                    ? `Hi ${currentUser.name.split(' ')[0]}, what's on your mind?`
                    : "Hi, what's on your mind?"}
                </h1>
              </div>

              {/* Suggested Query Chips */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  marginTop: '0.5rem',
                }}
              >
                {promptChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setInputQuery(chip);
                      handleSend(chip);
                    }}
                    className="prompt-chip"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Loading indicator */}
              {isLoading && (
                <div id="statusToast" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 16px',
                      borderRadius: '9999px',
                      backgroundColor: 'var(--color-primary-subtle)',
                      border: '1px solid var(--color-primary-border)',
                      fontSize: '12px',
                      color: 'var(--color-primary)',
                      fontWeight: 500,
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-primary)',
                        animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                      }}
                    />
                    <span id="statusToastText">
                      Searching isolated internal documents
                      {activeQueryText ? ` for "${activeQueryText}"...` : '...'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Active Message Stream */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {messages.map((msg, idx) => (
                <React.Fragment key={msg.id}>
                  <ChatMessageItem
                    message={msg}
                    onSelectCitation={(source) => setInspectingSource(source)}
                    onSwitchVariant={(newIndex) => handleSwitchVariant(msg.id, newIndex)}
                    onRetry={() => {
                      if (isPublicShare) return;
                      if (msg.sender === 'user') {
                        executeAiResponse(msg.text);
                      } else {
                        const prevUser = [...messages.slice(0, idx)]
                          .reverse()
                          .find((m) => m.sender === 'user');
                        if (prevUser) {
                          executeAiResponse(prevUser.text, msg.id, true);
                        }
                      }
                    }}
                  />

                  {/* Privacy Divider: Titik pemisah pesan yang telah dibagikan ke publik */}
                  {msg.id === lastSharedMessageId && (
                    <div
                      key={`divider-${msg.id}`}
                      style={{
                        position: 'relative',
                        margin: '1.75rem 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        userSelect: 'none',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            borderTop: '1px dashed var(--border-default, rgba(148, 163, 184, 0.4))',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          position: 'relative',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '5px 16px',
                          borderRadius: '9999px',
                          backgroundColor: 'var(--bg-card, #ffffff)',
                          border: '1px solid var(--border-default, rgba(148, 163, 184, 0.3))',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'var(--text-secondary, #64748b)',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                        }}
                      >
                        <Share2 style={{ width: '13px', height: '13px', opacity: 0.8 }} />
                        <span>Messages beyond this point are only visible to you</span>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}

              {isLoading && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: 'var(--text-secondary)',
                    fontSize: '13px',
                    padding: '10px 16px',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '9999px',
                    border: '1px solid var(--border-default)',
                    width: 'fit-content',
                    boxShadow: 'var(--shadow-xs)',
                    marginBottom: '1rem',
                  }}
                >
                  <Loader2 size={15} className="animate-spin" color="#2563EB" />
                  <span style={{ fontWeight: 500 }}>
                    {language === 'en'
                      ? 'Searching isolated internal documents...'
                      : 'Menganalisis dokumen internal...'}
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* ── 3. FLOATING BOTTOM DOCK ───────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          backgroundColor: 'transparent',
          borderTop: 'none',
          zIndex: 30,
          padding: '0 1.5rem 1.25rem',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '48rem',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'auto',
          }}
        >
          {/* Pill Capsule Input Bar */}
          <div
            className="chat-pill-bar"
            onClick={() => {
              if (isGuestOnShare) {
                handleLoginRedirect();
              }
            }}
            style={isGuestOnShare ? { cursor: 'pointer' } : undefined}
          >
            <input
              ref={inputRef}
              autoComplete="off"
              id="promptInput"
              type="text"
              readOnly={isGuestOnShare}
              value={inputQuery}
              onChange={(e) => {
                if (isGuestOnShare) {
                  handleLoginRedirect();
                  return;
                }
                setInputQuery(e.target.value);
              }}
              onFocus={() => {
                if (isGuestOnShare) {
                  handleLoginRedirect();
                }
              }}
              onKeyDown={(e) => {
                if (isGuestOnShare) {
                  handleLoginRedirect();
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                isGuestOnShare
                  ? (language === 'en'
                      ? 'This shared conversation is read-only. Log in to chat...'
                      : 'Percakapan ini dibagikan (Read-only). Masuk untuk mulai chat...')
                  : isPublicShare
                  ? (language === 'en'
                      ? 'Continue this conversation with Apps Brilian...'
                      : 'Lanjutkan percakapan ini dengan Apps Brilian...')
                  : 'Ask Apps Brilian RAG...'
              }
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '15.5px',
                padding: '0 14px',
                fontWeight: 400,
                cursor: isGuestOnShare ? 'pointer' : 'text',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {/* Voice Input Icon (only in active workspace) */}
              {!isPublicShare && (
                <button
                  type="button"
                  onClick={handleVoiceInput}
                  aria-label="Use microphone"
                  title={isListening ? 'Mendengarkan...' : 'Gunakan Mikrofon'}
                  style={{
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    color: isListening ? 'var(--color-primary)' : 'var(--text-muted)',
                    border: 'none',
                    backgroundColor: isListening ? 'var(--color-primary-subtle)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Mic size={19} />
                </button>
              )}

              {/* Circular Action Button: LogIn icon in guest mode, ArrowUp send icon in active chat */}
              <button
                type="button"
                id="sendBtn"
                onClick={(e) => {
                  if (isGuestOnShare) {
                    e.stopPropagation();
                    handleLoginRedirect();
                    return;
                  }
                  handleSend();
                }}
                disabled={!isGuestOnShare && (isLoading || !inputQuery.trim())}
                aria-label={isGuestOnShare ? 'Log in to chat' : 'Submit query'}
                title={isGuestOnShare ? (language === 'en' ? 'Log in to chat' : 'Masuk untuk mulai chat') : undefined}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: !isGuestOnShare && (isLoading || !inputQuery.trim()) ? 0.6 : 1,
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                  transition: 'all 0.15s ease',
                }}
              >
                {isGuestOnShare ? (
                  <LogIn size={17} strokeWidth={2.2} />
                ) : isLoading ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <ArrowUp size={18} strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>



          {/* Disclaimer */}
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              fontWeight: 400,
              textAlign: 'center',
              marginTop: '10px',
            }}
          >
            Apps Brilian answers strictly from uploaded internal documents with zero external leaks.
          </p>
        </div>
      </div>

      {/* ── Citation Inspector Drawer ────────────────────────────────── */}
      <CitationDrawer
        source={inspectingSource}
        isOpen={!!inspectingSource}
        onClose={() => setInspectingSource(null)}
      />

      {/* ── Share Link Modal Dialog ──────────────────────────────────── */}
      {shareModalUrl && (
        <div
          onClick={() => setShareModalUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1px solid var(--border-default, #e2e8f0)',
              position: 'relative',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Share2 size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                    {language === 'en' ? 'Share link to Chat' : 'Bagikan Tautan Percakapan'}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary, #64748b)', margin: '2px 0 0' }}>
                    {language === 'en'
                      ? 'Anyone with this link will be able to view this conversation.'
                      : 'Siapa saja yang memiliki link ini dapat melihat percakapan ini.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShareModalUrl(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Link Input & Actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '18px',
                backgroundColor: 'var(--bg-app, #f8fafc)',
                border: '1px solid var(--border-default, #cbd5e1)',
                borderRadius: '10px',
                padding: '6px 8px 6px 12px',
              }}
            >
              <input
                type="text"
                readOnly
                value={shareModalUrl}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '13px',
                  color: 'var(--text-primary, #0f172a)',
                  fontFamily: 'monospace',
                }}
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareModalUrl);
                    setHasCopiedShareUrl(true);
                    setTimeout(() => setHasCopiedShareUrl(false), 2000);
                    toast.success(language === 'en' ? 'Link copied!' : 'Tautan berhasil disalin!');
                  } catch {
                    toast.error('Gagal menyalin tautan');
                  }
                }}
                className="btn btn-primary btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {hasCopiedShareUrl ? <Check size={14} /> : <Copy size={14} />}
                <span>{hasCopiedShareUrl ? (language === 'en' ? 'Copied!' : 'Tersalin!') : (language === 'en' ? 'Copy Link' : 'Salin Link')}</span>
              </button>
              <a
                href={shareModalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '13px',
                  color: 'var(--text-secondary, #64748b)',
                  textDecoration: 'none',
                }}
                title={language === 'en' ? 'Open link in new tab' : 'Buka link di tab baru'}
              >
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
