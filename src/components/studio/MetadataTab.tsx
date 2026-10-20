'use client';

import React, { useState } from 'react';
import { UploadBatch, DocumentChunk, DocumentClassification, DocumentStatus } from '@/types/document';
import { useLanguage } from '@/context/LanguageContext';
import { formatDateTime } from '@lib/utils/formatters';
import { Shield, GitBranch, Building2, Calendar, Lock, Pencil, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
    if (editStatus === 'Aktif' && (batch.curated_count || 0) === 0) {
      toast.error(
        language === 'en'
          ? 'Document cannot be activated before being curated. Please curate at least 1 insight first.'
          : 'Dokumen belum memiliki insight terkurasi. Silakan lakukan kurasi dokumen terlebih dahulu sebelum menyetel status Aktif.'
      );
      return;
    }

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Enterprise KMS Governance & ABAC Card */}
      <div className="ui-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Tata Kelola Dokumen & Keamanan Akses (ABAC)
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
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
              className="btn btn-outline btn-sm"
              style={{ gap: '6px' }}
            >
              <Pencil size={13} />
              <span>Ubah Tata Kelola</span>
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
                className="btn btn-ghost btn-sm"
              >
                <X size={14} />
                <span>Batal</span>
              </button>
              <button
                onClick={handleSaveGovernance}
                disabled={isSaving}
                className="btn btn-primary btn-sm"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {/* Divisi */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Divisi Pemilik
              </label>
              <input
                type="text"
                value={editDivision}
                onChange={(e) => setEditDivision(e.target.value)}
                className="input-text"
                style={{ width: '100%', fontSize: '13px' }}
              />
            </div>

            {/* Klasifikasi ABAC */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Klasifikasi Keamanan
              </label>
              <select
                value={editClassification}
                onChange={(e) => setEditClassification(e.target.value as DocumentClassification)}
                className="input-text"
                style={{ width: '100%', fontSize: '13px' }}
              >
                <option value="Publik">Publik</option>
                <option value="Internal">Internal</option>
                <option value="Rahasia">Rahasia</option>
                <option value="Sangat Rahasia">Sangat Rahasia</option>
              </select>
            </div>

            {/* Status Siklus Hidup */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Status Siklus Hidup
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as DocumentStatus)}
                className="input-text"
                style={{ width: '100%', fontSize: '13px' }}
              >
                <option value="Aktif" disabled={!batch.curated_count}>
                  Aktif {batch.curated_count ? '(Terindeks AI Chatbot)' : '(Terkunci: Wajib Kurasi Dahulu)'}
                </option>
                <option value="Draft">Draft (Belum diindeks)</option>
                <option value="Review">Review (Menunggu tinjauan)</option>
                <option value="Superseded">Superseded (Digantikan versi baru)</option>
                <option value="Arsip">Arsip (Diarsipkan)</option>
              </select>
            </div>

            {/* Tanggal Tinjau */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Jadwal Tinjau Berkala
              </label>
              <input
                type="date"
                value={editReviewDueDate}
                onChange={(e) => setEditReviewDueDate(e.target.value)}
                className="input-text"
                style={{ width: '100%', fontSize: '13px' }}
              />
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* Divisi */}
            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Building2 size={12} />
                <span>Divisi Pemilik</span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {batch.division_id || 'General'}
              </div>
            </div>

            {/* Klasifikasi */}
            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {batch.classification === 'Sangat Rahasia' ? <Lock size={12} /> : <Shield size={12} />}
                <span>Klasifikasi Akses</span>
              </div>
              <span
                className={`badge ${
                  batch.classification === 'Publik'
                    ? 'badge-success'
                    : batch.classification === 'Rahasia'
                    ? 'badge-warning'
                    : batch.classification === 'Sangat Rahasia'
                    ? 'badge-danger'
                    : 'badge-neutral'
                }`}
                style={{ fontSize: '12px', fontWeight: 700, padding: '3px 8px' }}
              >
                {batch.classification || 'Internal'}
              </span>
            </div>

            {/* Status Siklus */}
            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <GitBranch size={12} />
                <span>Status Siklus Hidup</span>
              </div>
              <span
                className={`badge ${
                  batch.status === 'Aktif'
                    ? 'badge-success'
                    : batch.status === 'Review'
                    ? 'badge-warning'
                    : 'badge-neutral'
                }`}
                style={{ fontSize: '12px', fontWeight: 700, padding: '3px 8px' }}
              >
                {batch.status || (batch.is_active_knowledge ? 'Aktif' : 'Draft')}
              </span>
            </div>

            {/* Versi & Tanggal Tinjau */}
            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Calendar size={12} />
                <span>Versi & Jadwal Tinjau</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                v{batch.version || '1.0'}{' '}
                {batch.review_due_date ? (
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    · Tinjau: {new Date(batch.review_due_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                ) : (
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>· Belum dijadwalkan</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Technical Extraction Details Card */}
      <div className="ui-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('meta.title')}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {t('meta.subtitle')}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {metadataItems.map((item) => (
            <div
              key={item.label}
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-default)',
              }}
            >
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                {item.label}
              </div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontFamily: item.mono ? 'var(--font-mono)' : 'inherit',
                  wordBreak: 'break-all',
                }}
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


