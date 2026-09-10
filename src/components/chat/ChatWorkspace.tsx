'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  ArrowUp,
  Mic,
  ChevronDown,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { ChatMessage, ChatSource } from '@/types/chat';
import ChatMessageItem from './ChatMessageItem';
import CitationDrawer from './CitationDrawer';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

export default function ChatWorkspace() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeQueryText, setActiveQueryText] = useState('');
  const [allowPublicKnowledge, setAllowPublicKnowledge] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isRestored, setIsRestored] = useState(false);

  // Citation inspection
  const [inspectingSource, setInspectingSource] = useState<ChatSource | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Restore messages and options from sessionStorage on mount (persists across page navigation)
  useEffect(() => {
    try {
      const savedMessages = sessionStorage.getItem('brilian_chat_messages');
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
      const savedPublic = sessionStorage.getItem('brilian_chat_allow_public');
      if (savedPublic !== null) {
        setAllowPublicKnowledge(savedPublic === 'true');
      }
    } catch (err) {
      console.warn('Failed to restore chat session:', err);
    } finally {
      setIsRestored(true);
    }
  }, []);

  // Save messages to sessionStorage whenever it changes (cleared only when browser/tab is closed)
  useEffect(() => {
    if (!isRestored) return;
    try {
      if (messages.length > 0) {
        sessionStorage.setItem('brilian_chat_messages', JSON.stringify(messages));
      } else {
        sessionStorage.removeItem('brilian_chat_messages');
      }
    } catch (err) {
      console.warn('Failed to persist chat session:', err);
    }
  }, [messages, isRestored]);

  // Save allowPublicKnowledge to sessionStorage
  useEffect(() => {
    if (!isRestored) return;
    try {
      sessionStorage.setItem('brilian_chat_allow_public', String(allowPublicKnowledge));
    } catch {}
  }, [allowPublicKnowledge, isRestored]);

  // Auto scroll in conversation mode
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const promptChips = [
    'Q4 Financial Audit',
    'Compliance & SOC2',
    'Curated Policies',
  ];

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || isLoading) return;

    setActiveQueryText(textToSend);
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const payload = {
        query: textToSend,
        allowPublicKnowledge,
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses pertanyaan');
      }

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.answer || 'Maaf, tidak ada informasi yang ditemukan dari dokumen.',
        sources: data.sources || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: `Terjadi kesalahan: ${err.message || 'Gagal menghubungi server'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (messages.length === 0) return;
    toast.warning(t('chat.reset_confirm') || 'Reset sesi percakapan?', {
      description:
        language === 'en'
          ? 'Clear chat session and return to fresh prompt stage.'
          : 'Riwayat percakapan akan dibersihkan kembali ke tampilan awal.',
      duration: 6000,
      action: {
        label: 'Reset',
        onClick: () => {
          setMessages([]);
          setInputQuery('');
          setActiveQueryText('');
          try {
            sessionStorage.removeItem('brilian_chat_messages');
          } catch {}
          toast.success(
            language === 'en'
              ? 'Chat session has been reset'
              : 'Sesi percakapan telah di-reset'
          );
        },
      },
      cancel: {
        label: language === 'en' ? 'Cancel' : 'Batal',
        onClick: () => {},
      },
    });
  };

  const handleVoiceInput = () => {
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

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleToggleModel = () => {
    setAllowPublicKnowledge((prev) => {
      const next = !prev;
      toast.info(
        next
          ? (language === 'en' ? 'Model: Pro (Internal Documents + Public Knowledge)' : 'Model: Pro (Dokumen Internal + Pengetahuan Umum)')
          : (language === 'en' ? 'Model: Pro (Strict Isolated Internal Documents)' : 'Model: Pro (Terisolasi Dokumen Internal)')
      );
      return next;
    });
  };

  const hasMessages = messages.length > 0;

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
      {/* ── 1. FIXED TOP HEADER BAR ─────────────────────────── */}
      <header
        style={{
          width: '100%',
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'transparent',
          borderBottom: 'none',
          flexShrink: 0,
          zIndex: 30,
        }}
      >
        {/* Left: Active Knowledge Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#059669',
              boxShadow: '0 0 0 3px rgba(5, 150, 105, 0.2)',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              letterSpacing: '-0.01em',
            }}
          >
            {language === 'en' ? 'Apps Brilian Knowledge' : 'Basis Pengetahuan Brilian.Ai'}
          </span> */}
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {hasMessages && (
            <button
              onClick={handleClearHistory}
              className="btn btn-outline btn-sm"
              style={{
                borderRadius: '9999px',
                padding: '6px 14px',
                fontSize: '12.5px',
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
              title={t('chat.reset_btn')}
            >
              <RefreshCw size={13} />
              <span>{language === 'en' ? 'New Chat' : 'Percakapan Baru'}</span>
            </button>
          )}

          <button
            onClick={() => router.push('/upload')}
            className="btn btn-outline btn-sm"
            style={{
              borderRadius: '9999px',
              padding: '6px 14px',
              fontSize: '12.5px',
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
            }}
          >
            <Plus size={13} />
            <span>{language === 'en' ? 'Upload PDF' : 'Unggah PDF'}</span>
          </button>
        </div>
      </header>

      {/* ── 2. SCROLLABLE MIDDLE CONTAINER (Scrollbar at Far Right Edge) ───── */}
      <div
        style={{
          flex: 1,
          width: '100%',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '52rem',
            margin: '0 auto',
            padding: '1.5rem 1.5rem',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {!hasMessages ? (
            /* Center Stage Gemini Hero */
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
                  Hi Muhamad Sazidan, what&apos;s on your mind?
                </h1>
              </div>

              {/* Minimal Suggested Query Chips */}
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

              {/* Query Status Indicator Toast */}
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
              {messages.map((msg) => (
                <ChatMessageItem
                  key={msg.id}
                  message={msg}
                  onSelectCitation={(source) => setInspectingSource(source)}
                />
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
                    Searching isolated internal documents...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* ── 3. FIXED BOTTOM DOCK (Pill Capsule + Disclaimer Footer) ─────── */}
      <div
        style={{
          width: '100%',
          backgroundColor: 'transparent',
          borderTop: 'none',
          flexShrink: 0,
          zIndex: 30,
          padding: '0.85rem 1.5rem 1rem',
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
          }}
        >
          {/* Centered Pill Capsule Search Prompt Bar */}
          <div className="chat-pill-bar">
            {/* Plus Action Button */}
            <button
              type="button"
              onClick={() => router.push('/upload')}
              aria-label="Add context or documents"
              title={language === 'en' ? 'Add context or documents' : 'Unggah dokumen baru'}
              style={{
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                color: 'var(--text-secondary)',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background-color 0.15s ease',
              }}
              className="hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Plus size={20} />
            </button>

            {/* Input Query Field */}
            <input
              ref={inputRef}
              autoComplete="off"
              id="promptInput"
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Apps Brilian RAG..."
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '15.5px',
                padding: '0 14px',
                fontWeight: 400,
              }}
            />

            {/* Right Trailing Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {/* Model Selector Pill with Green Active Dot */}
              <button
                type="button"
                onClick={handleToggleModel}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--bg-subtle)',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                className="hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Model Selection"
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#10B981',
                  }}
                />
                <span>Pro</span>
                <ChevronDown size={13} style={{ color: 'var(--text-muted)', marginLeft: '-2px' }} />
              </button>

              {/* Voice Input Icon */}
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

              {/* Submit Button */}
              <button
                type="button"
                id="sendBtn"
                onClick={() => handleSend()}
                disabled={isLoading || !inputQuery.trim()}
                aria-label="Submit query"
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
                  cursor: isLoading || !inputQuery.trim() ? 'not-allowed' : 'pointer',
                  opacity: isLoading || !inputQuery.trim() ? 0.6 : 1,
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                  transition: 'all 0.15s ease',
                }}
              >
                {isLoading ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <ArrowUp size={18} strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>

          {/* Ultra-Minimal Single Line Disclaimer Footer */}
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

      {/* ── Citation Inspector Drawer ──────────────────────────────── */}
      <CitationDrawer
        source={inspectingSource}
        isOpen={!!inspectingSource}
        onClose={() => setInspectingSource(null)}
      />
    </div>
  );
}
