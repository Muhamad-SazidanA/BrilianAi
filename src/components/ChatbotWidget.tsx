'use client';

import React, { useState, useRef, useEffect } from 'react';

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
}

export default function ChatbotWidget({ documentId, documentName }: ChatbotWidgetProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [allowPublicKnowledge, setAllowPublicKnowledge] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'ai',
      text: documentName
        ? `Halo! Saya AI Chatbot (**Gemma 2 2B**). Saya siap menjawab pertanyaan Anda berdasarkan isi dokumen **"${documentName}"**.`
        : 'Halo! Saya AI Chatbot (**Gemma 2 2B**). Silakan pilih dokumen atau tanyakan isi dokumen yang telah tersimpan di sistem.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Update welcome message when document changes
  useEffect(() => {
    if (documentName) {
      setMessages((prev) => [
        ...prev,
        {
          id: `doc-switch-${Date.now()}`,
          sender: 'ai',
          text: `📌 Dokumen aktif berganti ke: **${documentName}**. Silakan ajukan pertanyaan seputar dokumen ini.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [documentId, documentName]);

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

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

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mendapatkan jawaban dari AI.');
      }

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
          text: `⚠️ Maaf, terjadi kesalahan: ${error.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to parse **bold** and remove ugly stray asterisks
  const formatInlineBold = (content: string) => {
    if (!content.includes('**') && !content.includes('*')) {
      return content;
    }

    const parts = content.split(/(\*\*[^*]+?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const textInside = part.slice(2, -2);
        return (
          <strong key={i} style={{ color: '#ffffff', fontWeight: 700 }}>
            {textInside}
          </strong>
        );
      }
      // Remove any stray lonely single or double asterisks
      return part.replace(/\*+/g, '');
    });
  };

  // Helper to format text with bold label before colon and zero asterisks
  const formatBulletContent = (content: string) => {
    // Strip all raw markdown asterisks
    const cleanContent = content.replace(/\*+/g, '').trim();

    // If it has a label before colon (e.g. "Holistic Care: Merawat...")
    const colonIndex = cleanContent.indexOf(':');
    if (colonIndex > 0 && colonIndex <= 45) {
      const label = cleanContent.substring(0, colonIndex + 1);
      const rest = cleanContent.substring(colonIndex + 1);
      return (
        <span>
          <strong style={{ color: '#ffffff', fontWeight: 700 }}>{label}</strong>
          <span style={{ color: '#e2e8f0' }}>{rest}</span>
        </span>
      );
    }

    return <span style={{ color: '#e2e8f0' }}>{cleanContent}</span>;
  };

  // Helper to render clean structured message matching reference image exactly
  const renderMessageContent = (text: string) => {
    if (!text) return null;

    const lines = text.split('\n');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} style={{ height: '0.2rem' }} />;
          }

          // Format Source line: "Sumber: ..."
          if (trimmed.toLowerCase().startsWith('sumber:')) {
            const cleanSource = trimmed.replace(/\*+/g, '');
            return (
              <div
                key={idx}
                style={{
                  marginTop: '0.45rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  fontSize: '0.72rem',
                  color: '#a5b4fc',
                  fontStyle: 'italic',
                }}
              >
                📄 {cleanSource}
              </div>
            );
          }

          // Format Section Header (e.g. "5 Pilar Filosofi Fisioterapi Modern" or "Tujuan Filosofi...")
          const isHeader =
            trimmed.startsWith('###') ||
            trimmed.startsWith('##') ||
            trimmed.startsWith('#') ||
            (trimmed.length < 60 &&
              !trimmed.startsWith('•') &&
              !trimmed.startsWith('▪') &&
              !trimmed.startsWith('-') &&
              !trimmed.startsWith('*') &&
              !/^\d+\./.test(trimmed) &&
              idx < lines.length - 1 &&
              (lines[idx + 1]?.trim().startsWith('•') ||
                lines[idx + 1]?.trim().startsWith('▪') ||
                lines[idx + 1]?.trim().startsWith('-') ||
                /^\d+\./.test(lines[idx + 1]?.trim() || '')));

          if (isHeader) {
            const cleanHeader = trimmed.replace(/^#+\s*/, '').replace(/\*+/g, '');
            return (
              <div
                key={idx}
                style={{
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  color: '#ffffff',
                  marginTop: idx === 0 ? '0' : '0.55rem',
                  marginBottom: '0.1rem',
                  lineHeight: '1.4',
                }}
              >
                {cleanHeader}
              </div>
            );
          }

          // Format Bullet Point (• or ▪ or - or * or numbered 1.)
          const isBullet =
            trimmed.startsWith('•') ||
            trimmed.startsWith('▪') ||
            trimmed.startsWith('- ') ||
            trimmed.startsWith('* ') ||
            /^\d+\.\s/.test(trimmed);

          if (isBullet) {
            const bulletText = trimmed.replace(/^[•▪\-*]\s*/, '').replace(/^\d+\.\s*/, '');
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.45rem',
                  paddingLeft: '0.1rem',
                  lineHeight: '1.5',
                }}
              >
                {/* Square bullet ▪ matching screenshot exactly */}
                <span
                  style={{
                    color: '#94a3b8',
                    fontSize: '0.8rem',
                    lineHeight: '1.45',
                    flexShrink: 0,
                    userSelect: 'none',
                  }}
                >
                  ▪
                </span>
                <div style={{ fontSize: '0.82rem', lineHeight: '1.5' }}>
                  {formatBulletContent(bulletText)}
                </div>
              </div>
            );
          }

          // Regular paragraph (intro or body): clean asterisks
          const cleanParagraph = trimmed.replace(/\*+/g, '');
          return (
            <p
              key={idx}
              style={{
                margin: 0,
                color: '#f8fafc',
                lineHeight: '1.55',
                fontSize: '0.82rem',
              }}
            >
              {cleanParagraph}
            </p>
          );
        })}
      </div>
    );
  };

  const quickQuestions = [
    'Apa ringkasan utama isi dokumen ini?',
    'Tampilkan data angka penting atau keuangan di dokumen ini.',
    'Siapa saja pihak atau unit yang disebutkan?',
  ];

  return (
    <>
      {/* Floating Toggle Button (Pojok Kanan Bawah) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Buka AI Chatbot"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          border: '2px solid rgba(255, 255, 255, 0.25)',
          color: '#fff',
          boxShadow: '0 8px 30px rgba(99, 102, 241, 0.5)',
          cursor: 'pointer',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.6rem',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Chat Window Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '96px',
            right: '24px',
            width: '420px',
            maxWidth: 'calc(100vw - 32px)',
            height: '620px',
            maxHeight: 'calc(100vh - 120px)',
            borderRadius: '16px',
            border: '1px solid #1e293b',
            background: '#0a0f1d',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'inherit',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '1rem 1.25rem',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🤖</span>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                  BrilianAI Chatbot
                </h3>
                <span
                  style={{
                    fontSize: '0.65rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    background: '#064e3b',
                    color: '#34d399',
                    border: '1px solid #059669',
                    fontWeight: 600,
                  }}
                >
                  gemma2:2b
                </span>
              </div>
              <p
                style={{
                  margin: '0.2rem 0 0 0',
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '300px',
                }}
              >
                {documentName ? `📑 Dokumen: ${documentName}` : '🌐 Lintas seluruh dokumen tersimpan'}
              </p>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '0.25rem',
              }}
            >
              ✕
            </button>
          </div>

          {/* Mode Toggle Bar */}
          <div
            style={{
              padding: '0.5rem 1rem',
              background: '#0d1322',
              borderBottom: '1px solid #172033',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>
              {allowPublicKnowledge ? '🌐 Pengetahuan Umum Aktif' : '🛡️ Mode Ketat (Hanya Dokumen)'}
            </span>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={allowPublicKnowledge}
                onChange={(e) => setAllowPublicKnowledge(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.7rem', color: allowPublicKnowledge ? '#38bdf8' : '#64748b' }}>
                Data Publik
              </span>
            </label>
          </div>

          {/* Messages Scroll Area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
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
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '0.75rem 0.95rem',
                    borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    background: msg.sender === 'user' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : '#131b2e',
                    border: msg.sender === 'user' ? 'none' : '1px solid #1e293b',
                    color: '#f8fafc',
                    fontSize: '0.82rem',
                    lineHeight: '1.5',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {renderMessageContent(msg.text)}

                  {/* Document Sources Citations */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div
                      style={{
                        marginTop: '0.65rem',
                        paddingTop: '0.5rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                        📖 Referensi Halaman Dokumen:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {msg.sources.map((src, idx) => (
                          <span
                            key={idx}
                            title={src.content.substring(0, 100) + '...'}
                            style={{
                              fontSize: '0.65rem',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              background: '#1e3a8a33',
                              border: '1px solid #2563eb66',
                              color: '#60a5fa',
                              fontWeight: 600,
                            }}
                          >
                            Hal {src.pageStart === src.pageEnd ? src.pageStart : `${src.pageStart}-${src.pageEnd}`} ({Math.round(src.similarity * 100)}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '0.65rem', color: '#475569', marginTop: '0.2rem', padding: '0 0.3rem' }}>
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', color: '#94a3b8' }}>
                <span className="spinner" style={{ width: '14px', height: '14px', border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} />
                <span style={{ fontSize: '0.75rem' }}>Gemma 2 sedang menganalisis dokumen...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions (if fewer messages) */}
          {messages.length <= 2 && (
            <div style={{ padding: '0 1rem 0.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Pertanyaan Cepat:</span>
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  style={{
                    textAlign: 'left',
                    padding: '0.35rem 0.6rem',
                    borderRadius: '6px',
                    background: '#0d1322',
                    border: '1px solid #1e293b',
                    color: '#94a3b8',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  💡 {q}
                </button>
              ))}
            </div>
          )}

          {/* Input Box Bar */}
          <div
            style={{
              padding: '0.75rem 1rem',
              background: '#080c16',
              borderTop: '1px solid #1e293b',
              display: 'flex',
              gap: '0.5rem',
            }}
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              placeholder="Ketik pertanyaan tentang dokumen..."
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '0.6rem 0.85rem',
                borderRadius: '8px',
                background: '#0f172a',
                border: '1px solid #1e293b',
                color: '#fff',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputQuery.trim()}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                background: !inputQuery.trim() || isLoading ? '#1e293b' : 'linear-gradient(135deg, #6366f1, #a855f7)',
                border: 'none',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: !inputQuery.trim() || isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              Kirim
            </button>
          </div>
        </div>
      )}
    </>
  );
}
