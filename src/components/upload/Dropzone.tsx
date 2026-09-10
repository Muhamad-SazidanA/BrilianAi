'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, X, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface DropzoneProps {
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
  uploadError: string | null;
}

export default function Dropzone({ onUpload, isUploading, uploadError }: DropzoneProps) {
  const { language, t } = useLanguage();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error(
        language === 'en'
          ? 'Only PDF files are supported (.pdf)'
          : 'Hanya file PDF yang didukung (.pdf)'
      );
      return;
    }
    setSelectedFile(file);
    toast.success(
      language === 'en'
        ? `PDF "${file.name}" selected`
        : `File PDF "${file.name}" siap diproses`
    );
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || isUploading) return;
    await onUpload(selectedFile);
  };

  return (
    <div className="ui-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Unggah Dokumen PDF
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Setiap halaman diekstrak oleh Agent 1 (Google Gemini Flash-Lite Vision) & diindeks oleh Agent 2 (OpenAI)
          </p>
        </div>
        <span className="badge badge-accent" style={{ fontSize: '11px', padding: '3px 9px' }}>
          PDF Only
        </span>
      </div>

      {/* Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? 'var(--color-primary)' : 'var(--border-default)'}`,
          backgroundColor: isDragging ? 'var(--color-primary-subtle)' : 'var(--bg-app)',
          borderRadius: 'var(--radius-lg)',
          padding: '3rem 1.5rem',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          userSelect: 'none',
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="application/pdf"
          style={{ display: 'none' }}
        />

        {selectedFile ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-primary-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <FileText size={24} />
            </div>

            <div style={{ textAlign: 'left', maxWidth: '420px' }}>
              <div style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                {selectedFile.name}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · {language === 'en' ? 'Click to replace document' : 'Klik untuk mengganti dokumen'}
              </div>
            </div>

            <button
              onClick={handleClear}
              className="btn btn-ghost"
              style={{ padding: '8px', borderRadius: '50%' }}
              title={language === 'en' ? 'Cancel selection' : 'Batalkan pilihan'}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                boxShadow: 'var(--shadow-sm)',
                color: 'var(--color-primary)',
              }}
            >
              <UploadCloud size={28} strokeWidth={2} />
            </div>

            <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('upload.drop_title')}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {t('upload.drop_subtitle')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
              <span className="badge badge-neutral" style={{ fontSize: '11px' }}>{t('upload.badge_slides')}</span>
              <span className="badge badge-neutral" style={{ fontSize: '11px' }}>{t('upload.badge_scan')}</span>
              <span className="badge badge-neutral" style={{ fontSize: '11px' }}>{t('upload.badge_report')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {uploadError && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-danger-subtle)',
            border: '1px solid var(--color-danger-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--color-danger-text)',
            fontSize: '13.5px',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={handleSubmit}
        disabled={!selectedFile || isUploading}
        className="btn btn-primary btn-lg"
        style={{ width: '100%', padding: '12px 24px', fontSize: '14.5px' }}
      >
        {isUploading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>Memproses Ingestion AI Vision...</span>
          </>
        ) : (
          <>
            <UploadCloud size={18} />
            <span>Jalankan Ingestion Sekarang</span>
            <ArrowRight size={16} />
          </>
        )}
      </button>
    </div>
  );
}
