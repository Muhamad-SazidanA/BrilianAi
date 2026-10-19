'use client';

import React, { useState, useEffect } from 'react';
import { X, BookOpen, Eye, Edit3 } from 'lucide-react';
import { CuratedInsightItem, InsightImportance } from '@/types/curation';
import MarkdownContent from '@/components/ui/MarkdownContent';
import { useLanguage } from '@/context/LanguageContext';

interface InsightEditorModalProps {
  insight: CuratedInsightItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<CuratedInsightItem>) => Promise<void>;
}

export default function InsightEditorModal({ insight, isOpen, onClose, onSave }: InsightEditorModalProps) {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [importance, setImportance] = useState<InsightImportance>('medium');
  const [category, setCategory] = useState('Ringkasan');
  const [tagsStr, setTagsStr] = useState('');
  const [sourcePages, setSourcePages] = useState('1');
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (insight) {
      setTitle(insight.title || '');
      setContent(insight.content || '');
      setImportance(insight.importance || 'medium');
      setCategory(insight.category || 'Ringkasan');
      setTagsStr(Array.isArray(insight.tags) ? insight.tags.join(', ') : '');
      const rawPages = insight.source_pages || '1';
      setSourcePages(rawPages.replace(/^(halaman|page|hal\.?)\s+/i, '').trim() || '1');
    } else {
      setTitle('');
      setContent('');
      setImportance('medium');
      setCategory('Ringkasan');
      setTagsStr('');
      setSourcePages('1');
    }
    setPreviewMode(false);
  }, [insight]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const tags = tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await onSave({
        title: title.trim(),
        content: content.trim(),
        importance,
        category: category.trim(),
        tags,
        source_pages: sourcePages.trim(),
      });
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
        backgroundColor: 'rgba(20, 22, 27, 0.5)',
        backdropFilter: 'blur(2px)',
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
          maxWidth: '560px',
          boxShadow: 'var(--shadow-float)',
          backgroundColor: 'var(--bg-card)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} color="var(--color-primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {insight ? t('insight.title_edit') : t('insight.title_create')}
            </h3>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '5px' }}>
              {t('insight.field_title')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-text"
              placeholder="Contoh: Ringkasan Perkembangan Fisioterapi..."
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                {t('insight.importance')}
              </label>
              <select
                value={importance}
                onChange={(e) => setImportance(e.target.value as InsightImportance)}
                className="input-text"
              >
                <option value="high">{t('insight.importance_high')}</option>
                <option value="medium">{t('insight.importance_med')}</option>
                <option value="low">{t('insight.importance_low')}</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                {t('insight.source_pages')}
              </label>
              <input
                type="text"
                value={sourcePages}
                onChange={(e) => setSourcePages(e.target.value)}
                className="input-text"
                placeholder="Contoh: 1-3"
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {t('insight.content')}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setPreviewMode(false)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: !previewMode ? 'var(--bg-subtle)' : 'transparent',
                    color: !previewMode ? 'var(--color-primary)' : 'var(--text-muted)',
                    fontWeight: !previewMode ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  <Edit3 size={12} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: previewMode ? 'var(--bg-subtle)' : 'transparent',
                    color: previewMode ? 'var(--color-primary)' : 'var(--text-muted)',
                    fontWeight: previewMode ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  <Eye size={12} />
                  <span>Pratinjau Tabel & Teks</span>
                </button>
              </div>
            </div>

            {previewMode ? (
              <div
                style={{
                  minHeight: '130px',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-app)',
                }}
              >
                {content.trim() ? (
                  <MarkdownContent content={content} compact />
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Belum ada teks untuk dipratinjau.
                  </span>
                )}
              </div>
            ) : (
              <textarea
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="input-text"
                placeholder="Tuliskan sintesis atau tabel Markdown intisari dokumen..."
                required
              />
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '5px' }}>
              {t('insight.tags')}
            </label>
            <input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              className="input-text"
              placeholder="sejarah, definisi, kementerian..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-outline btn-sm">
              {t('insight.cancel')}
            </button>
            <button type="submit" disabled={isSaving || !title.trim() || !content.trim()} className="btn btn-primary btn-sm">
              {isSaving ? t('insight.saving') : t('insight.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

