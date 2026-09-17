'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Pin, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { ChatSession } from '@/types/chat';
import { useLanguage } from '@/context/LanguageContext';

interface ChatHistoryItemProps {
  session: ChatSession;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
  onRename: (newTitle: string) => void;
  onPin: () => void;
  onDelete: () => void;
}

export default function ChatHistoryItem({
  session,
  isActive,
  isCollapsed,
  onClick,
  onRename,
  onPin,
  onDelete,
}: ChatHistoryItemProps) {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(session.title);
  const itemRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        itemRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      if (menuOpen) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const updateMenuPosition = () => {
      const button = menuButtonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight || 142;
      const top = Math.min(
        Math.max(8, rect.top - 4),
        window.innerHeight - menuHeight - 8
      );

      setMenuPosition({
        top,
        left: rect.right + 8,
      });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [menuOpen]);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (renaming) {
      renameRef.current?.focus();
      renameRef.current?.select();
    }
  }, [renaming]);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== session.title) {
      onRename(trimmed);
    }
    setRenaming(false);
  };

  const handleRenameKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleRenameSubmit();
    if (e.key === 'Escape') {
      setRenameValue(session.title);
      setRenaming(false);
    }
  };

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={session.title}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 0',
          borderRadius: '8px',
          border: 'none',
          cursor: 'pointer',
          backgroundColor: isActive ? 'var(--chat-active-bg)' : 'transparent',
          color: isActive ? 'var(--chat-active-text)' : 'var(--text-muted)',
          transition: 'background-color 0.15s ease',
        }}
        className="hover:bg-subtle"
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isActive ? 'var(--color-primary)' : 'var(--text-muted)',
            flexShrink: 0,
          }}
        />
      </button>
    );
  }

  return (
    <div
      ref={itemRef}
      style={{ position: 'relative' }}
      className={`chat-history-item ${isActive ? 'active' : ''}`}
    >
      {/* Main row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 10px',
          cursor: renaming ? 'default' : 'pointer',
          borderRadius: '8px',
          minWidth: 0,
        }}
        onClick={renaming ? undefined : onClick}
      >
        <MessageCircle
          size={14}
          strokeWidth={isActive ? 2.2 : 1.8}
          style={{ flexShrink: 0, color: isActive ? 'var(--chat-active-icon)' : 'var(--text-muted)' }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          {renaming ? (
            <input
              ref={renameRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleRenameKey}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: '1px solid var(--color-primary)',
                borderRadius: '4px',
                fontSize: '12px',
                color: 'var(--text-primary)',
                padding: '1px 4px',
                fontFamily: 'inherit',
              }}
            />
          ) : (
            <span
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--chat-active-text)' : 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: '1.4',
              }}
            >
              {session.title}
            </span>
          )}
        </div>

        {/* Pin icon — only visible if pinned or on hover */}
        {session.is_pinned && !renaming && (
          <Pin
            size={12}
            style={{
              flexShrink: 0,
              color: isActive ? 'var(--chat-active-icon)' : 'var(--color-primary)',
              transform: 'rotate(45deg)',
            }}
          />
        )}

        {/* Three-dot menu button — only on hover / active */}
        {!renaming && (
          <button
            type="button"
            ref={menuButtonRef}
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuPosition({
                top: Math.max(8, rect.top - 4),
                left: rect.right + 8,
              });
              setMenuOpen((prev) => !prev);
            }}
            style={{
              flexShrink: 0,
              width: '22px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '5px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              opacity: isActive || menuOpen ? 1 : undefined,
              transition: 'opacity 0.15s ease, background-color 0.15s ease',
            }}
            className="chat-history-menu-btn"
            aria-label={t('chat.options')}
            title={t('chat.options')}
          >
            <MoreHorizontal size={14} />
          </button>
        )}
      </div>

      {/* Dropdown Menu */}
      {menuOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuPosition.top,
            left: menuPosition.left,
            zIndex: 1000,
            width: '164px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.16)',
            padding: '5px',
            opacity: 1,
          }}
          className="chat-history-popover"
        >
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setRenaming(true);
              setRenameValue(session.title);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              fontSize: '12.5px',
              color: 'var(--text-primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '6px',
              textAlign: 'left',
            }}
            className="hover:bg-subtle"
          >
            <Pencil size={13} />
            <span>{t('chat.rename')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onPin();
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              fontSize: '12.5px',
              color: 'var(--text-primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '6px',
              textAlign: 'left',
            }}
            className="hover:bg-subtle"
          >
            <Pin size={13} style={{ transform: 'rotate(45deg)' }} />
            <span>{session.is_pinned ? t('chat.unpin') : t('chat.pin')}</span>
          </button>

          <div
            style={{
              height: '1px',
              backgroundColor: 'var(--border-default)',
              margin: '4px 6px',
            }}
          />

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              fontSize: '12.5px',
              color: 'var(--color-danger)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '6px',
              textAlign: 'left',
            }}
            className="hover:bg-subtle"
          >
            <Trash2 size={13} />
            <span>{t('chat.delete')}</span>
          </button>
        </div>,
        document.body
      )}

      {/* CSS trick: show menu button on row hover */}
      <style jsx>{`
        div:hover .chat-history-menu-btn {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
