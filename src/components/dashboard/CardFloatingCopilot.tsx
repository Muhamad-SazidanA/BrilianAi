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
import { DashboardData, DashboardWidget } from '@/types/dashboard';
import { toast } from 'sonner';

interface CardFloatingCopilotProps {
  dashboardId: string;
  dashboardData: DashboardData;
  widget: DashboardWidget;
  widgetIndex: number;
  onMorphWidget?: (index: number, targetType: 'bar_chart' | 'table') => void;
  onClose: () => void;
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

  useEffect(() => {
    // Auto-focus input on mount
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

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
            actionDone = `Visualisasi widget otomatis diubah ke ${
              targetType === 'bar_chart' ? 'Bar Chart' : 'Tabel'
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

  return (
    <div className="db-floating-copilot-wrap">
      {/* ── Pill Input Container (Matching Image 3) ── */}
      <div className="db-floating-pill">
        <input
          ref={inputRef}
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Apps Brilian RAG..."
          className="db-floating-pill-input"
          disabled={isLoading}
        />

        {/* Microphone Button */}
        <button
          type="button"
          onClick={handleToggleMic}
          className={`db-floating-pill-mic ${isListening ? 'recording' : ''}`}
          title={isListening ? 'Berhenti merekam' : 'Gunakan input suara'}
        >
          <Mic size={17} />
        </button>

        {/* Circular Blue Submit Button with ArrowUp */}
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={isLoading || !inputMessage.trim()}
          className="db-floating-pill-send"
          title="Kirim Pertanyaan"
        >
          {isLoading ? (
            <Loader2 size={16} className="db-page-spinner" color="#FFFFFF" />
          ) : (
            <ArrowUp size={16} strokeWidth={2.6} />
          )}
        </button>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="db-floating-pill-close"
          title="Tutup Input"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Subtitle (Matching Image 3) ── */}
      <p className="db-floating-pill-subtitle">
        Apps Brilian answers strictly from uploaded internal documents with zero external leaks.
      </p>

      {/* ── Response Popover Bubble (Floating right below) ── */}
      {(response || error) && (
        <div className="db-floating-popover-card">
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-danger)', fontSize: '11.5px' }}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          ) : (
            <div>
              <div
                className="db-popover-content"
                dangerouslySetInnerHTML={{
                  __html: (response?.answer || '')
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
                    .replace(/\n/g, '<br/>')
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
