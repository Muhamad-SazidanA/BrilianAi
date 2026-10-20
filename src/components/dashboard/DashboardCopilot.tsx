'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  MessageSquare,
  X,
  Send,
  Loader2,
  ChevronDown,
  Trash2,
  BarChart2,
  Table2,
  Lightbulb,
  CheckCircle2,
  TrendingUp,
  LogIn,
  AlertCircle,
} from 'lucide-react';
import { DashboardData } from '@/types/dashboard';
import { useUserSession } from '@/context/UserSessionContext';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actionDone?: string;
}

interface DashboardCopilotProps {
  dashboardId: string;
  dashboardData: DashboardData;
  onMorphWidget: (index: number, targetType: 'bar_chart' | 'table') => void;
}

const STARTER_PROMPTS = [
  { label: '💡 Ini data apaan? Jelaskan ringkasannya', prompt: 'Ini data apaan? Tolong jelaskan ringkasan dan makna data yang ada di dashboard ini.' },
  { label: '📊 Ubah tabel ke bar chart', prompt: 'Tolong ubah visualisasi data tabel menjadi grafik batang (bar chart).' },
  { label: '🔍 Apa insight & tren penting?', prompt: 'Apa insight penting, pola angka, atau anomali yang bisa disimpulkan dari data ini?' },
  { label: '📋 Tampilkan grafik sebagai tabel', prompt: 'Tolong ubah grafik batang menjadi format tabel.' },
];

export default function DashboardCopilot({
  dashboardId,
  dashboardData,
  onMorphWidget,
}: DashboardCopilotProps) {
  const router = useRouter();
  const { currentUser, isLoading: isUserLoading } = useUserSession();
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Halo! Saya **Brilian AI Dashboard Copilot**. Anda dapat bertanya apa saja tentang data di dashboard **"${dashboardData.title}"**, meminta analisis mendalam, atau meminta saya mengubah bentuk visualisasi (misalnya tabel ke bar chart atau sebaliknya).`,
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  const handleSendMessage = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend || inputMessage).trim();
      if (!text || isLoading) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputMessage('');
      setIsLoading(true);

      try {
        const res = await fetch(`/api/dashboard/${dashboardId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            dashboard: dashboardData,
            history: messages.map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 401) {
            toast.error('Harap login terlebih dahulu untuk menggunakan AI Copilot.');
            throw new Error('Sesi tidak terautentikasi. Silakan login terlebih dahulu.');
          }
          if (res.status === 429) {
            toast.error(errData.error || 'Terlalu banyak permintaan. Silakan tunggu beberapa detik.');
            throw new Error(errData.error || 'Batas frekuensi permintaan tercapai.');
          }
          throw new Error(errData.error || 'Gagal memproses pesan.');
        }

        const data = await res.json();
        let actionNote: string | undefined = undefined;

        // Check if AI triggered widget morphing
        if (data.action && data.action.type === 'morph_widget') {
          const { widgetIndex, targetType } = data.action;
          if (typeof widgetIndex === 'number' && widgetIndex >= 0 && widgetIndex < dashboardData.widgets.length) {
            onMorphWidget(widgetIndex, targetType);
            actionNote = `Visualisasi widget #${widgetIndex + 1} otomatis diubah ke ${targetType === 'bar_chart' ? 'Bar Chart' : 'Tabel'}.`;
            toast.success(actionNote);
          }
        }

        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.answer || 'Saya telah memproses pertanyaan Anda.',
          actionDone: actionNote,
        };

        setMessages((prev) => [...prev, aiMsg]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: `Maaf, terjadi kesalahan saat menganalisis: ${err.message || 'Coba lagi beberapa saat lagi.'}`,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [inputMessage, isLoading, dashboardId, dashboardData, messages, onMorphWidget]
  );

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: `Riwayat percakapan dibersihkan. Anda dapat kembali bertanya mengenai data dashboard **"${dashboardData.title}"** atau meminta perubahan chart!`,
      },
    ]);
  };

  return (
    <>
      {/* ── Floating Copilot Trigger Pill (Bottom Right) ── */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9990,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '9999px',
            background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #4f46e5 100%)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            boxShadow: '0 12px 28px -4px rgba(37, 99, 235, 0.4), 0 4px 12px -2px rgba(15, 23, 42, 0.1)',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            fontSize: '13px',
            fontWeight: 600,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 16px 32px -4px rgba(37, 99, 235, 0.5), 0 6px 14px -2px rgba(15, 23, 42, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 12px 28px -4px rgba(37, 99, 235, 0.4), 0 4px 12px -2px rgba(15, 23, 42, 0.1)';
          }}
          aria-label="Tanya AI Dashboard"
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Sparkles size={16} />
          </div>
          <span>Tanya AI Dashboard</span>
          <span
            style={{
              padding: '2px 7px',
              borderRadius: '9999px',
              fontSize: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              letterSpacing: '0.02em',
              fontWeight: 600,
            }}
          >
            Copilot
          </span>
        </button>
      )}

      {/* ── Floating Copilot Popover Window ── */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            width: '390px',
            maxWidth: 'calc(100vw - 32px)',
            height: '560px',
            maxHeight: 'calc(100vh - 48px)',
            backgroundColor: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-default, #e2e8f0)',
            borderRadius: '16px',
            boxShadow: '0 20px 48px -10px rgba(15, 23, 42, 0.25), 0 6px 16px -2px rgba(15, 23, 42, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--bg-subtle, #f8fafc)',
              borderBottom: '1px solid var(--border-default, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #2563eb, #6366f1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                }}
              >
                <Sparkles size={15} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                    Brilian AI Copilot
                  </h3>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      display: 'inline-block',
                    }}
                  />
                </div>
                <p style={{ fontSize: '10.5px', color: 'var(--text-secondary, #64748b)', margin: 0 }}>
                  Interactive Data Assistant
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={handleClearHistory}
                title="Bersihkan riwayat percakapan"
                style={{
                  padding: '5px',
                  color: 'var(--text-muted, #94a3b8)',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted, #94a3b8)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Trash2 size={13} />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Kecilkan"
                style={{
                  padding: '5px',
                  color: 'var(--text-muted, #94a3b8)',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary, #0f172a)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted, #94a3b8)';
                }}
              >
                <ChevronDown size={16} />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Tutup Copilot"
                style={{
                  padding: '5px',
                  color: 'var(--text-muted, #94a3b8)',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ef4444';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted, #94a3b8)';
                }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Active Context Banner */}
          <div
            style={{
              padding: '6px 14px',
              backgroundColor: 'rgba(37, 99, 235, 0.04)',
              borderBottom: '1px solid rgba(37, 99, 235, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#2563eb',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
              📊 <strong>Konteks:</strong> {dashboardData.title}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted, #94a3b8)' }}>
              {dashboardData.widgets.length} widgets
            </span>
          </div>

          {/* Chat Messages Stream */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    gap: '4px',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '86%',
                      padding: '9px 13px',
                      borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      backgroundColor: isUser
                        ? '#2563eb'
                        : 'var(--bg-subtle, #f1f5f9)',
                      color: isUser ? '#ffffff' : 'var(--text-primary, #0f172a)',
                      fontSize: '12.5px',
                      lineHeight: '1.45',
                      boxShadow: isUser
                        ? '0 2px 6px rgba(37, 99, 235, 0.2)'
                        : '0 1px 3px rgba(15, 23, 42, 0.04)',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {m.content}
                  </div>

                  {/* Morph Action Badge (if any) */}
                  {m.actionDone && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        fontSize: '10.5px',
                        color: '#059669',
                        fontWeight: 500,
                        marginTop: '2px',
                      }}
                    >
                      <CheckCircle2 size={12} />
                      <span>{m.actionDone}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', color: 'var(--text-muted)' }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '11.5px' }}>Copilot sedang menganalisis data dashboard...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Starter Suggestions Chips */}
          <div
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--bg-subtle, #f8fafc)',
              borderTop: '1px solid var(--border-default, #e2e8f0)',
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              scrollbarWidth: 'none',
            }}
          >
            {STARTER_PROMPTS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(item.prompt)}
                disabled={isLoading}
                style={{
                  padding: '4px 9px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  fontSize: '11px',
                  color: 'var(--text-secondary, #475569)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary, #2563eb)';
                  e.currentTarget.style.color = 'var(--color-primary, #2563eb)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-default, #e2e8f0)';
                  e.currentTarget.style.color = 'var(--text-secondary, #475569)';
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Unauthenticated User Banner */}
          {!currentUser && !isUserLoading && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'var(--color-primary-subtle, #eff6ff)',
                borderTop: '1px solid var(--color-primary-border, #bfdbfe)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                fontSize: '11px',
                color: 'var(--color-primary, #1d4ed8)',
              }}
            >
              <span>Login untuk berinteraksi dengan AI Copilot</span>
              <button
                type="button"
                onClick={() => router.push(`/login?redirect=/dashboard/${dashboardId}`)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-primary, #2563eb)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '10.5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                <LogIn size={10} />
                <span>Login</span>
              </button>
            </div>
          )}

          {/* Input Box */}
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--bg-card, #ffffff)',
              borderTop: '1px solid var(--border-default, #e2e8f0)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                maxLength={1000}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  !currentUser
                    ? 'Silakan login untuk bertanya ke Copilot...'
                    : 'Tanya data ini atau minta ubah grafik...'
                }
                disabled={isLoading || !currentUser}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  backgroundColor: !currentUser ? 'var(--bg-muted, #f1f5f9)' : 'var(--bg-subtle, #f8fafc)',
                  fontSize: '12px',
                  color: 'var(--text-primary, #0f172a)',
                  outline: 'none',
                  cursor: !currentUser ? 'not-allowed' : 'text',
                }}
              />
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={isLoading || !currentUser || !inputMessage.trim()}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  backgroundColor: currentUser && inputMessage.trim() ? '#2563eb' : '#94a3b8',
                  color: '#ffffff',
                  border: 'none',
                  cursor: currentUser && inputMessage.trim() && !isLoading ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                {isLoading ? (
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Send size={14} />
                )}
              </button>
            </div>
            {inputMessage.length > 800 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: '4px' }}>
                <span
                  style={{
                    fontSize: '10px',
                    color: inputMessage.length >= 1000 ? 'var(--color-danger, #ef4444)' : 'var(--text-muted, #64748b)',
                    fontWeight: inputMessage.length >= 1000 ? 600 : 400,
                  }}
                >
                  {inputMessage.length}/1000
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
