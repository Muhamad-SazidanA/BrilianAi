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
  Square,
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
import AiThinkingIndicator from './AiThinkingIndicator';
import { ChatShareModal } from './ChatShareModal';
import { ChatStarterView } from './ChatStarterView';
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

interface CachedSessionData {
  messages: ChatMessage[];
  title: string;
  lastSharedMessageId: string | null;
}

// In-memory session cache across route navigation to eliminate loading flicker
const sessionCache = new Map<string, CachedSessionData>();

export default function ChatWorkspace({
  sessionId,
  shareId,
  isPublicShare = false,
}: ChatWorkspaceProps) {

  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const { currentUser, hasPermission, isLoading: isUserLoading } = useUserSession();

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (sessionId && sessionCache.has(sessionId)) {
      return sessionCache.get(sessionId)!.messages;
    }
    return [];
  });
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeQueryText, setActiveQueryText] = useState('');
  const [allowPublicKnowledge, setAllowPublicKnowledge] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sessionTitle, setSessionTitle] = useState(() => {
    if (sessionId && sessionCache.has(sessionId)) {
      return sessionCache.get(sessionId)!.title;
    }
    return 'Chat Baru';
  });
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(() => {
    if (sessionId && sessionCache.has(sessionId)) {
      return sessionId;
    }
    return sessionId ? null : 'idle';
  });
  const [sessionLoadError, setSessionLoadError] = useState<string | null>(null);
  const [lastSharedMessageId, setLastSharedMessageId] = useState<string | null>(() => {
    if (sessionId && sessionCache.has(sessionId)) {
      return sessionCache.get(sessionId)!.lastSharedMessageId;
    }
    return null;
  });
  const [shareModalUrl, setShareModalUrl] = useState<string | null>(null);
  const [sharedMeta, setSharedMeta] = useState<{
    userId?: string | null;
    sessionId?: string | null;
    title?: string;
  } | null>(null);
  const [animatingMessageId, setAnimatingMessageId] = useState<string | null>(null);

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

  // Restore pending prompt draft after guest logs in
  useEffect(() => {
    if (currentUser) {
      try {
        const savedDraft = localStorage.getItem('brilian_pending_prompt');
        if (savedDraft) {
          setInputQuery(savedDraft);
          localStorage.removeItem('brilian_pending_prompt');
          toast.success('Draf pertanyaan Anda dipulihkan. Silakan periksa kembali dan kirim.');
          setTimeout(() => {
            inputRef.current?.focus();
          }, 200);
        }
      } catch {
        // quiet fallback
      }
    }
  }, [currentUser]);

  // Citation inspection
  const [inspectingSource, setInspectingSource] = useState<ChatSource | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstMessageRef = useRef<boolean>(true);
  const sessionIdRef = useRef<string | undefined>(sessionId);
  const isCreatingSessionRef = useRef(false);
  const executeAiResponseRef = useRef<((queryText: string, targetMessageId?: string, isRetry?: boolean) => Promise<void>) | null>(null);
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  const handleContainerScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom <= 120;
  };

  // ── Load sesi dari DB saat sessionId atau shareId berubah ─────────
  useEffect(() => {
    sessionIdRef.current = sessionId;

    // Pastikan loading status AI dan query langsung direset saat ganti sesi/chat
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
    }
    setIsLoading(false);
    setActiveQueryText('');
    setAnimatingMessageId(null);
    isNearBottomRef.current = true;

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

    // Fast path: If session is already cached in memory, immediately display it without spinner!
    const cached = sessionId ? sessionCache.get(sessionId) : null;
    if (cached) {
      setMessages(cached.messages);
      setSessionTitle(cached.title || 'Chat Baru');
      setLastSharedMessageId(cached.lastSharedMessageId);
      setLoadedSessionId(sessionId!);
      setSessionLoadError(null);
      if (cached.messages.length > 0) {
        isFirstMessageRef.current = false;
      }
    } else {
      setLoadedSessionId(null);
      setSessionLoadError(null);
      setMessages([]);
      setSessionTitle('Chat Baru');
      isFirstMessageRef.current = true;
    }

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

            // Simpan ke memory cache agar navigasi bolak-balik instan
            sessionCache.set(sessionId, {
              messages: loadedMessages,
              title: session.title || 'Chat Baru',
              lastSharedMessageId: session.last_shared_message_id || null,
            });

            setMessages(loadedMessages);
            setSessionTitle(session.title || 'Chat Baru');
            setLastSharedMessageId(session.last_shared_message_id || null);
            // If session has messages, first message already set title
            if (loadedMessages.length > 0) {
              isFirstMessageRef.current = false;
            }

            setLoadedSessionId(sessionId);
          }
        }
      } catch (err) {
        if (!cancelled) {
          if (!cached) {
            setSessionLoadError(
              err instanceof Error ? err.message : 'Gagal memuat sesi chat.'
            );
          }
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

      // Keep in-memory cache synchronized immediately
      const existing = sessionCache.get(activeSessionId);
      sessionCache.set(activeSessionId, {
        messages: updatedMessages,
        title: existing?.title || 'Chat Baru',
        lastSharedMessageId: existing?.lastSharedMessageId ?? null,
      });

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
      const existing = sessionCache.get(activeSessionId);
      if (existing) {
        existing.title = newTitle;
      }
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
    if (!trimmed) return;
    const activeSessionId = sessionIdRef.current;

    // Abort ongoing AI query if any exists
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    aiAbortControllerRef.current = controller;

    setActiveQueryText(trimmed);
    setIsLoading(true);

    try {
      const payload: ChatRequestPayload & { stream?: boolean } = {
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
        stream: true,
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const contentType = res.headers.get('content-type') || '';
      const isSse = contentType.includes('text/event-stream');

      if (!res.ok && !isSse) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal memproses pertanyaan');
      }

      // ── Real-Time Token Streaming Mode ────────────────────────────
      if (isSse && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let streamedText = '';
        let streamedSources: ChatSource[] = [];
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const aiMessageId = targetMessageId || `ai-${Date.now()}`;
        let messageInitialized = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
            try {
              const eventData = JSON.parse(trimmedLine.slice(6));

              if (eventData.type === 'sources') {
                streamedSources = eventData.sources || [];
                if (messageInitialized) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === aiMessageId ? { ...m, sources: streamedSources } : m
                    )
                  );
                }
              } else if (eventData.type === 'token') {
                streamedText += eventData.token;

                if (!messageInitialized) {
                  messageInitialized = true;
                  setAnimatingMessageId(aiMessageId);
                  setIsLoading(false); // Transisi halus: thinking indicator digantikan oleh streaming teks

                  if (targetMessageId) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === targetMessageId
                          ? {
                              ...m,
                              text: streamedText,
                              sources: streamedSources,
                              variants: m.variants
                                ? m.variants.map((v, i) =>
                                    i === (m.currentVariantIndex ?? 0)
                                      ? { ...v, text: streamedText, sources: streamedSources }
                                      : v
                                  )
                                : [{ text: streamedText, sources: streamedSources, timestamp: m.timestamp }],
                            }
                          : m
                      )
                    );
                  } else {
                    const newAiMsg: ChatMessage = {
                      id: aiMessageId,
                      sender: 'ai',
                      text: streamedText,
                      sources: streamedSources,
                      variants: [{ text: streamedText, sources: streamedSources, timestamp }],
                      currentVariantIndex: 0,
                      timestamp,
                    };
                    setMessages((prev) => [...prev, newAiMsg]);
                  }
                } else {
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== aiMessageId) return m;
                      const updatedVariants = m.variants
                        ? m.variants.map((v, i) =>
                            i === (m.currentVariantIndex ?? 0)
                              ? { ...v, text: streamedText, sources: streamedSources }
                              : v
                          )
                        : [{ text: streamedText, sources: streamedSources, timestamp: m.timestamp }];

                      return {
                        ...m,
                        text: streamedText,
                        sources: streamedSources,
                        variants: updatedVariants,
                      };
                    })
                  );
                }
              } else if (eventData.type === 'done') {
                const finalAnswer = eventData.answer || streamedText;
                const finalSources = eventData.sources || streamedSources;

                setIsLoading(false);
                setMessages((prev) => {
                  const updated = prev.map((m) => {
                    if (m.id !== aiMessageId) return m;
                    const finalVariants = m.variants && m.variants.length > 0
                      ? m.variants.map((v, i) =>
                          i === (m.currentVariantIndex ?? 0)
                            ? { ...v, text: finalAnswer, sources: finalSources }
                            : v
                        )
                      : [{ text: finalAnswer, sources: finalSources, timestamp: m.timestamp }];

                    return {
                      ...m,
                      text: finalAnswer,
                      sources: finalSources,
                      variants: finalVariants,
                    };
                  });
                  scheduleSave(updated);
                  return updated;
                });
              } else if (eventData.type === 'error') {
                throw new Error(eventData.error || 'Terjadi kesalahan saat memproses streaming');
              }
            } catch (parseErr: any) {
              if (parseErr.name === 'AbortError') return;
              // Ignore partial JSON parsing chunk
            }
          }
        }
        return;
      }

      // ── Non-Streaming Fallback ────────────────────────────────────
      const data: ChatResponsePayload = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses pertanyaan');
      }

      const answerText = data.answer || 'Maaf, tidak ada informasi yang ditemukan dari dokumen.';
      const sources = data.sources || [];
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (targetMessageId) {
        // Regenerate/retry: append new variant to target message
        setAnimatingMessageId(targetMessageId);
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

        setAnimatingMessageId(aiMessage.id);
        setMessages((prev) => {
          const next = [...prev, aiMessage];
          scheduleSave(next);
          return next;
        });
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Gagal memproses pertanyaan');
    } finally {
      if (aiAbortControllerRef.current === controller) {
        aiAbortControllerRef.current = null;
        setIsLoading(false);
      }
    }
  };

  const handleStopGeneration = () => {
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
    }
    setIsLoading(false);
    toast.info(language === 'en' ? 'Response generation stopped.' : 'Generasi jawaban dihentikan.');
  };

  executeAiResponseRef.current = executeAiResponse;

  const handleSwitchVariant = (messageId: string, newIndex: number) => {
    setMessages((prev) => {
      const next = prev.map((msg) => {
        if (msg.id !== messageId || !msg.variants || !msg.variants[newIndex]) return msg;
        const selected = msg.variants[newIndex];
        return {
          ...msg,
          currentVariantIndex: newIndex,
          text: selected.text,
          sources: selected.sources || [],
          timestamp: selected.timestamp || msg.timestamp,
        };
      });
      scheduleSave(next);
      return next;
    });
  };

  const handleEditUserPrompt = async (messageIndex: number, newText: string) => {
    if (isPublicShare) return;
    const trimmed = newText.trim();
    if (!trimmed) return;

    // 1. Abort ongoing generation if any
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
    }
    setIsLoading(false);

    const targetUserMsg = messages[messageIndex];
    if (!targetUserMsg || targetUserMsg.sender !== 'user') return;

    const updatedUserMessage: ChatMessage = {
      ...targetUserMsg,
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // 2. Truncate & Regenerate: slice off all messages after messageIndex
    const truncatedMessages = [...messages.slice(0, messageIndex), updatedUserMessage];
    setMessages(truncatedMessages);
    scheduleSave(truncatedMessages);

    // If editing the first message, update session title
    if (messageIndex === 0) {
      updateSessionTitle(trimmed);
    }

    // 3. Immediately trigger AI response from this point
    isNearBottomRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    await executeAiResponse(trimmed);
  };

  // ── Auto scroll ───────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0 && isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, isLoading]);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, [sessionId, shareId]);

  // Cleanup timer & abort ongoing query on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (aiAbortControllerRef.current) {
        aiAbortControllerRef.current.abort();
      }
    };
  }, []);

  const promptChips = ['Q4 Financial Audit', 'Compliance & SOC2', 'Curated Policies'];

  const handleSend = async (queryText?: string) => {
    if (isGuestOnShare) {
      handleLoginRedirect();
      return;
    }

    const textToSend = (queryText || inputQuery).trim();

    // Jika belum login, simpan draf ke localStorage dan arahkan ke login
    if (!currentUser) {
      if (textToSend) {
        try {
          localStorage.setItem('brilian_pending_prompt', textToSend);
        } catch {
          // quiet fallback
        }
        toast.info('Silakan login terlebih dahulu untuk mengirim pertanyaan.');
      }
      const currentPath =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : '/chat';
      router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

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
    setAnimatingMessageId(userMessage.id);
    isNearBottomRef.current = true;

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
        sessionCache.set(data.id, {
          messages: forkedMessages,
          title: newTitle,
          lastSharedMessageId: null,
        });
        setLoadedSessionId(data.id);
        window.history.replaceState(null, '', `/chat/w/${data.id}`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('brilian_chat_session_created', { detail: { id: data.id } })
          );
        }
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
        sessionCache.set(data.id, {
          messages: [userMessage],
          title: 'Chat Baru',
          lastSharedMessageId: null,
        });
        setLoadedSessionId(data.id);
        isFirstMessageRef.current = false;
        window.history.replaceState(null, '', `/chat/w/${data.id}`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('brilian_chat_session_created', { detail: { id: data.id } })
          );
        }
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

  const resetToNewChat = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setIsLoading(false);
    setActiveQueryText('');
    setMessages([]);
    setInputQuery('');
    setLoadedSessionId('idle');
    setSessionLoadError(null);
    setSessionTitle('Chat Baru');
    setLastSharedMessageId(null);
    sessionIdRef.current = undefined;
    isFirstMessageRef.current = true;

    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/chat');
    }
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, []);

  const handleNewChat = useCallback(() => {
    if (sessionId) {
      router.push('/chat');
    } else {
      resetToNewChat();
    }
  }, [sessionId, router, resetToNewChat]);

  useEffect(() => {
    const handleGlobalNewChat = () => {
      if (sessionId) {
        router.push('/chat');
      } else {
        resetToNewChat();
      }
    };

    window.addEventListener('brilian_new_chat', handleGlobalNewChat);
    return () => {
      window.removeEventListener('brilian_new_chat', handleGlobalNewChat);
    };
  }, [sessionId, router, resetToNewChat]);

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
  // been loaded successfully. On /chat (new chat), it is always ready immediately.
  const isWorkspaceReady = (sessionId || shareId)
    ? loadedSessionId === (sessionId || shareId) || (sessionId ? sessionCache.has(sessionId) : false)
    : true;

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
      <header
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '0.5rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'transparent',
          borderBottom: 'none',
          zIndex: 30,
          pointerEvents: 'none',
        }}
      >
        {/* Left: Spacer / Public Share badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'auto' }}>
          {isPublicShare && (
            <span
              className="badge badge-accent"
              style={{
                fontSize: '10.5px',
                padding: '2px 8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                borderRadius: '9999px',
                fontWeight: 600,
              }}
            >
              <Share2 size={11} />
              <span>{language === 'en' ? 'Shared Conversation' : 'Tautan Dibagikan'}</span>
            </span>
          )}
        </div>

        {/* Right: Only Share action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', pointerEvents: 'auto' }}>
          {isGuestOnShare && (
            <button
              onClick={handleLoginRedirect}
              className="btn btn-primary btn-sm"
              style={{
                borderRadius: '9999px',
                padding: '3px 10px',
                fontSize: '11px',
                height: '26px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 1px 4px rgba(15, 23, 42, 0.08)',
              }}
            >
              <LogIn size={12} />
              <span>{language === 'en' ? 'Log in' : 'Masuk ke Akun'}</span>
            </button>
          )}

          {!isPublicShare && (
            <button
              onClick={handleShareConversation}
              disabled={isSharing || !hasMessages}
              className="btn btn-outline btn-sm"
              style={{
                borderRadius: '9999px',
                padding: '3px 12px',
                fontSize: '11.5px',
                height: '26px',
                backgroundColor: 'var(--bg-card)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
                boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                opacity: isSharing || !hasMessages ? 0.45 : 1,
                cursor: isSharing || !hasMessages ? 'not-allowed' : 'pointer',
              }}
              title={
                !hasMessages
                  ? (language === 'en' ? 'Start a conversation to share' : 'Mulai obrolan terlebih dahulu untuk membagikan tautan')
                  : (language === 'en' ? 'Share link to this chat' : 'Salin tautan publik percakapan ini')
              }
            >
              {isSharing ? (
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Share2 size={12} />
              )}
              <span>{isSharing ? (language === 'en' ? 'Saving...' : 'Menyimpan...') : 'Share'}</span>
            </button>
          )}
        </div>
      </header>

      {/* ── 2. SCROLLABLE MIDDLE CONTAINER ───────────────────────────── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleContainerScroll}
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
            padding: hasMessages
              ? '3.5rem 1rem 9.5rem'
              : '3.25rem 1rem 6rem',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >

          {!hasMessages ? (
            <ChatStarterView
              userName={currentUser?.name}
              promptChips={promptChips}
              onSelectChip={(chip) => {
                setInputQuery(chip);
                handleSend(chip);
              }}
              isLoading={isLoading}
              activeQueryText={activeQueryText}
            />
          ) : (
            /* Active Message Stream */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {messages.map((msg, idx) => (
                <React.Fragment key={msg.id}>
                  <ChatMessageItem
                    message={msg}
                    animateEntrance={msg.id === animatingMessageId}
                    onSelectCitation={(source) => setInspectingSource(source)}
                    onSwitchVariant={(newIndex) => {
                      setAnimatingMessageId(msg.id);
                      handleSwitchVariant(msg.id, newIndex);
                    }}
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
                    onEditPrompt={
                      msg.sender === 'user' && !isPublicShare
                        ? (newText) => handleEditUserPrompt(idx, newText)
                        : undefined
                    }
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

              {/* AI Thinking Indicator: strictly only show when waiting for AI response to the latest user message */}
              {isLoading &&
                messages.length > 0 &&
                messages[messages.length - 1]?.sender === 'user' && (
                  <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'flex-start' }}>
                    <AiThinkingIndicator
                      queryText={activeQueryText}
                      isStarterScreen={false}
                    />
                  </div>
                )}

              <div ref={messagesEndRef} style={{ height: '2rem', width: '100%', flexShrink: 0 }} />
            </div>
          )}
        </div>
      </div>

      {/* ── 3. FLOATING BOTTOM DOCK ───────────────────────────────────── */}
      <div className="chat-bottom-dock-wrapper">
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
                  : !currentUser
                  ? (language === 'en'
                      ? 'Ask Apps Brilian RAG... (Login required to send)'
                      : 'Tanya Brilian.Ai seputar dokumen... (Login untuk mengirim)')
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
                fontSize: '12.5px',
                padding: '0 10px',
                fontWeight: 400,
                cursor: isGuestOnShare ? 'pointer' : 'text',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {/* Voice Input Icon (only in active workspace) */}
              {!isPublicShare && (
                <button
                  type="button"
                  onClick={handleVoiceInput}
                  aria-label="Use microphone"
                  title={isListening ? 'Mendengarkan...' : 'Gunakan Mikrofon'}
                  style={{
                    width: '28px',
                    height: '28px',
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
                  <Mic size={15} />
                </button>
              )}

              {/* Circular Action Button: LogIn, Stop Generation (during streaming), or Send */}
              <button
                type="button"
                id="sendBtn"
                onClick={(e) => {
                  if (isGuestOnShare) {
                    e.stopPropagation();
                    handleLoginRedirect();
                    return;
                  }
                  if (isLoading || aiAbortControllerRef.current) {
                    handleStopGeneration();
                    return;
                  }
                  handleSend();
                }}
                disabled={!isGuestOnShare && !isLoading && !aiAbortControllerRef.current && !inputQuery.trim()}
                aria-label={
                  isGuestOnShare
                    ? 'Log in to chat'
                    : isLoading || aiAbortControllerRef.current
                    ? 'Stop generating'
                    : 'Submit query'
                }
                title={
                  isGuestOnShare
                    ? (language === 'en' ? 'Log in to chat' : 'Masuk untuk mulai chat')
                    : isLoading || aiAbortControllerRef.current
                    ? (language === 'en' ? 'Stop generating' : 'Hentikan jawaban')
                    : undefined
                }
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: isLoading || aiAbortControllerRef.current ? '#0F172A' : '#2563EB',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: !isGuestOnShare && !isLoading && !aiAbortControllerRef.current && !inputQuery.trim() ? 0.6 : 1,
                  boxShadow: isLoading || aiAbortControllerRef.current
                    ? '0 2px 6px rgba(15, 23, 42, 0.2)'
                    : '0 2px 6px rgba(37, 99, 235, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                {isGuestOnShare ? (
                  <LogIn size={14} strokeWidth={2.2} />
                ) : isLoading || aiAbortControllerRef.current ? (
                  <Square size={11} fill="currentColor" strokeWidth={0} />
                ) : (
                  <ArrowUp size={15} strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>

          {/* Disclaimer */}
          <p
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontWeight: 400,
              textAlign: 'center',
              marginTop: '6px',
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
      <ChatShareModal
        shareUrl={shareModalUrl}
        isOpen={Boolean(shareModalUrl)}
        onClose={() => setShareModalUrl(null)}
        language={language}
      />
    </div>
  );
}
