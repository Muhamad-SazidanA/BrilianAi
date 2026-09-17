'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, HelpCircle, X, Loader2 } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'primary';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  isLoading?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'danger',
  isLoading = false,
}: ConfirmationModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  // Visual icon & colors based on variant
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <Trash2 size={20} strokeWidth={2.2} />,
          iconBg: '#FEF2F2',
          iconBorder: '#FECACA',
          iconColor: '#DC2626',
          confirmBtnBg: '#DC2626',
          confirmBtnHover: '#B91C1C',
          confirmBtnColor: '#FFFFFF',
          confirmBtnRing: 'rgba(220, 38, 38, 0.25)',
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={20} strokeWidth={2.2} />,
          iconBg: '#FFFBEB',
          iconBorder: '#FDE68A',
          iconColor: '#D97706',
          confirmBtnBg: '#D97706',
          confirmBtnHover: '#B45309',
          confirmBtnColor: '#FFFFFF',
          confirmBtnRing: 'rgba(217, 119, 6, 0.25)',
        };
      case 'primary':
      default:
        return {
          icon: <HelpCircle size={20} strokeWidth={2.2} />,
          iconBg: '#EFF6FF',
          iconBorder: '#BFDBFE',
          iconColor: '#2563EB',
          confirmBtnBg: '#2563EB',
          confirmBtnHover: '#1D4ED8',
          confirmBtnColor: '#FFFFFF',
          confirmBtnRing: 'rgba(37, 99, 235, 0.25)',
        };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '1.25rem',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={() => {
        if (!isLoading) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="ui-card"
        style={{
          width: '100%',
          maxWidth: '430px',
          backgroundColor: 'var(--bg-card, #FFFFFF)',
          borderRadius: 'var(--radius-xl, 18px)',
          border: '1px solid var(--border-default, #E2E8F0)',
          boxShadow: '0 25px 35px -5px rgba(15, 23, 42, 0.15), 0 10px 15px -5px rgba(15, 23, 42, 0.08)',
          padding: '1.65rem 1.75rem',
          position: 'relative',
          overflow: 'hidden',
          animation: 'slideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button Top Right */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="btn btn-ghost"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            width: '30px',
            height: '30px',
            padding: 0,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted, #94A3B8)',
          }}
          title="Tutup dialog"
        >
          <X size={16} />
        </button>

        {/* Modal Header: Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '1rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md, 12px)',
              backgroundColor: vStyles.iconBg,
              border: `1px solid ${vStyles.iconBorder}`,
              color: vStyles.iconColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {vStyles.icon}
          </div>

          <div style={{ paddingRight: '20px' }}>
            <h3
              id="confirm-modal-title"
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: 'var(--text-primary, #0F172A)',
                letterSpacing: '-0.02em',
                lineHeight: '22px',
                margin: 0,
              }}
            >
              {title}
            </h3>
            <div
              style={{
                fontSize: '13.5px',
                color: 'var(--text-secondary, #475569)',
                lineHeight: '21px',
                marginTop: '6px',
                fontWeight: 400,
              }}
            >
              {description}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '1.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-subtle, #F1F5F9)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn btn-outline btn-md"
            style={{
              borderRadius: 'var(--radius-sm, 8px)',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              borderRadius: 'var(--radius-sm, 8px)',
              padding: '9px 20px',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: vStyles.confirmBtnBg,
              color: vStyles.confirmBtnColor,
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
              transition: 'all 0.15s ease',
              opacity: isLoading ? 0.75 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoading) (e.currentTarget.style.backgroundColor = vStyles.confirmBtnHover);
            }}
            onMouseLeave={(e) => {
              if (!isLoading) (e.currentTarget.style.backgroundColor = vStyles.confirmBtnBg);
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
