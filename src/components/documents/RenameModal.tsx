'use client';

import React, { useState, useEffect } from 'react';
import { X, Pencil } from 'lucide-react';
import { UploadBatch } from '@/types/document';
import { useLanguage } from '@/context/LanguageContext';

interface RenameModalProps {
  batch: UploadBatch | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (batchId: string, newFilename: string) => Promise<void>;
}

export default function RenameModal({ batch, isOpen, onClose, onSave }: RenameModalProps) {
  const { t } = useLanguage();
  const [filename, setFilename] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (batch) {
      setFilename(batch.original_filename);
    }
  }, [batch]);

  if (!isOpen || !batch) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filename.trim()) return;
    setIsSaving(true);
    try {
      await onSave(batch.id, filename.trim());
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="ui-card"
        style={{
          width: '100%',
          maxWidth: '460px',
          boxShadow: 'var(--shadow-float)',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Pencil size={18} color="var(--color-primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {t('rename.title')}
            </h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              {t('rename.label')}
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="input-text"
              autoFocus
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} className="btn btn-outline btn-sm">
              {t('rename.cancel')}
            </button>
            <button type="submit" disabled={isSaving || !filename.trim()} className="btn btn-primary btn-sm">
              {isSaving ? t('rename.saving') : t('rename.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
