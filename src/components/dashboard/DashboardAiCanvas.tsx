'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Mic, Loader2, RotateCcw } from 'lucide-react';
import { DashboardData, DashboardWidget, MorphableChartType } from '@/types/dashboard';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actionDone?: string;
  error?: boolean;
  timestamp: string; // e.g. "15:00 WIB"
}

export interface DashboardAiCanvasProps {
  isOpen?: boolean;
  dashboardId: string;
  dashboardData: DashboardData;
  selectedIndices: number[];
  onMorphWidget?: (index: number, targetType: MorphableChartType) => void;
  onToggleSelect?: (index: number) => void;
  onClearSelection?: () => void;
  onClose?: () => void;
}

const CHAT_STORAGE_PREFIX = 'brilian_canvas_chat_';
const POS_STORAGE_PREFIX = 'brilian_canvas_pos_';

function getLocalWibTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} WIB`;
}

const DEFAULT_WELCOME_MSG: ChatMessage = {
  id: 'init-msg',
  role: 'assistant',
  content:
    'Halo! Saya **Brilian AI Canvas**. Saya bisa merangkum insight atau mengubah visualisasi. Pilih card untuk ubah ke Bar Chart atau Tabel, atau tanya apa saja soal dashboard.',
  timestamp: getLocalWibTime(),
};

function loadStoredMessages(dashboardId: string): ChatMessage[] {
  if (typeof window === 'undefined') return [DEFAULT_WELCOME_MSG];
  try {
    const raw = sessionStorage.getItem(`${CHAT_STORAGE_PREFIX}${dashboardId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn('Failed to parse stored chat messages', err);
  }
  return [DEFAULT_WELCOME_MSG];
}

function loadStoredPosition(dashboardId: string): { x: number; y: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${POS_STORAGE_PREFIX}${dashboardId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse stored canvas position', err);
  }
  return null;
}

function renderMd(text: string): string {
  if (!text) return '';
  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return safe
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-*•]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul style="margin:4px 0 4px 14px;padding:0;list-style:disc;">$1</ul>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

export default function DashboardAiCanvas({
  isOpen = true,
  dashboardId,
  dashboardData,
  selectedIndices,
  onMorphWidget,
  onToggleSelect,
  onClearSelection,
  onClose,
}: DashboardAiCanvasProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadStoredMessages(dashboardId));
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => loadStoredPosition(dashboardId));
  const [isDragging, setIsDragging] = useState(false);

  // Sync messages to sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(`${CHAT_STORAGE_PREFIX}${dashboardId}`, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save chat to sessionStorage', e);
    }
  }, [messages, dashboardId]);

  // Sync position to sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined' || position === null) return;
    try {
      sessionStorage.setItem(`${POS_STORAGE_PREFIX}${dashboardId}`, JSON.stringify(position));
    } catch (e) {
      console.warn('Failed to save position to sessionStorage', e);
    }
  }, [position, dashboardId]);

  // Viewport clamp for restored position
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPosition((pos) => {
      if (!pos) return null;
      const panelW = 315;
      const panelH = 315;
      const maxX = Math.max(0, window.innerWidth - panelW);
      const maxY = Math.max(0, window.innerHeight - panelH);
      const clampedX = Math.min(Math.max(8, pos.x), maxX - 8);
      const clampedY = Math.min(Math.max(8, pos.y), maxY - 8);
      if (clampedX !== pos.x || clampedY !== pos.y) {
        return { x: clampedX, y: clampedY };
      }
      return pos;
    });
  }, []);

  const panelRef = useRef<HTMLElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const msgsRef = useRef<HTMLDivElement>(null);
  const speechRef = useRef<any>(null);
  const pendingScrollUserMsgIdRef = useRef<string | null>(null);
  const isInitialMountRef = useRef(true);

  // Auto-scroll messages: Anchor to user question so reading starts from the question down into the answer
  useEffect(() => {
    if (!msgsRef.current) return;

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
      return;
    }

    if (pendingScrollUserMsgIdRef.current) {
      const scrollFn = () => {
        if (!msgsRef.current) return;
        const userEl = msgsRef.current.querySelector<HTMLElement>(
          `[data-msg-id="${pendingScrollUserMsgIdRef.current}"]`
        );
        if (userEl) {
          const targetScroll = Math.max(0, userEl.offsetTop - 5);
          msgsRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
          if (!isLoading) {
            pendingScrollUserMsgIdRef.current = null;
          }
        }
      };

      scrollFn();
      const raf = requestAnimationFrame(scrollFn);
      return () => cancelAnimationFrame(raf);
    }

    if (isLoading) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const selectedWidgets = useMemo(
    () =>
      selectedIndices
        .map((i) => ({ index: i, widget: dashboardData.widgets[i] }))
        .filter((item) => Boolean(item.widget)),
    [selectedIndices, dashboardData.widgets]
  );

  // ── Dragging Handlers ──
  const startDrag = useCallback(
    (clientX: number, clientY: number) => {
      setIsDragging(true);
      const rect = panelRef.current?.getBoundingClientRect();
      const currentX = rect ? rect.left : window.innerWidth - 339;
      const currentY = rect ? rect.top : window.innerHeight - 339;

      dragOffset.current = {
        x: clientX - currentX,
        y: clientY - currentY,
      };
      if (position === null) {
        setPosition({ x: currentX, y: currentY });
      }
    },
    [position]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.icon-btn')) return;
      startDrag(e.clientX, e.clientY);
      e.preventDefault();
    },
    [startDrag]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if ((e.target as HTMLElement).closest('.icon-btn')) return;
      const touch = e.touches[0];
      if (touch) startDrag(touch.clientX, touch.clientY);
    },
    [startDrag]
  );

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (clientX: number, clientY: number) => {
      const panelW = panelRef.current?.offsetWidth || 315;
      const panelH = panelRef.current?.offsetHeight || 315;
      const maxX = Math.max(0, window.innerWidth - panelW);
      const maxY = Math.max(0, window.innerHeight - panelH);

      setPosition({
        x: Math.min(Math.max(8, clientX - dragOffset.current.x), maxX - 8),
        y: Math.min(Math.max(8, clientY - dragOffset.current.y), maxY - 8),
      });
    };

    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) onMove(touch.clientX, touch.clientY);
    };

    const onStop = () => setIsDragging(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onStop);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onStop);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onStop);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onStop);
    };
  }, [isDragging]);

  // ── Speech Recognition ──
  const handleToggleMic = useCallback(() => {
    if (isListening) {
      speechRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      toast.info('Browser Anda tidak mendukung input suara.');
      return;
    }
    const recognizer = new SpeechRec();
    recognizer.lang = 'id-ID';
    recognizer.continuous = false;
    recognizer.interimResults = false;

    recognizer.onstart = () => setIsListening(true);
    recognizer.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript;
      if (text) setInputText((prev) => (prev ? `${prev} ${text}` : text));
    };
    recognizer.onerror = () => {
      setIsListening(false);
      toast.error('Gagal mengenali suara.');
    };
    recognizer.onend = () => setIsListening(false);

    speechRef.current = recognizer;
    recognizer.start();
  }, [isListening]);

  // Build context-focused prompt
  const buildPrompt = useCallback(
    (userText: string): string => {
      if (selectedIndices.length === 0) return userText;
      const targets = selectedWidgets
        .map(({ index, widget }) => `Widget #${index + 1}: "${widget.title}" (tipe: ${widget.type})`)
        .join(', ');
      return `[Fokus pada: ${targets}]\n${userText}`;
    },
    [selectedIndices, selectedWidgets]
  );

  // Direct morph helper
  const handleDirectMorph = useCallback(
    (targetType: MorphableChartType, targetLabel: string) => {
      if (selectedIndices.length === 0) {
        toast.error('Pilih card terlebih dahulu yang ingin diubah!');
        return;
      }
      const targetIndex = selectedIndices[0];
      const widget = dashboardData.widgets[targetIndex];
      if (!widget) return;

      if (onMorphWidget) {
        onMorphWidget(targetIndex, targetType);
      }

      const timestamp = getLocalWibTime();
      setMessages((prev) => [
        ...prev,
        {
          id: `usr-${Date.now()}`,
          role: 'user',
          content: `Ubah "${widget.title}" ke ${targetLabel}`,
          timestamp,
        },
        {
          id: `asst-${Date.now() + 1}`,
          role: 'assistant',
          content: `Visualisasi card **"${widget.title}"** berhasil diubah menjadi format **${targetLabel}**. Data otomatis diperbarui.`,
          actionDone: `Diubah ke ${targetLabel}`,
          timestamp,
        },
      ]);
      toast.success(`Visualisasi diubah ke ${targetLabel}`);
    },
    [selectedIndices, dashboardData.widgets, onMorphWidget]
  );

  // Send question or task
  const handleSubmit = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride !== undefined ? textOverride : inputText).trim();
      if (!text || isLoading) return;

      const lowerText = text.toLowerCase();
      const isMorphCommand =
        lowerText.includes('bar chart') ||
        lowerText.includes('line chart') ||
        lowerText.includes('pie chart') ||
        lowerText.includes('area chart') ||
        lowerText.includes('tabel') ||
        lowerText.includes('grafik') ||
        (lowerText.includes('ubah') && (lowerText.includes('ke') || lowerText.includes('jadi')));

      const timestamp = getLocalWibTime();

      // Guard: Morph requested without selecting a card
      if (isMorphCommand && selectedIndices.length === 0) {
        const userMsgId = `usr-${Date.now()}`;
        pendingScrollUserMsgIdRef.current = userMsgId;
        setMessages((prev) => [
          ...prev,
          { id: userMsgId, role: 'user', content: text, timestamp },
          {
            id: `asst-${Date.now() + 1}`,
            role: 'assistant',
            content:
              '⚠️ **Silakan pilih card di dashboard terlebih dahulu!**\n\nUntuk mengubah format data menjadi grafik atau tabel, klik salah satu card atau tombol **+** pada card yang ingin diubah.',
            timestamp,
          },
        ]);
        setInputText('');
        return;
      }

      const userMsgId = `usr-${Date.now()}`;
      const userMsg: ChatMessage = {
        id: userMsgId,
        role: 'user',
        content: text,
        timestamp,
      };

      pendingScrollUserMsgIdRef.current = userMsgId;
      setMessages((prev) => [...prev, userMsg]);
      setInputText('');
      setIsLoading(true);

      try {
        const res = await fetch(`/api/dashboard/${dashboardId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: buildPrompt(text),
            dashboard: dashboardData,
            history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (res.status === 401) {
            toast.error('Harap login untuk menggunakan AI Assistant.');
            throw new Error('Harap login terlebih dahulu untuk menggunakan asisten AI.');
          }
          if (res.status === 429) {
            toast.error(err.error || 'Batas frekuensi tercapai.');
            throw new Error(err.error || 'Batas frekuensi pertanyaan tercapai.');
          }
          throw new Error(err.error || 'Gagal memproses jawaban dari AI.');
        }

        const data = await res.json();
        let actionDone: string | undefined;

        if (data.action?.type === 'morph_widget' && onMorphWidget) {
          const idx = typeof data.action.widgetIndex === 'number' ? data.action.widgetIndex : selectedIndices[0];
          const tt = data.action.targetType as MorphableChartType;
          if (idx !== undefined && tt) {
            onMorphWidget(idx, tt);
            const LABELS: Record<string, string> = {
              bar_chart: 'Bar Chart',
              line_chart: 'Line Chart',
              pie_chart: 'Pie Chart',
              area_chart: 'Area Chart',
              table: 'Tabel',
            };
            actionDone = `Diubah ke ${LABELS[tt] || tt}`;
            toast.success(`Visualisasi diubah ke ${LABELS[tt] || tt}`);
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: 'assistant',
            content: data.answer || 'Selesai diproses.',
            actionDone,
            timestamp: getLocalWibTime(),
          },
        ]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: err?.message || 'Terjadi kendala saat memproses permintaan.',
            error: true,
            timestamp: getLocalWibTime(),
          },
        ]);
      } finally {
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [inputText, isLoading, selectedIndices, dashboardId, buildPrompt, dashboardData, messages, onMorphWidget]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleResetChat = useCallback(() => {
    pendingScrollUserMsgIdRef.current = null;
    const resetMsg: ChatMessage = {
      id: `init-${Date.now()}`,
      role: 'assistant',
      content:
        'Halo! Riwayat percakapan telah dibersihkan. Silakan pilih card untuk mengubah visualisasi atau tanyakan apa saja seputar dashboard.',
      timestamp: getLocalWibTime(),
    };
    setMessages([resetMsg]);
    if (msgsRef.current) {
      msgsRef.current.scrollTop = 0;
    }
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(`${CHAT_STORAGE_PREFIX}${dashboardId}`);
      } catch (e) {}
    }
    toast.success('Riwayat percakapan dibersihkan.');
  }, [dashboardId]);

  return (
    <section
      ref={panelRef}
      className={`canvas-panel ${isDragging ? 'is-dragging' : ''}`}
      role="dialog"
      aria-label="Brilian AI Canvas"
      style={{
        display: isOpen === false ? 'none' : 'flex',
        ...(position !== null
          ? { left: `${position.x}px`, top: `${position.y}px`, right: 'auto', bottom: 'auto' }
          : { right: '24px', bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }),
      }}
    >
      {/* ── Background Contour Art ── */}
      <svg
        className="canvas-art"
        viewBox="0 0 350 150"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity=".14"
        aria-hidden="true"
      >
        <circle cx="310" cy="20" r="70" />
        <circle cx="310" cy="20" r="48" />
        <circle cx="310" cy="20" r="26" />
        <path d="M-10 120C60 60 120 150 200 70" />
        <path d="M-10 100C60 40 120 130 200 50" />
      </svg>

      {/* ── Header ── */}
      <header
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        title="Tarik untuk menggeser posisi asisten"
      >
        <div className="avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
          </svg>
        </div>
        <div className="who">
          <strong>Brilian AI Canvas</strong>
          <span><i></i>Terhubung</span>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={handleResetChat}
          aria-label="Bersihkan Chat"
          title="Bersihkan riwayat percakapan"
        >
          <RotateCcw size={10} />
        </button>
        {onClose && (
          <button className="icon-btn" onClick={onClose} aria-label="Tutup" title="Tutup panel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </header>

      {/* ── Context & Target Strip ── */}
      <div className="ctx">
        {selectedIndices.length === 0 ? (
          <span>Konteks: <b>Seluruh Dashboard</b> · pilih card untuk fokus</span>
        ) : selectedIndices.length === 1 ? (
          <>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Target: <b>{selectedWidgets[0]?.widget?.title || 'Card Terpilih'}</b>
            </span>
            {onToggleSelect && (
              <button
                type="button"
                className="ctx-remove-btn"
                onClick={() => onToggleSelect(selectedIndices[0])}
                title="Lepas fokus card"
              >
                ✕ Lepas
              </button>
            )}
          </>
        ) : (
          <>
            <span>Target: <b>{selectedIndices.length} Card Terpilih</b></span>
            {onClearSelection && (
              <button
                type="button"
                className="ctx-remove-btn"
                onClick={onClearSelection}
                title="Reset semua target"
              >
                ✕ Reset
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Message Stream ── */}
      <div className="msgs" ref={msgsRef} aria-live="polite">
        {messages.map((msg) => (
          <div
            key={msg.id}
            data-msg-id={msg.id}
            className={`m ${msg.role === 'assistant' ? 'bot' : 'me'}`}
          >
            {msg.role === 'assistant' ? (
              <div dangerouslySetInnerHTML={{ __html: renderMd(msg.content) }} />
            ) : (
              <div>{msg.content}</div>
            )}
            {msg.actionDone && <div className="action-tag">✓ {msg.actionDone}</div>}
            <small>{msg.timestamp}</small>
          </div>
        ))}

        {isLoading && (
          <div className="m bot typing">
            <i />
            <i />
            <i />
          </div>
        )}
      </div>

      {/* ── Contextual Quick Action Chips ── */}
      <div className="chips">
        {selectedIndices.length === 1 ? (
          <>
            <button type="button" className="chip" onClick={() => handleDirectMorph('bar_chart', 'Bar Chart')}>
              Ubah ke Bar Chart
            </button>
            <button type="button" className="chip" onClick={() => handleDirectMorph('line_chart', 'Line Chart')}>
              Ubah ke Line Chart
            </button>
            <button type="button" className="chip" onClick={() => handleDirectMorph('pie_chart', 'Pie Chart')}>
              Ubah ke Pie Chart
            </button>
            <button type="button" className="chip" onClick={() => handleDirectMorph('area_chart', 'Area Chart')}>
              Ubah ke Area Chart
            </button>
            <button type="button" className="chip" onClick={() => handleDirectMorph('table', 'Tabel')}>
              Ubah ke Tabel
            </button>
            <button type="button" className="chip" onClick={() => handleSubmit('Jelaskan rincian dan insight utama dari card ini')}>
              Insight Card Ini
            </button>
            <button type="button" className="chip" onClick={() => handleSubmit('Cek apakah ada anomali atau pola penting pada data ini?')}>
              Cek Anomali
            </button>
          </>
        ) : selectedIndices.length > 1 ? (
          <>
            <button type="button" className="chip" onClick={() => handleSubmit('Bandingkan data antara card yang saya pilih')}>
              Bandingkan Data
            </button>
            <button type="button" className="chip" onClick={() => handleSubmit('Apakah ada korelasi antara card-card yang dipilih ini?')}>
              Cek Korelasi
            </button>
            <button type="button" className="chip" onClick={() => handleSubmit('Ringkas semua card yang saya pilih secara ringkas')}>
              Ringkas Terpilih
            </button>
          </>
        ) : (
          <>
            <button type="button" className="chip" onClick={() => handleSubmit('Ringkas seluruh insight utama dari dashboard ini')}>
              Ringkas Dashboard
            </button>
            <button type="button" className="chip" onClick={() => handleSubmit('Apa tren atau poin penting yang paling menonjol?')}>
              Tren Utama
            </button>
            <button type="button" className="chip" onClick={() => handleSubmit('Berikan kesimpulan dan rekomendasi bisnis dari dashboard ini')}>
              Rekomendasi
            </button>
          </>
        )}
      </div>

      {/* ── Composer Input ── */}
      <div className="composer">
        <input
          ref={inputRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedIndices.length === 0 ? 'Tanya tentang dashboard ini…' : 'Ubah visualisasi atau tanya card ini…'}
          autoComplete="off"
          aria-label="Pesan"
          disabled={isLoading}
        />
        <button
          type="button"
          className={`icon-btn ${isListening ? 'listening' : ''}`}
          onClick={handleToggleMic}
          title={isListening ? 'Hentikan rekaman suara' : 'Input suara'}
        >
          <Mic size={12} />
        </button>
        <button
          type="button"
          className="send"
          onClick={() => handleSubmit()}
          disabled={isLoading || !inputText.trim()}
          aria-label="Kirim"
        >
          {isLoading ? (
            <Loader2 size={12} className="db-page-spinner" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Hint ── */}
      <div className="hint">
        {selectedIndices.length === 0 ? 'Enter kirim · Klik card untuk ubah ke grafik' : 'Enter kirim · Card siap diubah atau ditanyakan'}
      </div>
    </section>
  );
}
