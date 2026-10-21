'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  ArrowUp,
  Mic,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { DashboardData, DashboardWidget, MorphableChartType } from '@/types/dashboard';
import { toast } from 'sonner';

interface CardFloatingCopilotProps {
  dashboardId: string;
  dashboardData: DashboardData;
  widget: DashboardWidget;
  widgetIndex: number;
  onMorphWidget?: (index: number, targetType: MorphableChartType) => void;
  onClose: () => void;
}

function renderMarkdown(content: string): string {
  if (!content) return '';
  // Sanitize raw HTML tags to prevent XSS injection
  const sanitized = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  return sanitized
    // Bold **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic *text*
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Bullet points - item / * item
    .replace(/^[-*•]\s+(.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul style="margin:6px 0 6px 12px;padding:0;list-style:disc;">$1</ul>')
    // Numbered list 1. item
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Headers ### text
    .replace(/^###\s+(.+)$/gm, '<h4 style="margin:8px 0 4px;font-size:12px;font-weight:700;color:var(--text-primary)">$1</h4>')
    .replace(/^##\s+(.+)$/gm, '<h3 style="margin:8px 0 4px;font-size:12.5px;font-weight:700;color:var(--text-primary)">$1</h3>')
    // Line breaks
    .replace(/\n\n/g, '</p><p style="margin:4px 0">')
    .replace(/\n/g, '<br/>');
}

export function CardFloatingCopilot({
  dashboardId,
  dashboardData,
  widget,
  widgetIndex,
  onMorphWidget,
  onClose,
}: CardFloatingCopilotProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [response, setResponse] = useState<{
    answer: string;
    actionDone?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  // When widgetIndex changes (user clicked another widget), reset state & focus input
  useEffect(() => {
    setResponse(null);
    setError(null);
    setInputMessage('');
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [widgetIndex]);

  // Handle Voice / Mic Input via Web Speech API
  const handleToggleMic = useCallback(() => {
    if (isListening) {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.info('Browser Anda tidak mendukung input suara langsung (Web Speech API).');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        toast.info('Mendengarkan suara Anda...');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setInputMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        toast.error('Gagal mengenali suara. Coba ulangi atau ketik pertanyaan.');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      toast.error('Terjadi kesalahan saat memulai mikrofon.');
    }
  }, [isListening]);

  const handleSubmit = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend || inputMessage).trim();
      if (!text || isLoading) return;

      setIsLoading(true);
      setError(null);

      // Contextual prompt tailored to this specific widget
      const widgetContextPrompt = `[Fokus pada Widget #${widgetIndex + 1}: "${widget.title}" (tipe: ${widget.type})]\n${text}`;

      try {
        const res = await fetch(`/api/dashboard/${dashboardId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: widgetContextPrompt,
            dashboard: dashboardData,
            history: [],
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 401) {
            toast.error('Harap login terlebih dahulu untuk menggunakan AI.');
            throw new Error('Sesi tidak terautentikasi.');
          }
          if (res.status === 429) {
            toast.error(errData.error || 'Terlalu banyak permintaan.');
            throw new Error(errData.error || 'Batas frekuensi Copilot tercapai.');
          }
          throw new Error(errData.error || 'Gagal memproses pertanyaan.');
        }

        const data = await res.json();
        let actionDone: string | undefined = undefined;

        // Execute morphing if triggered
        if (data.action && data.action.type === 'morph_widget') {
          const { widgetIndex: actionIdx, targetType } = data.action;
          const idxToMorph = typeof actionIdx === 'number' ? actionIdx : widgetIndex;
          if (onMorphWidget) {
            onMorphWidget(idxToMorph, targetType);
            const TARGET_LABELS: Record<string, string> = {
              bar_chart: 'Bar Chart',
              line_chart: 'Line Chart',
              pie_chart: 'Pie / Donut Chart',
              area_chart: 'Area Chart',
              table: 'Tabel',
            };
            actionDone = `Visualisasi widget otomatis diubah ke ${
              TARGET_LABELS[targetType] || targetType
            }.`;
            toast.success(actionDone);
          }
        }

        setResponse({
          answer: data.answer || 'Saya telah menganalisis widget ini.',
          actionDone,
        });
        setInputMessage('');
      } catch (err: any) {
        setError(err?.message || 'Gagal memproses data.');
      } finally {
        setIsLoading(false);
      }
    },
    [inputMessage, isLoading, dashboardId, dashboardData, widget, widgetIndex, onMorphWidget]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Dynamic quick suggestions based on widget type
  const suggestions: string[] = [];
  if (widget.type === 'bar_chart') {
    suggestions.push('Ubah ke Line Chart');
    suggestions.push('Ubah ke Pie Chart');
    suggestions.push('Ubah ke Tabel');
  } else if (widget.type === 'line_chart') {
    suggestions.push('Ubah ke Bar Chart');
    suggestions.push('Ubah ke Area Chart');
    suggestions.push('Ubah ke Tabel');
  } else if (widget.type === 'pie_chart') {
    suggestions.push('Ubah ke Bar Chart');
    suggestions.push('Ubah ke Line Chart');
    suggestions.push('Ubah ke Tabel');
  } else if (widget.type === 'area_chart') {
    suggestions.push('Ubah ke Line Chart');
    suggestions.push('Ubah ke Bar Chart');
    suggestions.push('Ubah ke Tabel');
  } else if (widget.type === 'table') {
    suggestions.push('Ubah ke Bar Chart');
    suggestions.push('Ubah ke Line Chart');
    suggestions.push('Ubah ke Pie Chart');
  }
  suggestions.push('Ringkas poin utama');
  suggestions.push('Analisis data ini');

  return (
    <div className="db-bottom-dock-wrapper" role="region" aria-label="AI Widget Copilot">
      {/* ── Dock Pill Input Container ── */}
      <div className="db-dock-pill">
        {/* Active Target Widget Chip */}
        <div className="db-dock-badge" title={`Target: ${widget.title}`}>
          <Sparkles size={11} className="db-dock-badge-sparkle" />
          <span className="db-dock-badge-text">{widget.title}</span>
        </div>

        {/* Text Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tanya data atau perintahkan ubah grafik..."
          className="db-dock-input"
          disabled={isLoading}
        />

        {/* Microphone Button */}
        <button
          type="button"
          onClick={handleToggleMic}
          className={`db-dock-btn-mic ${isListening ? 'recording' : ''}`}
          title={isListening ? 'Berhenti merekam' : 'Gunakan input suara'}
        >
          <Mic size={16} />
        </button>

        {/* Circular Blue Submit Button */}
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={isLoading || !inputMessage.trim()}
          className="db-dock-btn-send"
          title="Kirim Pertanyaan"
        >
          {isLoading ? (
            <Loader2 size={15} className="db-page-spinner" color="#FFFFFF" />
          ) : (
            <ArrowUp size={15} strokeWidth={2.6} />
          )}
        </button>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="db-dock-btn-close"
          title="Tutup Copilot (Esc)"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Quick Suggestions (shown when no response and empty input) ── */}
      {!response && !error && !isLoading && !inputMessage && (
        <div className="db-dock-suggestions">
          {suggestions.map((sug, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setInputMessage(sug);
                handleSubmit(sug);
              }}
              className="db-dock-suggestion-chip"
            >
              <span>{sug}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Response Popover Bubble (Floats cleanly ABOVE the dock) ── */}
      {(response || error) && (
        <div className="db-dock-response-card">
          <div className="db-popover-header">
            <div className="db-popover-header-title">
              <Sparkles size={13} />
              <span>Brilian AI · {widget.title}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setResponse(null);
                setError(null);
              }}
              className="db-icon-btn"
              title="Tutup jawaban"
            >
              <X size={12} />
            </button>
          </div>

          {error ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-danger)', fontSize: '11.5px', padding: '4px 0' }}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          ) : (
            <div>
              <div
                className="db-popover-content"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(response?.answer || '')
                }}
              />
              {response?.actionDone && (
                <div className="db-popover-action-badge">
                  <CheckCircle2 size={12} />
                  <span>{response.actionDone}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CardFloatingCopilot;
