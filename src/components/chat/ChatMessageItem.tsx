'use client';

import React, { useState } from 'react';
import {
  Copy,
  Check,
  Volume2,
  RefreshCw,
  BookOpen,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ChatMessage, ChatSource } from '@/types/chat';
import MarkdownContent from '@/components/ui/MarkdownContent';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface ChatMessageItemProps {
  message: ChatMessage;
  onSelectCitation: (source: ChatSource) => void;
  onRetry?: () => void;
  onSwitchVariant?: (newIndex: number) => void;
}

export default function ChatMessageItem({
  message,
  onSelectCitation,
  onRetry,
  onSwitchVariant,
}: ChatMessageItemProps) {
  const { language, t } = useLanguage();
  const isUser = message.sender === 'user';

  const [isCopied, setIsCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Determine active response variant for AI messages
  const variants =
    !isUser && message.variants && message.variants.length > 0
      ? message.variants
      : [{ text: message.text, sources: message.sources, timestamp: message.timestamp }];

  const variantsCount = variants.length;
  const currentIndex =
    typeof message.currentVariantIndex === 'number' &&
    message.currentVariantIndex >= 0 &&
    message.currentVariantIndex < variantsCount
      ? message.currentVariantIndex
      : variantsCount - 1;

  const currentVariant = variants[currentIndex] || variants[0];
  const activeAiText = currentVariant?.text ?? message.text;
  const activeAiSources = currentVariant?.sources ?? message.sources ?? [];

  const isLongMessage = isUser && message.text.length > 350;
  const displayText =
    isUser && isLongMessage && !isExpanded
      ? message.text.slice(0, 350) + '...'
      : message.text;

  const handleCopy = () => {
    const textToCopy = isUser ? message.text : activeAiText;
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    toast.success(
      language === 'en'
        ? 'Message text copied to clipboard'
        : 'Teks pesan disalin ke clipboard'
    );
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleReadAloud = () => {
    if (!('speechSynthesis' in window)) {
      toast.info(
        language === 'en'
          ? 'Read aloud is not supported in this browser'
          : 'Fitur pembaca suara tidak didukung di browser ini'
      );
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      window.speechSynthesis.cancel();
      const textToSpeak = isUser ? message.text : activeAiText;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = language === 'en' ? 'en-US' : 'id-ID';
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
      toast.info(
        language === 'en' ? 'Reading response aloud...' : 'Membaca audio jawaban AI...'
      );
    }
  };

  const handleTryAgain = () => {
    if (onRetry) {
      onRetry();
    } else {
      toast.info(
        language === 'en'
          ? 'Regenerating AI response...'
          : 'Mengulang penyusunan jawaban AI...'
      );
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: isUser ? '1.75rem' : '2.25rem',
        width: '100%',
      }}
    >
      {/* User Message View */}
      {isUser ? (
        <div
          style={{
            maxWidth: '85%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
          }}
        >
          {/* User Bubble */}
          <div
            style={{
              padding: '14px 20px',
              borderRadius: '20px 20px 6px 20px',
              backgroundColor: 'var(--user-bubble-bg)',
              color: 'var(--user-bubble-text)',
              fontSize: '15px',
              lineHeight: '24px',
              fontWeight: 400,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              boxShadow: 'none',
              border: 'none',
            }}
          >
            <div>{displayText}</div>

            {/* Show More / Show Less Button for Long User Prompts */}
            {isLongMessage && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--user-bubble-text)',
                  opacity: 0.85,
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <span>{isExpanded ? 'Show less' : 'Show more'}</span>
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* AI Assistant Response View (Borderless, Clean Text on Canvas) */
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          {/* AI Response Text (No Bubble Card Background) */}
          <div
            style={{
              fontSize: '15px',
              lineHeight: '26px',
              color: message.isError
                ? 'var(--color-danger-text)'
                : 'var(--text-primary)',
              wordBreak: 'break-word',
              fontWeight: 400,
              padding: '4px 0',
              maxWidth: '100%',
              width: '100%',
            }}
          >
            {message.isError ? (
              <div style={{ whiteSpace: 'pre-wrap' }}>{activeAiText}</div>
            ) : (
              <MarkdownContent content={activeAiText} />
            )}
          </div>

          {/* Action Icons Row (Variants Pager, Salin, Read Audio, Try Again) & Verified Source Citations */}
          <div
            style={{
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              width: '100%',
              flexWrap: 'wrap',
            }}
          >
            {/* Action Bar & Response Variants */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Variant Pagination: < X / Y > */}
              {variantsCount > 1 && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginRight: '6px',
                    padding: '2px 4px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    userSelect: 'none',
                  }}
                >
                  <button
                    type="button"
                    disabled={currentIndex <= 0}
                    onClick={() => onSwitchVariant && onSwitchVariant(currentIndex - 1)}
                    title={language === 'en' ? 'Previous response' : 'Jawaban sebelumnya'}
                    style={{
                      padding: '3px 4px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: currentIndex <= 0 ? 'not-allowed' : 'pointer',
                      opacity: currentIndex <= 0 ? 0.3 : 1,
                      color: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                    className={currentIndex > 0 ? 'hover:bg-slate-100 dark:hover:bg-slate-800' : ''}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span
                    style={{
                      minWidth: '32px',
                      textAlign: 'center',
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '0.03em',
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    {currentIndex + 1} / {variantsCount}
                  </span>
                  <button
                    type="button"
                    disabled={currentIndex >= variantsCount - 1}
                    onClick={() => onSwitchVariant && onSwitchVariant(currentIndex + 1)}
                    title={language === 'en' ? 'Next response' : 'Jawaban berikutnya'}
                    style={{
                      padding: '3px 4px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: currentIndex >= variantsCount - 1 ? 'not-allowed' : 'pointer',
                      opacity: currentIndex >= variantsCount - 1 ? 0.3 : 1,
                      color: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                    className={currentIndex < variantsCount - 1 ? 'hover:bg-slate-100 dark:hover:bg-slate-800' : ''}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {/* 1. Salin (Copy) */}
              <button
                type="button"
                onClick={handleCopy}
                title={language === 'en' ? 'Copy response' : 'Salin jawaban'}
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: isCopied ? '#10B981' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                className="hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
              >
                {isCopied ? <Check size={16} /> : <Copy size={16} />}
              </button>

              {/* 2. Read Audio (Voice synthesis) */}
              <button
                type="button"
                onClick={handleReadAloud}
                title={
                  isSpeaking
                    ? language === 'en'
                      ? 'Stop reading'
                      : 'Hentikan audio'
                    : language === 'en'
                    ? 'Read audio'
                    : 'Putar audio jawaban'
                }
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isSpeaking ? 'var(--color-primary-subtle)' : 'transparent',
                  color: isSpeaking ? 'var(--color-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                className="hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <Volume2 size={16} />
              </button>

              {/* 3. Try Again (Regenerate) */}
              <button
                type="button"
                onClick={handleTryAgain}
                title={language === 'en' ? 'Try again' : 'Coba lagi (Try again)'}
                style={{
                  padding: '6px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                className="hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            {/* Verified Sources Pill Citations */}
            {activeAiSources && activeAiSources.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexWrap: 'wrap',
                }}
              >
                {activeAiSources.map((src, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectCitation(src)}
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-default)',
                      fontSize: '11.5px',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                    className="hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300"
                    title={t('chat.click_citation')}
                  >
                    <BookOpen size={11} color="var(--color-primary)" />
                    <span>
                      {src.filename.length > 20
                        ? `${src.filename.substring(0, 18)}...`
                        : src.filename}{' '}
                      ({t('chat.page_abbr')}{' '}
                      {src.pageStart === src.pageEnd
                        ? src.pageStart
                        : `${src.pageStart}-${src.pageEnd}`})
                    </span>
                    <ExternalLink size={10} style={{ opacity: 0.6 }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
