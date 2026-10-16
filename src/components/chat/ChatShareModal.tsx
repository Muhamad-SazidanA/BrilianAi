'use client';

import React, { useState } from 'react';
import { Share2, X, Check, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export interface ChatShareModalProps {
  shareUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
  language: 'en' | 'id';
}

export function ChatShareModal({
  shareUrl,
  isOpen,
  onClose,
  language,
}: ChatShareModalProps) {
  const [hasCopied, setHasCopied] = useState(false);

  if (!isOpen || !shareUrl) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
      toast.success(language === 'en' ? 'Link copied!' : 'Tautan berhasil disalin!');
    } catch {
      toast.error('Gagal menyalin tautan');
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '16px',
          maxWidth: '520px',
          width: '100%',
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--border-default, #e2e8f0)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Share2 size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                {language === 'en' ? 'Share link to Chat' : 'Bagikan Tautan Percakapan'}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary, #64748b)', margin: '2px 0 0' }}>
                {language === 'en'
                  ? 'Anyone with this link will be able to view this conversation.'
                  : 'Siapa saja yang memiliki link ini dapat melihat percakapan ini.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Link Input & Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '18px',
            backgroundColor: 'var(--bg-app, #f8fafc)',
            border: '1px solid var(--border-default, #cbd5e1)',
            borderRadius: '10px',
            padding: '6px 8px 6px 12px',
          }}
        >
          <input
            type="text"
            readOnly
            value={shareUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '13px',
              color: 'var(--text-primary, #0f172a)',
              fontFamily: 'monospace',
            }}
          />
          <button
            type="button"
            onClick={handleCopy}
            className="btn btn-primary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {hasCopied ? <Check size={14} /> : <Copy size={14} />}
            <span>{hasCopied ? (language === 'en' ? 'Copied!' : 'Tersalin!') : (language === 'en' ? 'Copy Link' : 'Salin Link')}</span>
          </button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '13px',
              color: 'var(--text-secondary, #64748b)',
              textDecoration: 'none',
            }}
            title={language === 'en' ? 'Open link in new tab' : 'Buka link di tab baru'}
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
