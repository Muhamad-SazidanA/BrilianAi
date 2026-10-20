'use client';

import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, X, AlertCircle, ArrowRight, Loader2, Shield, Calendar, GitBranch, Building2, Sliders, Users, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { DocumentClassification, DocumentStatus } from '@/types/document';
import { toast } from 'sonner';
import EnterpriseSelect from '@/components/ui/EnterpriseSelect';

export interface UserGrantSelection {
  userId: string;
  userName: string;
  userEmail: string;
  accessLevel: 'viewer' | 'editor';
}

export interface DocumentUploadMetadata {
  divisionId: string;
  classification: DocumentClassification;
  status: DocumentStatus;
  version: string;
  reviewDueDate: string;
  userGrants?: UserGrantSelection[];
}

interface DropzoneProps {
  onUpload: (file: File, metadata: DocumentUploadMetadata) => Promise<void>;
  isUploading: boolean;
  uploadError: string | null;
}

const DEFAULT_DIVISIONS = [
  'General',
  'Direksi',
  'Manajemen Eksekutif',
  'HRD',
  'Legal & Compliance',
  'Keuangan (Finance)',
  'Operasional',
  'IT & Engineering',
  'Marketing & Bisnis',
];

export default function Dropzone({ onUpload, isUploading, uploadError }: DropzoneProps) {
  const { language, t } = useLanguage();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Enterprise KMS Metadata States
  const [divisionId, setDivisionId] = useState<string>('General');
  const [customDivision, setCustomDivision] = useState<string>('');
  const [classification, setClassification] = useState<DocumentClassification>('Internal');
  const [docStatus, setDocStatus] = useState<DocumentStatus>('Menunggu Kurasi');
  const [version, setVersion] = useState<string>('1.0');

  // Default review date: 1 year from today (YYYY-MM-DD)
  const defaultNextYear = new Date();
  defaultNextYear.setFullYear(defaultNextYear.getFullYear() + 1);
  const [reviewDueDate, setReviewDueDate] = useState<string>(
    defaultNextYear.toISOString().split('T')[0]
  );

  // User Grants State
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; name: string; email: string; department: string }>>([]);
  const [userGrants, setUserGrants] = useState<UserGrantSelection[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<'viewer' | 'editor'>('viewer');
  const [isGrantsExpanded, setIsGrantsExpanded] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/users')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.users) {
          setAvailableUsers(data.users);
        }
      })
      .catch((err) => console.error('Error fetching users:', err));
  }, []);

  const handleAddUserGrant = () => {
    if (!selectedUserId) return;
    const user = availableUsers.find((u) => u.id === selectedUserId);
    if (!user) return;
    if (userGrants.some((g) => g.userId === selectedUserId)) {
      toast.error('Pengguna sudah ada dalam daftar akses khusus.');
      return;
    }
    setUserGrants((prev) => [
      ...prev,
      {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        accessLevel: selectedAccessLevel,
      },
    ]);
    setSelectedUserId('');
    setSelectedAccessLevel('viewer');
  };

  const handleRemoveUserGrant = (userId: string) => {
    setUserGrants((prev) => prev.filter((g) => g.userId !== userId));
  };

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
    const finalDivision = divisionId === 'custom' ? customDivision.trim() || 'General' : divisionId;
    await onUpload(selectedFile, {
      divisionId: finalDivision,
      classification,
      status: docStatus,
      version: version.trim() || '1.0',
      reviewDueDate,
      userGrants,
    });
  };

  return (
    <div className="ui-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Unggah Dokumen PDF & Tata Kelola Pengetahuan (KMS)
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Setiap halaman diekstrak oleh Vision OCR Engine, diindeks ke pgvector, dan diamankan dengan ABAC
          </p>
        </div>
        <span className="badge badge-accent" style={{ fontSize: '11px', padding: '3px 9px' }}>
          PDF Only · pgvector
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
          padding: '2.5rem 1.5rem',
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

      {/* Enterprise KMS Metadata Settings Panel */}
      <div
        style={{
          backgroundColor: 'var(--bg-app)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
          <Sliders size={16} color="var(--color-primary)" />
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Metadata Dokumen & Kontrol Akses (ABAC + Lifecycle)
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {/* Divisi / Departemen */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <Building2 size={13} />
              <span>Divisi Pemilik</span>
            </label>
            <EnterpriseSelect
              value={divisionId}
              onChange={(val) => setDivisionId(String(val))}
              options={[
                ...DEFAULT_DIVISIONS.map((d) => ({ value: d, label: d })),
                { value: 'custom', label: '+ Divisi Lainnya...' },
              ]}
              size="sm"
            />
            {divisionId === 'custom' && (
              <input
                type="text"
                placeholder="Nama divisi khusus..."
                value={customDivision}
                onChange={(e) => setCustomDivision(e.target.value)}
                className="input-text"
                style={{ width: '100%', marginTop: '6px', fontSize: '13px' }}
              />
            )}
          </div>

          {/* Klasifikasi Keamanan (ABAC) */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <Shield size={13} />
              <span>Klasifikasi Keamanan</span>
            </label>
            <EnterpriseSelect
              value={classification}
              onChange={(val) => setClassification(val as DocumentClassification)}
              options={[
                { value: 'Publik', label: 'Publik (Dapat diakses semua)' },
                { value: 'Internal', label: 'Internal (Karyawan perusahaan)' },
                { value: 'Rahasia', label: 'Rahasia (Divisi terkait & Manajerial)' },
                { value: 'Sangat Rahasia', label: 'Sangat Rahasia (Admin & Pemilik)' },
              ]}
              size="sm"
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {classification === 'Publik' && 'Terbuka untuk semua pengguna & tamu.'}
              {classification === 'Internal' && 'Standar dokumen operasional karyawan.'}
              {classification === 'Rahasia' && 'Hanya divisimu dan tim manajemen yang dapat melihat.'}
              {classification === 'Sangat Rahasia' && 'Enkripsi tinggi, hanya admin & pemilik.'}
            </div>
          </div>

          {/* Status Siklus Hidup Dokumen */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <GitBranch size={13} />
              <span>Status Siklus Hidup</span>
            </label>
            <EnterpriseSelect
              value={docStatus}
              onChange={(val) => setDocStatus(val as DocumentStatus)}
              options={[
                { value: 'Menunggu Kurasi', label: 'Menunggu Kurasi (Wajib kurasi sebelum aktif di AI)' },
                { value: 'Draft', label: 'Draft (Tersimpan di Studio, belum di RAG)' },
                { value: 'Review', label: 'Review (Menunggu validasi reviewer)' },
              ]}
              size="sm"
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Dokumen baru wajib melalui proses kurasi AI atau kurasi manual di Document Studio sebelum dapat diaktifkan ke Chatbot RAG.
            </div>
          </div>

          {/* Versi Dokumen & Review Due Date */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Versi
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0"
                className="input-text font-mono"
                style={{ width: '100%', fontSize: '13px' }}
              />
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <Calendar size={12} />
                <span>Jadwal Tinjau</span>
              </label>
              <input
                type="date"
                value={reviewDueDate}
                onChange={(e) => setReviewDueDate(e.target.value)}
                className="input-text"
                style={{ width: '100%', fontSize: '13px' }}
              />
            </div>
          </div>
        </div>

        {/* User Whitelist / Direct Grants Accordion */}
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={() => setIsGrantsExpanded(!isGrantsExpanded)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'none',
              border: 'none',
              padding: '6px 0',
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={15} style={{ color: 'var(--text-secondary)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                Beri Hak Akses Khusus ke Pengguna (Opsional)
              </span>
              {userGrants.length > 0 && (
                <span className="badge badge-accent font-mono" style={{ fontSize: '10.5px' }}>
                  {userGrants.length} Pengguna
                </span>
              )}
            </div>
            {isGrantsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {isGrantsExpanded && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                Pengguna yang dipilih akan dapat mengakses dokumen ini meskipun klasifikasi atau divisinya berbeda.
              </p>

              {/* Add Grant Controls */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 2, minWidth: '220px' }}>
                  <EnterpriseSelect
                    value={selectedUserId}
                    onChange={(val) => setSelectedUserId(String(val))}
                    options={availableUsers
                      .filter((u) => !userGrants.some((g) => g.userId === u.id))
                      .map((u) => ({
                        value: u.id,
                        label: `${u.name} (${u.email})`,
                        sublabel: u.department || 'General',
                      }))}
                    placeholder="-- Pilih Pengguna --"
                    searchable={true}
                    searchPlaceholder="Cari pengguna..."
                    size="sm"
                  />
                </div>

                <div style={{ flex: 1, minWidth: '130px' }}>
                  <EnterpriseSelect
                    value={selectedAccessLevel}
                    onChange={(val) => setSelectedAccessLevel(val as 'viewer' | 'editor')}
                    options={[
                      { value: 'viewer', label: 'Viewer (Baca)' },
                      { value: 'editor', label: 'Editor (Penuh)' },
                    ]}
                    size="sm"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddUserGrant}
                  disabled={!selectedUserId}
                  className="btn btn-outline btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Plus size={14} />
                  <span>Tambah</span>
                </button>
              </div>

              {/* Added User List */}
              {userGrants.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  {userGrants.map((grant) => (
                    <div
                      key={grant.userId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12.5px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{grant.userName}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({grant.userEmail})</span>
                        <span
                          className={`badge ${grant.accessLevel === 'editor' ? 'badge-accent' : 'badge-neutral'}`}
                          style={{ fontSize: '10px' }}
                        >
                          {grant.accessLevel === 'editor' ? 'Editor' : 'Viewer'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveUserGrant(grant.userId)}
                        className="btn btn-ghost-danger btn-xs"
                        style={{ padding: '2px 6px' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
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
            <span>Jalankan Ingestion & Indeks ke KMS</span>
            <ArrowRight size={16} />
          </>
        )}
      </button>
    </div>
  );
}

