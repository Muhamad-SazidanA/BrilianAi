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
  ThumbsUp,
  ThumbsDown,
  Send,
  X,
  Pencil,
} from 'lucide-react';
import { ChatMessage, ChatSource } from '@/types/chat';
import MarkdownContent from '@/components/ui/MarkdownContent';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface ChatMessageItemProps {
  message: ChatMessage;
  onSelectCitation: (_source: ChatSource) => void;
  onRetry?: () => void;
  onSwitchVariant?: (_newIndex: number) => void;
  onEditPrompt?: (_newText: string) => void;
  animateEntrance?: boolean;
}

export default function ChatMessageItem({
  message,
  onSelectCitation,
  onRetry,
  onSwitchVariant,
  onEditPrompt,
  animateEntrance = false,
}: ChatMessageItemProps) {
  const { language, t } = useLanguage();
  const isUser = message.sender === 'user';

  const [isCopied, setIsCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [isPromptHovered, setIsPromptHovered] = useState(false);

  React.useEffect(() => {
    setEditText(message.text);
  }, [message.text]);

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setIsEditing(false);
    if (trimmed !== message.text && onEditPrompt) {
      onEditPrompt(trimmed);
    }
  };

  // Feedback loop states (PRD v2.0 Section B8)
  const [feedbackRating, setFeedbackRating] = useState<'helpful' | 'incorrect' | 'outdated' | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackReason, setFeedbackReason] = useState<'incorrect' | 'outdated'>('incorrect');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

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

  const handleRateHelpful = async () => {
    if (feedbackRating) return;
    setFeedbackRating('helpful');
    toast.success(
      language === 'en'
        ? 'Thank you for your feedback!'
        : 'Terima kasih! Umpan balik Anda membantu meningkatkan kualitas AI.'
    );
    try {
      await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryText: 'Chat Query',
          answerText: activeAiText,
          rating: 'helpful',
        }),
      });
    } catch {
      // quiet
    }
  };

  const handleSubmitNegativeFeedback = async () => {
    setIsSubmittingFeedback(true);
    try {
      await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryText: 'Chat Query',
          answerText: activeAiText,
          rating: feedbackReason,
          feedbackText: feedbackComment,
        }),
      });
      setFeedbackRating(feedbackReason);
      setShowFeedbackModal(false);
      toast.success(
        language === 'en'
          ? 'Feedback submitted. Knowledge gap recorded.'
          : 'Umpan balik tersimpan. Kesenjangan pengetahuan telah dicatat untuk ditinjau tim ahli.'
      );
    } catch {
      toast.error('Gagal mengirim umpan balik');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div
      className={
        isUser
          ? (animateEntrance ? 'user-message-entrance' : '')
          : (animateEntrance ? 'ai-response-entrance' : '')
      }
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: isUser ? '0.75rem' : '1.25rem',
        width: '100%',
      }}
    >
      {/* User Message View */}
      {isUser ? (
        <div
          className="user-prompt-container group"
          onMouseEnter={() => setIsPromptHovered(true)}
          onMouseLeave={() => setIsPromptHovered(false)}
          style={{
            maxWidth: isEditing ? '75%' : '85%',
            width: isEditing ? '75%' : 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            position: 'relative',
          }}
        >
          {isEditing ? (
            /* Inline Edit View (Image 1 & 3: 75% Pill Container + Bottom Right Actions) */
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '8px',
              }}
            >
              {/* Pill Bordered Text Box */}
              <div
                style={{
                  width: '100%',
                  borderRadius: '20px',
                  backgroundColor: 'var(--user-bubble-bg)',
                  border: '1.5px solid var(--color-primary, #2563EB)',
                  padding: '12px 18px',
                  boxShadow: '0 0 0 1px rgba(37, 99, 235, 0.12)',
                  transition: 'all 0.15s ease',
                }}
              >
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsEditing(false);
                      setEditText(message.text);
                    } else if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveEdit();
                    }
                  }}
                  rows={Math.min(6, Math.max(2, editText.split('\n').length))}
                  style={{
                    width: '100%',
                    resize: 'none',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: '13px',
                    lineHeight: '21px',
                    color: 'var(--user-bubble-text, var(--text-main))',
                    fontFamily: 'inherit',
                  }}
                  autoFocus
                />
              </div>

              {/* Actions Below Box: Cancel (Text) + Update (Pill) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditText(message.text);
                  }}
                  className="cancel-edit-btn"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted, #94A3B8)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: '4px 6px',
                    transition: 'color 0.15s ease',
                  }}
                >
                  {language === 'en' ? 'Cancel' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={!editText.trim()}
                  className="update-edit-btn"
                  style={{
                    borderRadius: '9999px',
                    padding: '7px 20px',
                    fontSize: '13px',
                    fontWeight: 500,
                    border: 'none',
                    cursor: editText.trim() ? 'pointer' : 'not-allowed',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {language === 'en' ? 'Update' : 'Update'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* User Bubble */}
              <div
                style={{
                  padding: '8px 13px',
                  borderRadius: '14px 14px 4px 14px',
                  backgroundColor: 'var(--user-bubble-bg)',
                  color: 'var(--user-bubble-text)',
                  fontSize: '12.5px',
                  lineHeight: '19px',
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

              {/* Hover Action Bar: Copy FIRST, Edit SECOND (Image 2) */}
              <div
                className="user-prompt-actions"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '4px',
                  opacity: isPromptHovered ? 1 : 0,
                  pointerEvents: isPromptHovered ? 'auto' : 'none',
                  transition: 'opacity 0.15s ease, transform 0.15s ease',
                  transform: isPromptHovered ? 'translateY(0)' : 'translateY(-2px)',
                }}
              >
                <button
                  type="button"
                  onClick={handleCopy}
                  className="user-prompt-action-btn"
                  title={
                    isCopied
                      ? language === 'en'
                        ? 'Copied!'
                        : 'Tersalin!'
                      : language === 'en'
                      ? 'Copy'
                      : 'Salin'
                  }
                  aria-label={language === 'en' ? 'Copy' : 'Salin'}
                >
                  {isCopied ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
                </button>

                {onEditPrompt && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditText(message.text);
                      setIsEditing(true);
                    }}
                    className="user-prompt-action-btn"
                    title={language === 'en' ? 'Edit' : 'Edit'}
                    aria-label={language === 'en' ? 'Edit' : 'Edit'}
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </div>
            </>
          )}
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
              fontSize: '12.5px',
              lineHeight: '21px',
              color: message.isError
                ? 'var(--color-danger-text)'
                : 'var(--text-primary)',
              wordBreak: 'break-word',
              fontWeight: 400,
              padding: '2px 0',
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
            className="ai-response-actions"
            style={{
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
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
                  padding: '4px',
                  borderRadius: '5px',
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
                {isCopied ? <Check size={13} /> : <Copy size={13} />}
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
                  padding: '4px',
                  borderRadius: '5px',
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
                <Volume2 size={13} />
              </button>

              {/* 3. Try Again (Regenerate) */}
              <button
                type="button"
                onClick={handleTryAgain}
                title={language === 'en' ? 'Try again' : 'Coba lagi (Try again)'}
                style={{
                  padding: '4px',
                  borderRadius: '5px',
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
                <RefreshCw size={13} />
              </button>

              {/* 4. Thumbs Up (Helpful) */}
              <button
                type="button"
                onClick={handleRateHelpful}
                title="Bermanfaat (Helpful)"
                style={{
                  padding: '4px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: feedbackRating === 'helpful' ? 'var(--color-success-subtle)' : 'transparent',
                  color: feedbackRating === 'helpful' ? 'var(--color-success)' : 'var(--text-muted)',
                  cursor: feedbackRating ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                className="hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <ThumbsUp size={13} />
              </button>

              {/* 5. Thumbs Down (Feedback / Outdated / Incorrect) */}
              <button
                type="button"
                onClick={() => {
                  if (!feedbackRating) setShowFeedbackModal((prev) => !prev);
                }}
                title="Kurang tepat atau usang"
                style={{
                  padding: '4px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor:
                    feedbackRating === 'incorrect' || feedbackRating === 'outdated'
                      ? 'var(--color-danger-subtle)'
                      : 'transparent',
                  color:
                    feedbackRating === 'incorrect' || feedbackRating === 'outdated'
                      ? 'var(--color-danger)'
                      : 'var(--text-muted)',
                  cursor: feedbackRating ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                className="hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <ThumbsDown size={13} />
              </button>
            </div>

            {/* Negative Feedback Sub-Panel */}
            {showFeedbackModal && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxWidth: '380px',
                  animation: 'fadeIn 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Beri Masukan Terhadap Jawaban:
                  </span>
                  <button
                    onClick={() => setShowFeedbackModal(false)}
                    className="btn btn-ghost"
                    style={{ padding: '2px', borderRadius: '4px' }}
                  >
                    <X size={14} />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setFeedbackReason('incorrect')}
                    className={`btn btn-xs ${feedbackReason === 'incorrect' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ fontSize: '11px', flex: 1, padding: '4px 6px' }}
                  >
                    Kurang Tepat
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackReason('outdated')}
                    className={`btn btn-xs ${feedbackReason === 'outdated' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ fontSize: '11px', flex: 1, padding: '4px 6px' }}
                  >
                    Dokumen Usang
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Catatan tambahan untuk tim ahli (opsional)..."
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  className="input-text"
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '2px' }}>
                  <button
                    type="button"
                    onClick={() => setShowFeedbackModal(false)}
                    className="btn btn-ghost btn-xs"
                    style={{ fontSize: '11px' }}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitNegativeFeedback}
                    disabled={isSubmittingFeedback}
                    className="btn btn-primary btn-xs"
                    style={{ fontSize: '11px', gap: '4px' }}
                  >
                    <Send size={11} />
                    <span>{isSubmittingFeedback ? 'Mengirim...' : 'Kirim Feedback'}</span>
                  </button>
                </div>
              </div>
            )}

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
