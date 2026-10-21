'use client';

import React, { useState, useEffect } from 'react';
import { X, Pencil, Globe, FileText, Shield, Building2, Tag, Calendar, GitBranch, Loader2 } from 'lucide-react';
import { UploadBatch, DocumentClassification, DocumentStatus } from '@/types/document';
import { ENTERPRISE_DIVISIONS } from '@lib/constants/divisions';
import { useLanguage } from '@/context/LanguageContext';

interface RenameModalProps {
  batch: UploadBatch | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (_batchId: string, _updates: any) => Promise<void>;
}

export default function RenameModal({ batch, isOpen, onClose, onSave }: RenameModalProps) {
  const { language } = useLanguage();
  const [filename, setFilename] = useState('');
  const [divisionId, setDivisionId] = useState('General');
  const [customDivision, setCustomDivision] = useState('');
  const [classification, setClassification] = useState<DocumentClassification>('Internal');
  const [docStatus, setDocStatus] = useState<DocumentStatus>('Menunggu Kurasi');
  const [version, setVersion] = useState('1.0');
  const [reviewDueDate, setReviewDueDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isApiBatch = Boolean(batch?.original_filename.startsWith('[API]'));

  useEffect(() => {
    if (batch) {
      setFilename(batch.original_filename);
      const isCustomDiv = !ENTERPRISE_DIVISIONS.includes(batch.division_id as any);
      if (isCustomDiv && batch.division_id) {
        setDivisionId('custom');
        setCustomDivision(batch.division_id);
      } else {
        setDivisionId(batch.division_id || 'General');
        setCustomDivision('');
      }
      setClassification(batch.classification || 'Internal');
      setDocStatus(batch.status || (batch.is_active_knowledge ? 'Aktif' : 'Menunggu Kurasi'));
      setVersion(batch.version || '1.0');
      if (batch.review_due_date) {
        try {
          const dateStr = new Date(batch.review_due_date).toISOString().split('T')[0];
          setReviewDueDate(dateStr);
        } catch {
          setReviewDueDate('');
        }
      } else {
        setReviewDueDate('');
      }
    }
  }, [batch]);

  if (!isOpen || !batch) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filename.trim()) return;
    setIsSaving(true);
    try {
      const finalDivision = divisionId === 'custom' ? customDivision.trim() || 'General' : divisionId;
      await onSave(batch.id, {
        filename: filename.trim(),
        divisionId: finalDivision,
        classification,
        status: docStatus,
        version: version.trim() || '1.0',
        reviewDueDate: reviewDueDate || null,
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
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
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
          maxWidth: '520px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-default, #e2e8f0)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-default, #e2e8f0)',
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: isApiBatch ? 'rgba(59, 130, 246, 0.1)' : 'rgba(15, 23, 42, 0.06)',
                color: isApiBatch ? '#2563eb' : 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isApiBatch ? <Globe size={16} /> : <Pencil size={16} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 650, color: 'var(--text-primary)', margin: 0 }}>
                  Edit Dokumen & Metadata
                </h3>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    backgroundColor: isApiBatch ? '#eff6ff' : '#f1f5f9',
                    color: isApiBatch ? '#1d4ed8' : '#64748b',
                    border: `1px solid ${isApiBatch ? '#bfdbfe' : '#e2e8f0'}`,
                  }}
                >
                  {isApiBatch ? 'REST API' : 'PDF'}
                </span>
              </div>
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Sesuaikan nama, hak akses divisi, klasifikasi keamanan, dan status dokumen.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '6px', borderRadius: '6px', color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Document / Source Name */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>
              <span>Nama Dokumen / Sumber Data</span>
              <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="input-text"
              style={{
                width: '100%',
                height: '34px',
                fontSize: '12.5px',
                borderRadius: '6px',
                border: '1px solid var(--border-default, #cbd5e1)',
                padding: '0 10px',
              }}
              autoFocus
              required
            />
            {isApiBatch && (
              <p style={{ fontSize: '10.5px', color: '#64748b', margin: '3px 0 0' }}>
                💡 Tip: Untuk sumber integrasi API, pertahankan prefix <code>[API]</code> agar tetap teridentifikasi sebagai data API live.
              </p>
            )}
          </div>

          {/* Row: Klasifikasi & Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>
                <Shield size={12} color="#64748b" />
                <span>Klasifikasi Keamanan (ABAC)</span>
              </label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value as DocumentClassification)}
                className="input-text"
                style={{
                  width: '100%',
                  height: '34px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default, #cbd5e1)',
                  padding: '0 8px',
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="Internal">Internal (Karyawan)</option>
                <option value="Publik">Publik (Terbuka)</option>
                <option value="Rahasia">Rahasia (Confidential)</option>
                <option value="Sangat Rahasia">Sangat Rahasia (Restricted)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>
                <Tag size={12} color="#64748b" />
                <span>Status Dokumen</span>
              </label>
              <select
                value={docStatus}
                onChange={(e) => setDocStatus(e.target.value as DocumentStatus)}
                className="input-text"
                style={{
                  width: '100%',
                  height: '34px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default, #cbd5e1)',
                  padding: '0 8px',
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="Menunggu Kurasi">Menunggu Kurasi</option>
                <option value="Aktif">Aktif (Knowledge Base)</option>
                <option value="Standby">Standby</option>
                <option value="Draft">Draft</option>
                <option value="Arsip">Arsip</option>
              </select>
            </div>
          </div>

          {/* Row: Divisi & Versi */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>
                <Building2 size={12} color="#64748b" />
                <span>Divisi Pemilik</span>
              </label>
              <select
                value={divisionId}
                onChange={(e) => setDivisionId(e.target.value)}
                className="input-text"
                style={{
                  width: '100%',
                  height: '34px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default, #cbd5e1)',
                  padding: '0 8px',
                  backgroundColor: '#ffffff',
                }}
              >
                {ENTERPRISE_DIVISIONS.map((div) => (
                  <option key={div} value={div}>
                    {div}
                  </option>
                ))}
                <option value="custom">+ Divisi Kustom Lainnya...</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>
                <GitBranch size={12} color="#64748b" />
                <span>Versi Batch</span>
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="input-text font-mono"
                style={{
                  width: '100%',
                  height: '34px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default, #cbd5e1)',
                  padding: '0 10px',
                }}
                placeholder="1.0"
              />
            </div>
          </div>

          {/* Custom Division Input if selected */}
          {divisionId === 'custom' && (
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Nama Divisi Kustom:
              </label>
              <input
                type="text"
                value={customDivision}
                onChange={(e) => setCustomDivision(e.target.value)}
                className="input-text"
                style={{
                  width: '100%',
                  height: '32px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default, #cbd5e1)',
                  padding: '0 8px',
                }}
                placeholder="Misal: Divisi Kepatuhan Khusus"
                required
              />
            </div>
          )}

          {/* Review Due Date */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '5px' }}>
              <Calendar size={12} color="#64748b" />
              <span>Jadwal Tinjau Berkala (Opsional)</span>
            </label>
            <input
              type="date"
              value={reviewDueDate}
              onChange={(e) => setReviewDueDate(e.target.value)}
              className="input-text"
              style={{
                width: '100%',
                height: '34px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid var(--border-default, #cbd5e1)',
                padding: '0 10px',
              }}
            />
          </div>

          {/* Modal Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '8px',
              marginTop: '6px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-default, #e2e8f0)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="btn btn-outline btn-sm"
              style={{ height: '32px', padding: '0 14px', fontSize: '12px', borderRadius: '6px' }}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving || !filename.trim()}
              className="btn btn-primary btn-sm"
              style={{
                height: '32px',
                padding: '0 16px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Perubahan</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
