'use client';

import React, { useState } from 'react';
import { UploadBatch, DocumentChunk, DocumentClassification, DocumentStatus } from '@/types/document';
import { useLanguage } from '@/context/LanguageContext';
import { formatDateTime } from '@lib/utils/formatters';
import { Shield, GitBranch, Building2, Calendar, Lock, Pencil, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import EnterpriseSelect from '@/components/ui/EnterpriseSelect';

interface MetadataTabProps {
  batch: UploadBatch | null;
  chunks: DocumentChunk[];
  onBatchUpdated?: (_updated: UploadBatch) => void;
}

export default function MetadataTab({ batch, chunks, onBatchUpdated }: MetadataTabProps) {
  const { language, t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form states
  const [editDivision, setEditDivision] = useState(batch?.division_id || 'General');
  const [editClassification, setEditClassification] = useState<DocumentClassification>(
    batch?.classification || 'Internal'
  );
  const [editStatus, setEditStatus] = useState<DocumentStatus>(
    batch?.status || (batch?.is_active_knowledge ? 'Aktif' : 'Draft')
  );
  const [editReviewDueDate, setEditReviewDueDate] = useState<string>(
    batch?.review_due_date ? String(batch.review_due_date).split('T')[0] : ''
  );

  if (!batch) return null;

  const totalChars = chunks.reduce((acc, c) => acc + (c.content?.length || 0), 0);
  const avgChars = chunks.length > 0 ? Math.round(totalChars / chunks.length) : 0;
  const chunkPerRatio = batch.page_count > 0 ? (chunks.length / batch.page_count).toFixed(1) : '0';

  const formattedDate = formatDateTime(batch.uploaded_at, language, {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const handleSaveGovernance = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/documents/${batch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          divisionId: editDivision,
          classification: editClassification,
          status: editStatus,
          reviewDueDate: editReviewDueDate || null,
          isActiveKnowledge: editStatus === 'Aktif',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menyimpan perubahan tata kelola dokumen.');
      }

      const updatedBatch: UploadBatch = {
        ...batch,
        division_id: editDivision,
        classification: editClassification,
        status: editStatus,
        review_due_date: editReviewDueDate || null,
        is_active_knowledge: editStatus === 'Aktif',
      };

      if (onBatchUpdated) {
        onBatchUpdated(updatedBatch);
      }

      setIsEditing(false);
      toast.success(
        language === 'en'
          ? 'Governance and access controls updated successfully'
          : 'Tata kelola dan kontrol akses dokumen berhasil diperbarui'
      );
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan perubahan');
    } finally {
      setIsSaving(false);
    }
  };

  const metadataItems = [
    { label: t('meta.batch_id'), value: batch.id, mono: true },
    { label: t('meta.filename'), value: batch.original_filename },
    { label: t('meta.completed'), value: formattedDate },
    { label: t('meta.pages'), value: `${batch.page_count} ${t('studio.pages')}` },
    { label: t('meta.chunks'), value: `${batch.chunk_count} ${t('studio.chunks')}` },
    {
      label: t('meta.ratio'),
      value: language === 'en' ? `~${chunkPerRatio} chunks / page` : `~${chunkPerRatio} chunk / halaman`,
    },
    {
      label: t('meta.avg_len'),
      value:
        language === 'en'
          ? `${avgChars} characters (Sliding Window Target: 800)`
          : `${avgChars} karakter (Sliding Window Target: 800)`,
    },
    { label: t('meta.vision'), value: 'Vision OCR Engine (In-memory page scan)' },
    {
      label: t('meta.embedding'),
      value: language === 'en' ? 'Dense Vector · 1024 Dimensions' : 'Vektor Padat · 1024 Dimensi',
    },
    { label: t('meta.vector_db'), value: 'pgvector (HNSW Index cosine similarity)' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Enterprise KMS Governance & ABAC Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Tata Kelola Dokumen & Keamanan Akses (ABAC)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Klasifikasi keamanan, divisi pemilik, siklus hidup dokumen, dan jadwal tinjauan berkala
            </p>
          </div>

          {!isEditing ? (
            <button
              onClick={() => {
                setEditDivision(batch.division_id || 'General');
                setEditClassification(batch.classification || 'Internal');
                setEditStatus(batch.status || (batch.is_active_knowledge ? 'Aktif' : 'Draft'));
                setEditReviewDueDate(batch.review_due_date ? String(batch.review_due_date).split('T')[0] : '');
                setIsEditing(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition-all self-start sm:self-auto"
            >
              <Pencil size={13} className="text-slate-500" />
              <span>Ubah Tata Kelola</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={14} />
                <span>Batal</span>
              </button>
              <button
                onClick={handleSaveGovernance}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm transition-all"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Divisi */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Divisi Pemilik
              </label>
              <input
                type="text"
                value={editDivision}
                onChange={(e) => setEditDivision(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Klasifikasi ABAC */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Klasifikasi Keamanan
              </label>
              <EnterpriseSelect
                value={editClassification}
                onChange={(val) => setEditClassification(val as DocumentClassification)}
                options={[
                  { value: 'Publik', label: 'Publik' },
                  { value: 'Internal', label: 'Internal' },
                  { value: 'Rahasia', label: 'Rahasia' },
                  { value: 'Sangat Rahasia', label: 'Sangat Rahasia' },
                ]}
                size="sm"
              />
            </div>

            {/* Status Siklus Hidup */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Status Siklus Hidup
              </label>
              <EnterpriseSelect
                value={editStatus}
                onChange={(val) => setEditStatus(val as DocumentStatus)}
                options={[
                  { value: 'Aktif', label: 'Aktif (Terindeks AI Chatbot)' },
                  { value: 'Draft', label: 'Draft (Belum diindeks)' },
                  { value: 'Review', label: 'Review (Menunggu tinjauan)' },
                  { value: 'Superseded', label: 'Superseded (Digantikan versi baru)' },
                  { value: 'Arsip', label: 'Arsip (Diarsipkan)' },
                ]}
                size="sm"
              />
            </div>

            {/* Tanggal Tinjau */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Jadwal Tinjau Berkala
              </label>
              <input
                type="date"
                value={editReviewDueDate}
                onChange={(e) => setEditReviewDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Divisi */}
            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/80">
              <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 size={13} className="text-slate-400" />
                <span>Divisi Pemilik</span>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {batch.division_id || 'General'}
              </div>
            </div>

            {/* Klasifikasi */}
            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/80">
              <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                {batch.classification === 'Sangat Rahasia' ? <Lock size={13} /> : <Shield size={13} />}
                <span>Klasifikasi Akses</span>
              </div>
              <div>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    batch.classification === 'Publik'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                      : batch.classification === 'Rahasia'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                      : batch.classification === 'Sangat Rahasia'
                      ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                      : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800'
                  }`}
                >
                  {batch.classification || 'Internal'}
                </span>
              </div>
            </div>

            {/* Status Siklus */}
            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/80">
              <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <GitBranch size={13} className="text-slate-400" />
                <span>Status Siklus Hidup</span>
              </div>
              <div>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    batch.status === 'Aktif'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                      : batch.status === 'Review'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                      : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                  }`}
                >
                  {batch.status || (batch.is_active_knowledge ? 'Aktif' : 'Draft')}
                </span>
              </div>
            </div>

            {/* Versi & Tanggal Tinjau */}
            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/80">
              <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar size={13} className="text-slate-400" />
                <span>Versi & Jadwal Tinjau</span>
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                v{batch.version || '1.0'}{' '}
                {batch.review_due_date ? (
                  <span className="text-[11px] text-slate-500 font-normal">
                    · Tinjau: {new Date(batch.review_due_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 font-normal">· Belum dijadwalkan</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Technical Extraction Details Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {t('meta.title')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('meta.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metadataItems.map((item) => (
            <div
              key={item.label}
              className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1.5">
                {item.label}
              </div>
              <div
                className={`text-sm font-semibold text-slate-800 dark:text-slate-100 ${
                  item.mono ? 'font-mono text-xs text-blue-600 dark:text-blue-400' : ''
                } break-all`}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


