'use client';

import React, { useState, useEffect } from 'react';
import { X, BookOpen, Eye, Edit3 } from 'lucide-react';
import { CuratedInsightItem, InsightImportance } from '@/types/curation';
import MarkdownContent from '@/components/ui/MarkdownContent';
import { useLanguage } from '@/context/LanguageContext';
import EnterpriseSelect from '@/components/ui/EnterpriseSelect';

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
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 text-blue-600 flex items-center justify-center">
              <BookOpen size={16} />
            </div>
            <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white">
              {insight ? t('insight.title_edit') : t('insight.title_create')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              {t('insight.field_title')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Contoh: Ringkasan Prosedur Operasional..."
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                {t('insight.importance')}
              </label>
              <EnterpriseSelect
                value={importance}
                onChange={(val) => setImportance(val as InsightImportance)}
                options={[
                  { value: 'high', label: t('insight.importance_high') },
                  { value: 'medium', label: t('insight.importance_med') },
                  { value: 'low', label: t('insight.importance_low') },
                ]}
                size="sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                {t('insight.source_pages')}
              </label>
              <input
                type="text"
                value={sourcePages}
                onChange={(e) => setSourcePages(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Contoh: 1-3"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {t('insight.content')}
              </label>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPreviewMode(false)}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-all font-medium ${
                    !previewMode
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  <Edit3 size={11} />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode(true)}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-all font-medium ${
                    previewMode
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  <Eye size={11} />
                  <span>Pratinjau</span>
                </button>
              </div>
            </div>

            {previewMode ? (
              <div className="min-h-[140px] max-h-[260px] overflow-y-auto p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs">
                {content.trim() ? (
                  <MarkdownContent content={content} compact />
                ) : (
                  <span className="text-slate-400 italic">Belum ada teks untuk dipratinjau.</span>
                )}
              </div>
            ) : (
              <textarea
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono leading-relaxed"
                placeholder="Tuliskan sintesis atau tabel Markdown intisari dokumen..."
                required
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              {t('insight.tags')}
            </label>
            <input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="karyawan, sop, prosedur, perizinan..."
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              {t('insight.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving || !title.trim() || !content.trim()}
              className="px-5 py-2 text-xs font-semibold rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? t('insight.saving') : t('insight.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

