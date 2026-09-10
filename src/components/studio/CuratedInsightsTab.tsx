'use client';

import React, { useState } from 'react';
import {
  Bot,
  Plus,
  Download,
  Pencil,
  Trash2,
  Tag,
  BookOpen,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { CuratedInsightItem } from '@/types/curation';
import InsightEditorModal from './InsightEditorModal';
import MarkdownContent from '@/components/ui/MarkdownContent';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

function formatSourcePages(sourcePages?: string, pageLabel: string = 'Halaman'): string {
  if (!sourcePages || sourcePages.trim() === '' || sourcePages === 'N/A') return 'N/A';
  const cleaned = sourcePages.replace(/^(halaman|page|hal\.?)\s+/i, '').trim();
  return `${pageLabel} ${cleaned || sourcePages}`;
}

interface CuratedInsightsTabProps {
  batchId: string;
  insights: CuratedInsightItem[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}

export default function CuratedInsightsTab({
  batchId,
  insights,
  isLoading,
  onRefresh,
}: CuratedInsightsTabProps) {
  const { language, t } = useLanguage();
  const [isCurating, setIsCurating] = useState(false);
  const [editingInsight, setEditingInsight] = useState<CuratedInsightItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Trigger AI Auto-Curation
  const executeAutoCurate = async () => {
    setIsCurating(true);
    setFeedbackMsg(null);
    toast.promise(
      async () => {
        const res = await fetch(`/api/documents/${batchId}/curate`, {
          method: 'POST',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || (language === 'en' ? 'AI curation failed' : 'Gagal menjalankan kurasi AI'));
        await onRefresh();
        const count = data.count || data.insights?.length || 0;
        setFeedbackMsg({
          type: 'success',
          text: language === 'en'
            ? `Curation successful! ${count} high-quality insights discovered.`
            : `Kurasi berhasil! Ditemukan & diperbarui ${count} insight berkualitas.`,
        });
        return count;
      },
      {
        loading: language === 'en' ? 'Running AI curation (extracting key insights)...' : 'Menjalankan kurasi AI (mengekstrak intisari dokumen)...',
        success: (count) =>
          language === 'en'
            ? `AI curation completed! ${count} high-quality insights extracted.`
            : `Kurasi berhasil! Ditemukan & diperbarui ${count} insight berkualitas.`,
        error: (err) => {
          setFeedbackMsg({ type: 'error', text: err.message });
          return err.message;
        },
      }
    );
    setIsCurating(false);
  };

  const handleAutoCurate = () => {
    toast(language === 'en' ? 'Run AI Auto-Curation?' : 'Jalankan Kurasi Otomatis AI (LLM)?', {
      description:
        language === 'en'
          ? 'Analyze document chunks and extract key verified insights.'
          : 'Menganalisis chunk dokumen dan mengekstrak intisari berkualitas tinggi.',
      duration: 8000,
      action: {
        label: language === 'en' ? 'Run Curation' : 'Jalankan',
        onClick: () => executeAutoCurate(),
      },
      cancel: {
        label: language === 'en' ? 'Cancel' : 'Batal',
        onClick: () => {},
      },
    });
  };

  // Save (Create or Update)
  const handleSaveInsight = async (data: Partial<CuratedInsightItem>) => {
    const isEdit = !!editingInsight?.id;
    toast.promise(
      async () => {
        if (isEdit) {
          const res = await fetch(`/api/documents/${batchId}/curate/${editingInsight.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || (language === 'en' ? 'Failed to save changes' : 'Gagal menyimpan perubahan'));
          }
        } else {
          const res = await fetch(`/api/documents/${batchId}/curate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manualInsight: data }),
          });
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || (language === 'en' ? 'Failed to add insight' : 'Gagal menambahkan insight'));
          }
        }
        await onRefresh();
      },
      {
        loading: isEdit
          ? (language === 'en' ? 'Saving changes...' : 'Menyimpan perubahan...')
          : (language === 'en' ? 'Adding insight...' : 'Menambahkan insight...'),
        success: isEdit
          ? (language === 'en' ? 'Insight updated successfully' : 'Insight berhasil diperbarui')
          : (language === 'en' ? 'New insight added successfully' : 'Insight baru berhasil ditambahkan'),
        error: (err) => err.message,
      }
    );
  };

  // Delete
  const handleDeleteInsight = (insightId: number | string) => {
    toast.warning(language === 'en' ? 'Delete this curated insight?' : 'Hapus insight kurasi ini?', {
      description:
        language === 'en'
          ? 'This insight will be permanently removed from curated knowledge.'
          : 'Insight ini akan dihapus permanen dari ringkasan kurasi.',
      duration: 8000,
      action: {
        label: language === 'en' ? 'Delete' : 'Hapus',
        onClick: () => {
          toast.promise(
            async () => {
              const res = await fetch(`/api/documents/${batchId}/curate/${insightId}`, {
                method: 'DELETE',
              });
              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || (language === 'en' ? 'Failed to delete insight' : 'Gagal menghapus insight'));
              }
              await onRefresh();
            },
            {
              loading: language === 'en' ? 'Deleting insight...' : 'Menghapus insight...',
              success: language === 'en' ? 'Curated insight deleted' : 'Insight kurasi berhasil dihapus',
              error: (err) => err.message,
            }
          );
        },
      },
      cancel: {
        label: language === 'en' ? 'Cancel' : 'Batal',
        onClick: () => {},
      },
    });
  };

  // Export
  const handleExport = (format: 'json' | 'csv') => {
    toast.info(language === 'en' ? `Downloading ${format.toUpperCase()} export...` : `Mengunduh data ekspor ${format.toUpperCase()}...`);
    window.open(`/api/documents/${batchId}/export?format=${format}`, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Action Header Card */}
      <div className="ui-card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Curated Insights ({insights.length})
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {t('curate.subtitle')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => handleExport('json')}
              className="btn btn-outline btn-sm"
              disabled={insights.length === 0}
            >
              <Download size={14} />
              <span>{t('curate.export_json')}</span>
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="btn btn-outline btn-sm"
              disabled={insights.length === 0}
            >
              <FileSpreadsheet size={14} />
              <span>{t('curate.export_csv')}</span>
            </button>
            <button
              onClick={() => {
                setEditingInsight(null);
                setIsModalOpen(true);
              }}
              className="btn btn-outline btn-sm"
            >
              <Plus size={14} />
              <span>{t('curate.add_manual')}</span>
            </button>
            <button
              onClick={handleAutoCurate}
              disabled={isCurating}
              className="btn btn-primary btn-sm"
            >
              {isCurating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{t('curate.running_ai')}</span>
                </>
              ) : (
                <>
                  <Bot size={14} />
                  <span>{t('curate.run_ai')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status message */}
        {feedbackMsg && (
          <div
            style={{
              marginTop: '14px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor:
                feedbackMsg.type === 'success' ? 'var(--color-success-subtle)' : 'var(--color-danger-subtle)',
              border: `1px solid ${feedbackMsg.type === 'success' ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
              color: feedbackMsg.type === 'success' ? 'var(--color-success-text)' : 'var(--color-danger-text)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 500,
            }}
          >
            {feedbackMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}
      </div>

      {/* Insights Grid */}
      {isLoading ? (
        <div style={{ padding: '3.5rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div className="animate-spin" style={{ width: '26px', height: '26px', border: '2px solid var(--border-default)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', margin: '0 auto 10px' }} />
          <p style={{ fontSize: '13px' }}>{t('curate.loading')}</p>
        </div>
      ) : insights.length === 0 ? (
        <div className="ui-card" style={{ padding: '3.5rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <BookOpen size={38} strokeWidth={1.25} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
          <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{t('curate.empty')}</p>
          <p style={{ fontSize: '13px', marginTop: '4px', maxWidth: '360px', margin: '4px auto 0' }}>
            {t('curate.empty_desc')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {insights.map((item) => {
            const importanceBadge =
              item.importance === 'high'
                ? 'badge-danger'
                : item.importance === 'medium'
                ? 'badge-warning'
                : 'badge-neutral';

            return (
              <div
                key={item.id}
                className="ui-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderTop: item.importance === 'high' ? '3px solid var(--color-danger)' : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div>
                    <span className={`badge ${importanceBadge}`} style={{ fontSize: '10.5px' }}>
                      {item.importance.toUpperCase()}
                    </span>
                    <h4 style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px', lineHeight: '20px' }}>
                      {item.title}
                    </h4>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <button
                      onClick={() => {
                        setEditingInsight(item);
                        setIsModalOpen(true);
                      }}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '6px' }}
                      title="Edit insight"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteInsight(item.id)}
                      className="btn btn-ghost-danger btn-sm"
                      style={{ padding: '6px' }}
                      title="Hapus insight"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, minHeight: 0 }}>
                  <MarkdownContent content={item.content} compact />
                </div>

                {/* Footer: Source Pages and Tags */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-default)', paddingTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <BookOpen size={13} color="var(--color-primary)" />
                    <span style={{ fontWeight: 500 }}>{formatSourcePages(item.source_pages, t('curate.page'))}</span>
                  </div>

                  {item.tags && item.tags.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      <Tag size={12} color="var(--text-muted)" />
                      {item.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="badge badge-neutral" style={{ fontSize: '10.5px', padding: '1px 6px' }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal */}
      <InsightEditorModal
        insight={editingInsight}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingInsight(null);
        }}
        onSave={handleSaveInsight}
      />
    </div>
  );
}
