'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, FileText, Send } from 'lucide-react';
import { isDataNotFoundAnswer } from '../../lib/chat/chatUtils';

/* ── Types ──────────────────────────────────────────── */
interface ChatSource {
  chunkId: number | string;
  uploadBatchId: string;
  filename: string;
  pageStart: number;
  pageEnd: number;
  content: string;
  similarity: number;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  sources?: ChatSource[];
  timestamp: string;
}

interface ChatbotWidgetProps {
  documentId?: string;
  documentName?: string;
  isActiveKnowledge?: boolean;
}

/* ── Quick suggestion questions ───────────────────── */
const QUICK_QUESTIONS = [
  'Apa ringkasan utama isi dokumen ini?',
  'Tampilkan data angka penting atau keuangan.',
  'Siapa saja pihak atau unit yang disebutkan?',
];

/* ═════════════════════════════════════════════════════
   ChatbotWidget Component
   ═════════════════════════════════════════════════════ */
export default function ChatbotWidget({
  documentId,
  documentName,
  isActiveKnowledge = false,
}: ChatbotWidgetProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [allowPublicKnowledge, setAllowPublicKnowledge] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'ai',
      text: 'Halo! Saya BrilianAI Chatbot. Tanyakan seputar dokumen yang telah aktif sebagai basis pengetahuan terkurasi di sistem.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  /* ── Send message ─────────────────────────────────── */
  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Jika dokumen spesifik dipilih tapi belum aktif sebagai basis pengetahuan AI
    if (documentId && !isActiveKnowledge) {
      const refusalMessage: Message = {
        id: `refusal-${Date.now()}`,
        sender: 'ai',
        text: `Dokumen **"${documentName || 'terpilih'}"** belum diaktifkan sebagai basis pengetahuan AI Chatbot. Dokumen baru dapat dibaca setelah proses Kurasi Insight mencapai 100% dan diaktifkan melalui tombol **"Aktifkan sebagai Basis Pengetahuan AI"**.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, userMessage, refusalMessage]);
      setInputQuery('');
      return;
    }

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: textToSend,
          documentId: documentId || undefined,
          allowPublicKnowledge,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mendapatkan jawaban dari AI.');

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.answer,
        sources: data.sources || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          text: `Maaf, terjadi kesalahan: ${error.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Text rendering helpers ───────────────────────── */
  const renderInlineBold = (content: string): React.ReactNode => {
    if (!content) return null;
    if (!content.includes('**')) {
      return content.replace(/\*+/g, '');
    }
    const parts = content.split(/(\*\*[^*]+?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const text = part.slice(2, -2).replace(/\*+/g, '').trim();
        return (
          <strong key={i} style={{ fontWeight: 600, color: 'var(--color-ink)' }}>
            {text}
          </strong>
        );
      }
      return part.replace(/\*+/g, '');
    });
  };

  const renderTable = (tableLines: string[], key: string | number) => {
    if (tableLines.length < 2) return null;
    const parseRow = (line: string) =>
      line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim());

    const headerCells = parseRow(tableLines[0]);
    const bodyRows = tableLines
      .slice(1)
      .filter((l) => !/^\|?[\s\-:|]+\|?$/.test(l))
      .map(parseRow);

    return (
      <div key={key} style={{ overflowX: 'auto', margin: '8px 0' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-sm, 6px)',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: 'var(--color-surface, #f8f9fa)' }}>
              {headerCells.map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: '6px 10px',
                    border: '1px solid var(--color-hairline)',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: 'var(--color-ink)',
                  }}
                >
                  {renderInlineBold(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, rIdx) => (
              <tr key={rIdx} style={{ backgroundColor: rIdx % 2 === 1 ? 'rgba(0,0,0,0.02)' : 'transparent' }}>
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    style={{
                      padding: '6px 10px',
                      border: '1px solid var(--color-hairline)',
                      color: 'var(--color-ink)',
                    }}
                  >
                    {renderInlineBold(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderMessageContent = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Empty line
      if (!trimmed) {
        elements.push(<div key={`empty-${i}`} style={{ height: '4px' }} />);
        i++;
        continue;
      }

      // 1. Table detection (lines starting and ending with |)
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }
        elements.push(renderTable(tableLines, `tbl-${i}`));
        continue;
      }

      // 2. Code block (``` ... ```)
      if (trimmed.startsWith('```')) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++; // skip closing ```
        elements.push(
          <div key={`code-${i}`} style={{ margin: '6px 0', borderRadius: 'var(--radius-sm, 6px)', overflow: 'hidden' }}>
            <pre
              style={{
                margin: 0,
                padding: '10px',
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                fontSize: '11px',
                fontFamily: 'var(--font-mono, monospace)',
                overflowX: 'auto',
              }}
            >
              <code>{codeLines.join('\n')}</code>
            </pre>
          </div>
        );
        continue;
      }

      // 3. Source line (Sumber: ...)
      if (trimmed.toLowerCase().startsWith('sumber:')) {
        const clean = trimmed.replace(/[\*#_]+/g, '').trim();
        elements.push(
          <div
            key={`src-${i}`}
            style={{
              marginTop: '8px',
              paddingTop: '6px',
              borderTop: '1px solid var(--color-hairline)',
              fontSize: '12px',
              lineHeight: '18px',
              color: 'var(--color-slate)',
              fontWeight: 500,
            }}
          >
            {clean}
          </div>
        );
        i++;
        continue;
      }

      // 4. Section header detection
      const isHeader =
        trimmed.startsWith('###') ||
        trimmed.startsWith('##') ||
        trimmed.startsWith('#') ||
        (trimmed.length < 60 &&
          !trimmed.startsWith('•') &&
          !trimmed.startsWith('▪') &&
          !trimmed.startsWith('-') &&
          !trimmed.startsWith('*') &&
          !/^\d+[\.\)]/.test(trimmed) &&
          i < lines.length - 1 &&
          (lines[i + 1]?.trim().startsWith('•') ||
            lines[i + 1]?.trim().startsWith('▪') ||
            lines[i + 1]?.trim().startsWith('-') ||
            lines[i + 1]?.trim().startsWith('*') ||
            /^\d+[\.\)]/.test(lines[i + 1]?.trim() || '')));

      if (isHeader) {
        const clean = trimmed.replace(/^#+\s*/, '').replace(/[\*#_]+/g, '').trim();
        elements.push(
          <div
            key={`hdr-${i}`}
            style={{
              fontWeight: 600,
              fontSize: '13px',
              color: 'var(--color-ink)',
              marginTop: i === 0 ? 0 : '8px',
              lineHeight: '18px',
            }}
          >
            {clean}
          </div>
        );
        i++;
        continue;
      }

      // 5. Numbered item (e.g. "1. ", "2) ")
      const numberedMatch = trimmed.match(/^(\d+)[\.\)]\s*(.*)/);
      if (numberedMatch) {
        const num = numberedMatch[1];
        const content = numberedMatch[2];
        const colonIdx = content.indexOf(':');
        if (colonIdx > 0 && colonIdx <= 55) {
          const rawLabel = content.slice(0, colonIdx);
          const cleanLabel = rawLabel.replace(/[\*#_]+/g, '').trim();
          const rest = content.slice(colonIdx + 1).trim();
          elements.push(
            <div key={`num-${i}`} style={{ display: 'flex', gap: '7px', alignItems: 'flex-start', paddingLeft: '2px' }}>
              <span style={{ color: 'var(--color-accent)', fontSize: '13px', lineHeight: '20px', fontWeight: 600, flexShrink: 0, minWidth: '18px' }}>
                {num}.
              </span>
              <div style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--color-ink)' }}>
                <strong style={{ fontWeight: 600, color: 'var(--color-ink)' }}>
                  {cleanLabel}:{' '}
                </strong>
                {renderInlineBold(rest)}
              </div>
            </div>
          );
        } else {
          elements.push(
            <div key={`num-${i}`} style={{ display: 'flex', gap: '7px', alignItems: 'flex-start', paddingLeft: '2px' }}>
              <span style={{ color: 'var(--color-accent)', fontSize: '13px', lineHeight: '20px', fontWeight: 600, flexShrink: 0, minWidth: '18px' }}>
                {num}.
              </span>
              <div style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--color-ink)' }}>
                {renderInlineBold(content)}
              </div>
            </div>
          );
        }
        i++;
        continue;
      }

      // 6. Bullet point item (•, ▪, -, *, or . )
      const isBullet =
        trimmed.startsWith('•') ||
        trimmed.startsWith('▪') ||
        trimmed.startsWith('- ') ||
        trimmed.startsWith('* ') ||
        trimmed.startsWith('. ');

      if (isBullet) {
        const bulletText = trimmed.replace(/^[•▪\-*.]\s*/, '');
        const colonIdx = bulletText.indexOf(':');
        if (colonIdx > 0 && colonIdx <= 55) {
          const rawLabel = bulletText.slice(0, colonIdx);
          const cleanLabel = rawLabel.replace(/[\*#_]+/g, '').trim();
          const rest = bulletText.slice(colonIdx + 1).trim();
          elements.push(
            <div key={`bullet-${i}`} style={{ display: 'flex', gap: '7px', alignItems: 'flex-start', paddingLeft: '2px' }}>
              <span style={{ color: 'var(--color-slate)', fontSize: '12px', lineHeight: '20px', flexShrink: 0 }}>•</span>
              <div style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--color-ink)' }}>
                <strong style={{ fontWeight: 600, color: 'var(--color-ink)' }}>
                  {cleanLabel}:{' '}
                </strong>
                {renderInlineBold(rest)}
              </div>
            </div>
          );
        } else {
          elements.push(
            <div key={`bullet-${i}`} style={{ display: 'flex', gap: '7px', alignItems: 'flex-start', paddingLeft: '2px' }}>
              <span style={{ color: 'var(--color-slate)', fontSize: '12px', lineHeight: '20px', flexShrink: 0 }}>•</span>
              <div style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--color-ink)' }}>
                {renderInlineBold(bulletText)}
              </div>
            </div>
          );
        }
        i++;
        continue;
      }

      // 7. Regular paragraph with bold label prefix (e.g. "**Clinician (1)**: Melakukan...")
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0 && colonIdx <= 55 && (trimmed.startsWith('**') || trimmed.startsWith('▪'))) {
        const rawLabel = trimmed.slice(0, colonIdx);
        const cleanLabel = rawLabel.replace(/[\*#_]+/g, '').trim();
        const rest = trimmed.slice(colonIdx + 1).trim();
        elements.push(
          <div key={`para-label-${i}`} style={{ display: 'flex', gap: '7px', alignItems: 'flex-start', paddingLeft: '2px' }}>
            <span style={{ color: 'var(--color-slate)', fontSize: '12px', lineHeight: '20px', flexShrink: 0 }}>•</span>
            <div style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--color-ink)' }}>
              <strong style={{ fontWeight: 600, color: 'var(--color-ink)' }}>
                {cleanLabel}:{' '}
              </strong>
              {renderInlineBold(rest)}
            </div>
          </div>
        );
        i++;
        continue;
      }

      // 8. Regular paragraph
      elements.push(
        <p key={`p-${i}`} style={{ margin: 0, fontSize: '13px', lineHeight: '20px', color: 'var(--color-ink)' }}>
          {renderInlineBold(trimmed)}
        </p>
      );
      i++;
    }

    return <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>{elements}</div>;
  };

  /* ── Render ──────────────────────────────────────────── */
  return (
    <>
      {/* ── Floating toggle button ─────────────────────── */}
      <button
        id="chatbot-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Buka chat"
        style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-ink)',
          border: 'none',
          color: '#ffffff',
          boxShadow: 'var(--shadow-float)',
          cursor: 'pointer',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.15s, transform 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.06)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
      >
        {isOpen
          ? <X size={22} strokeWidth={2} />
          : <MessageCircle size={22} strokeWidth={1.5} />
        }
      </button>

      {/* ── Chat panel ─────────────────────────────────── */}
      {isOpen && (
        <div
          id="chatbot-panel"
          className="chat-panel-enter"
          style={{
            position: 'fixed',
            bottom: '100px',
            right: '32px',
            width: '420px',
            maxWidth: 'calc(100vw - 48px)',
            height: '600px',
            maxHeight: 'calc(100vh - 130px)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-hairline)',
            backgroundColor: 'var(--color-paper)',
            boxShadow: 'var(--shadow-float)',
            zIndex: 9998,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {/* Panel header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-hairline)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              backgroundColor: 'var(--color-paper)',
            }}
          >
            <div>
              {/* Bot name + model badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--color-hairline)',
                    backgroundColor: 'var(--color-mist)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <MessageCircle size={14} strokeWidth={1.5} color="var(--color-slate)" />
                </div>
                <span className="type-card-title">BrilianAI Chatbot</span>
              </div>
              {/* Active document & Knowledge Base status */}
              {documentName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <FileText size={12} strokeWidth={1.5} color="var(--color-slate)" />
                  <span className="type-meta" style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                    {documentName}
                  </span>
                  {isActiveKnowledge ? (
                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(34, 197, 94, 0.12)', color: '#16a34a', border: '1px solid rgba(34, 197, 94, 0.3)', fontWeight: 600 }}>
                      Basis AI: Aktif
                    </span>
                  ) : (
                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(156, 163, 175, 0.1)', color: 'var(--color-slate)', border: '1px solid var(--color-hairline)' }}>
                      Belum Aktif (AI tidak baca)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="btn btn--ghost btn--icon-sm"
              aria-label="Tutup panel chat"
              style={{ flexShrink: 0 }}
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          {/* Mode toggle */}
          <div
            style={{
              padding: '8px 16px',
              borderBottom: '1px solid var(--color-hairline)',
              backgroundColor: 'var(--color-mist)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span className="type-meta" style={{ fontSize: '12px' }}>
              {allowPublicKnowledge ? 'Pengetahuan umum aktif' : 'Mode ketat (hanya dokumen)'}
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                id="chatbot-public-toggle"
                checked={allowPublicKnowledge}
                onChange={(e) => setAllowPublicKnowledge(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: 'var(--color-accent)' }}
              />
              <span className="type-meta" style={{ fontSize: '12px' }}>Data publik</span>
            </label>
          </div>

          {/* Messages scroll area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                {/* Bubble */}
                <div
                  style={{
                    maxWidth: '88%',
                    padding: '10px 14px',
                    borderRadius: msg.sender === 'user'
                      ? 'var(--radius-md) var(--radius-md) 2px var(--radius-md)'
                      : 'var(--radius-md)',
                    backgroundColor: msg.sender === 'user' ? 'var(--color-accent)' : 'var(--color-mist)',
                    color: msg.sender === 'user' ? '#ffffff' : 'var(--color-ink)',
                    fontSize: '13px',
                    lineHeight: '20px',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.sender === 'user'
                    ? <span>{msg.text}</span>
                    : renderMessageContent(msg.text)
                  }
                </div>

                {/* Timestamp */}
                <span className="type-data" style={{ fontSize: '11px', marginTop: '3px', paddingLeft: '2px', paddingRight: '2px' }}>
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-slate)' }}>
                <div
                  className="spinner"
                  style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid var(--color-hairline)',
                    borderTopColor: 'var(--color-accent)',
                    borderRadius: '50%',
                    flexShrink: 0,
                  }}
                />
                <span className="type-meta" style={{ fontSize: '12px' }}>AI sedang menganalisis dokumen...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick questions */}
          {messages.length <= 2 && (
            <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className="type-meta" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px' }}>Pertanyaan cepat</span>
              {QUICK_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  style={{
                    textAlign: 'left',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-mist)',
                    border: '1px solid var(--color-hairline)',
                    color: 'var(--color-ink)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                    lineHeight: '18px',
                    fontFamily: 'var(--font-sans)',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-accent)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-hairline)'; }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div
            style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--color-hairline)',
              display: 'flex',
              gap: '8px',
              backgroundColor: 'var(--color-paper)',
            }}
          >
            <input
              id="chatbot-input"
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
              placeholder="Ketik pertanyaan tentang dokumen..."
              disabled={isLoading}
              className="input-field"
              style={{ flex: 1 }}
            />
            <button
              id="chatbot-send-btn"
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputQuery.trim()}
              className="btn btn--solid btn--sm"
              aria-label="Kirim pesan"
              style={{ flexShrink: 0, padding: '6px 12px' }}
            >
              <Send size={14} strokeWidth={2} />
              Kirim
            </button>
          </div>
        </div>
      )}
    </>
  );
}
