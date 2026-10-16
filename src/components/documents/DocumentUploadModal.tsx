'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Building2,
  Shield,
  Calendar,
  GitBranch,
  Users,
  Plus,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { DocumentClassification, DocumentStatus, IngestionResult } from '@/types/document';
import { toast } from 'sonner';

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

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
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

export default function DocumentUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: DocumentUploadModalProps) {
  const { language } = useLanguage();

  // File & Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Progressive Live Status State
  const [liveProgress, setLiveProgress] = useState<{
    status?: string;
    message?: string;
    totalChunks?: number;
    processedChunks?: number;
    progressPercent?: number;
    totalPages?: number;
    currentPage?: number;
  } | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const clientIdRef = useRef<string | null>(null);
  const progressPollRef = useRef<NodeJS.Timeout | null>(null);

  // Core Metadata Settings (Clean Defaults)
  const [divisionId, setDivisionId] = useState<string>('General');
  const [customDivision, setCustomDivision] = useState<string>('');
  const [classification, setClassification] = useState<DocumentClassification>('Internal');

  // Advanced Settings (Collapsible)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [docStatus, setDocStatus] = useState<DocumentStatus>('Aktif');
  const [version, setVersion] = useState<string>('1.0');
  const defaultNextYear = new Date();
  defaultNextYear.setFullYear(defaultNextYear.getFullYear() + 1);
  const [reviewDueDate, setReviewDueDate] = useState<string>(
    defaultNextYear.toISOString().split('T')[0]
  );

  // User Grants State
  const [availableUsers, setAvailableUsers] = useState<
    Array<{ id: string; name: string; email: string; department: string }>
  >([]);
  const [userGrants, setUserGrants] = useState<UserGrantSelection[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<'viewer' | 'editor'>('viewer');

  // Fetch users for grant selection
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/users')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.users) {
          setAvailableUsers(data.users);
        }
      })
      .catch((err) => console.error('Error fetching users:', err));
  }, [isOpen]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isUploading) {
        handleModalClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isUploading]);

  const stopPolling = () => {
    if (progressPollRef.current) {
      clearInterval(progressPollRef.current);
      progressPollRef.current = null;
    }
  };

  const fetchUploadProgress = async () => {
    if (!clientIdRef.current) return;
    try {
      const res = await fetch(`/api/documents/upload?clientId=${clientIdRef.current}`);
      if (!res.ok) return;
      const data = await res.json();
      setLiveProgress(data);

      if (data.status === 'completed' || data.progressPercent >= 100) {
        stopPolling();
      }
    } catch {
      // Quiet fallback
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const handleModalClose = () => {
    if (isUploading) return;
    stopPolling();
    setSelectedFile(null);
    setUploadError(null);
    setResult(null);
    setLiveProgress(null);
    setCurrentStepIndex(0);
    setShowAdvanced(false);
    onClose();
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
      toast.error('Hanya file PDF yang didukung (.pdf)');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Ukuran file melebihi batas maksimal 50 MB');
      return;
    }
    setSelectedFile(file);
    setUploadError(null);
  };

  const handleAddUserGrant = () => {
    if (!selectedUserId) return;
    const user = availableUsers.find((u) => u.id === selectedUserId);
    if (!user) return;
    if (userGrants.some((g) => g.userId === selectedUserId)) {
      toast.error('Pengguna sudah ada dalam daftar akses.');
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

  const handleSubmit = async () => {
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setUploadError(null);
    setResult(null);
    setLiveProgress({
      status: 'starting',
      message: 'Mempersiapkan dokumen...',
      progressPercent: 10,
    });
    setCurrentStepIndex(1);
    clientIdRef.current = `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const finalDivision = divisionId === 'custom' ? customDivision.trim() || 'General' : divisionId;

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('clientId', clientIdRef.current || '');
      formData.append('divisionId', finalDivision);
      formData.append('classification', classification);
      formData.append('status', docStatus);
      formData.append('version', version.trim() || '1.0');
      formData.append('reviewDueDate', reviewDueDate);
      if (userGrants.length > 0) {
        formData.append('userGrants', JSON.stringify(userGrants));
      }

      progressPollRef.current = setInterval(fetchUploadProgress, 800);

      const t1 = setTimeout(() => setCurrentStepIndex(2), 2500);
      const t2 = setTimeout(() => setCurrentStepIndex(3), 6000);
      const t3 = setTimeout(() => setCurrentStepIndex(4), 9500);

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses dokumen');
      }

      stopPolling();
      setLiveProgress({
        status: 'completed',
        message: 'Ingestion selesai dengan sukses!',
        progressPercent: 100,
        totalChunks: data.chunk_count,
        processedChunks: data.chunk_count,
      });
      setCurrentStepIndex(4);
      setResult(data);
      onSuccess();
      toast.success(`Dokumen "${selectedFile.name}" berhasil diproses!`);
    } catch (err: any) {
      stopPolling();
      const errMsg = err.message || 'Terjadi kesalahan saat memproses file';
      setUploadError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1.25rem',
      }}
      onClick={handleModalClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '500px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          border: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '20px 24px 16px',
            borderBottom: '1px solid #F1F5F9',
          }}
        >
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>
              Unggah Dokumen
            </h3>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
              Tambahkan file PDF ke Basis Pengetahuan (Knowledge Base)
            </p>
          </div>

          <button
            type="button"
            onClick={handleModalClose}
            disabled={isUploading}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              borderRadius: '8px',
              color: '#94A3B8',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body Content ── */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Result View */}
          {result ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '16px 0',
                gap: '14px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#DCFCE7',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={26} />
              </div>

              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                  Dokumen Berhasil Diproses
                </h4>
                <p style={{ fontSize: '13px', color: '#64748B', marginTop: '3px', wordBreak: 'break-all' }}>
                  {result.original_filename}
                </p>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '8px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    backgroundColor: '#F1F5F9',
                    fontSize: '12px',
                    color: '#334155',
                    fontWeight: 600,
                  }}
                >
                  <span>{result.page_count} Halaman</span>
                  <span>•</span>
                  <span>{result.chunk_count} Chunks</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px', width: '100%' }}>
                <Link
                  href={`/documents/${result.upload_batch_id}`}
                  onClick={handleModalClose}
                  style={{
                    flex: 1,
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <span>Buka di Studio</span>
                  <ArrowRight size={14} />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setSelectedFile(null);
                    setLiveProgress(null);
                  }}
                  style={{
                    height: '40px',
                    padding: '0 16px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    color: '#334155',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Unggah Lagi
                </button>
              </div>
            </div>
          ) : isUploading ? (
            /* Uploading Progress View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Loader2 size={18} className="animate-spin" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#0F172A' }}>
                      Memproses Dokumen...
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563EB', fontFamily: 'monospace' }}>
                      {liveProgress?.progressPercent || Math.min(currentStepIndex * 25, 95)}%
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    {liveProgress?.message || 'Vision OCR Engine & pgvector embedding...'}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  backgroundColor: '#E2E8F0',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    backgroundColor: '#2563EB',
                    borderRadius: '3px',
                    width: `${liveProgress?.progressPercent || Math.min(currentStepIndex * 25, 95)}%`,
                    transition: 'width 0.4s ease-out',
                  }}
                />
              </div>

              {/* Steps */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center' }}>
                {[
                  { id: 1, label: 'Render' },
                  { id: 2, label: 'Vision OCR' },
                  { id: 3, label: 'Chunking' },
                  { id: 4, label: 'Embedding' },
                ].map((s) => {
                  const isDone = currentStepIndex > s.id;
                  const isCurrent = currentStepIndex === s.id;
                  return (
                    <div
                      key={s.id}
                      style={{
                        padding: '6px 4px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: isCurrent || isDone ? 600 : 500,
                        backgroundColor: isDone ? '#DCFCE7' : isCurrent ? '#EFF6FF' : '#F8FAFC',
                        color: isDone ? '#16A34A' : isCurrent ? '#2563EB' : '#94A3B8',
                        border: `1px solid ${isCurrent ? '#93C5FD' : 'transparent'}`,
                      }}
                    >
                      {s.label}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Idle Input Form */
            <>
              {/* Drop Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `1.5px dashed ${isDragging ? '#2563EB' : '#CBD5E1'}`,
                  backgroundColor: isDragging ? '#EFF6FF' : '#F8FAFC',
                  borderRadius: '12px',
                  padding: selectedFile ? '14px 16px' : '20px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          backgroundColor: '#EFF6FF',
                          color: '#2563EB',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <FileText size={20} />
                      </div>
                      <div style={{ textAlign: 'left', minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '13.5px',
                            fontWeight: 600,
                            color: '#0F172A',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {selectedFile.name}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Klik untuk mengganti
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '50%',
                        display: 'flex',
                      }}
                      title="Batalkan pilihan"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        color: '#2563EB',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 8px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      }}
                    >
                      <UploadCloud size={18} />
                    </div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                      Tarik file PDF ke sini, atau <span style={{ color: '#2563EB' }}>pilih file</span>
                    </p>
                    <p style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '3px' }}>
                      Format PDF hingga 50 MB
                    </p>
                  </div>
                )}
              </div>

              {/* Error Notice */}
              {uploadError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FEE2E2',
                    color: '#DC2626',
                    fontSize: '12px',
                  }}
                >
                  <AlertCircle size={14} />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Core 2-Column Selects */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#475569',
                      marginBottom: '6px',
                    }}
                  >
                    Divisi Pemilik
                  </label>
                  <select
                    value={divisionId}
                    onChange={(e) => setDivisionId(e.target.value)}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 10px',
                      fontSize: '13px',
                      color: '#0F172A',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      outline: 'none',
                    }}
                  >
                    {DEFAULT_DIVISIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                    <option value="custom">+ Divisi Lainnya...</option>
                  </select>
                  {divisionId === 'custom' && (
                    <input
                      type="text"
                      placeholder="Nama divisi..."
                      value={customDivision}
                      onChange={(e) => setCustomDivision(e.target.value)}
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 10px',
                        fontSize: '12.5px',
                        color: '#0F172A',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        marginTop: '6px',
                        outline: 'none',
                      }}
                    />
                  )}
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#475569',
                      marginBottom: '6px',
                    }}
                  >
                    Klasifikasi Akses
                  </label>
                  <select
                    value={classification}
                    onChange={(e) => setClassification(e.target.value as DocumentClassification)}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 10px',
                      fontSize: '13px',
                      color: '#0F172A',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      outline: 'none',
                    }}
                  >
                    <option value="Publik">Publik</option>
                    <option value="Internal">Internal (Karyawan)</option>
                    <option value="Rahasia">Rahasia (Divisi)</option>
                    <option value="Sangat Rahasia">Sangat Rahasia</option>
                  </select>
                </div>
              </div>

              {/* Advanced Options Accordion */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'none',
                    border: 'none',
                    padding: '4px 0',
                    cursor: 'pointer',
                    color: '#64748B',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  <span>Opsi Lanjutan (Status, Versi, Hak Akses Khusus)</span>
                  {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>

                {showAdvanced && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '14px',
                      borderRadius: '10px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {/* Status & Versi */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                          Status Dokumen
                        </label>
                        <select
                          value={docStatus}
                          onChange={(e) => setDocStatus(e.target.value as DocumentStatus)}
                          style={{
                            width: '100%',
                            height: '34px',
                            padding: '0 8px',
                            fontSize: '12px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            outline: 'none',
                          }}
                        >
                          <option value="Aktif">Aktif (Masuk RAG)</option>
                          <option value="Draft">Draft</option>
                          <option value="Review">Review</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                          Versi
                        </label>
                        <input
                          type="text"
                          value={version}
                          onChange={(e) => setVersion(e.target.value)}
                          placeholder="1.0"
                          style={{
                            width: '100%',
                            height: '34px',
                            padding: '0 8px',
                            fontSize: '12px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            fontFamily: 'monospace',
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>

                    {/* Review Date */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                        Jadwal Tinjau Berkala
                      </label>
                      <input
                        type="date"
                        value={reviewDueDate}
                        onChange={(e) => setReviewDueDate(e.target.value)}
                        style={{
                          width: '100%',
                          height: '34px',
                          padding: '0 8px',
                          fontSize: '12px',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          borderRadius: '6px',
                          outline: 'none',
                        }}
                      />
                    </div>

                    {/* User Grants */}
                    <div style={{ borderTop: '1px dashed #E2E8F0', paddingTop: '10px' }}>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                        Beri Akses Khusus ke User
                      </label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <select
                          value={selectedUserId}
                          onChange={(e) => setSelectedUserId(e.target.value)}
                          style={{
                            flex: 1,
                            height: '32px',
                            padding: '0 8px',
                            fontSize: '11.5px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            outline: 'none',
                          }}
                        >
                          <option value="">Pilih pengguna...</option>
                          {availableUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.department || 'General'})
                            </option>
                          ))}
                        </select>

                        <select
                          value={selectedAccessLevel}
                          onChange={(e) => setSelectedAccessLevel(e.target.value as 'viewer' | 'editor')}
                          style={{
                            width: '84px',
                            height: '32px',
                            padding: '0 6px',
                            fontSize: '11.5px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            outline: 'none',
                          }}
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>

                        <button
                          type="button"
                          onClick={handleAddUserGrant}
                          disabled={!selectedUserId}
                          style={{
                            height: '32px',
                            padding: '0 10px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            cursor: selectedUserId ? 'pointer' : 'not-allowed',
                            color: '#334155',
                          }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      {userGrants.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                          {userGrants.map((grant) => (
                            <div
                              key={grant.userId}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '4px 8px',
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #E2E8F0',
                                borderRadius: '4px',
                                fontSize: '11px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 600, color: '#0F172A' }}>{grant.userName}</span>
                                <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#F1F5F9', color: '#64748B' }}>
                                  {grant.accessLevel}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveUserGrant(grant.userId)}
                                style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: '2px' }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        {!result && !isUploading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              padding: '14px 24px 20px',
            }}
          >
            <button
              type="button"
              onClick={handleModalClose}
              style={{
                height: '38px',
                padding: '0 16px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedFile}
              style={{
                height: '38px',
                padding: '0 18px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: selectedFile ? '#2563EB' : '#94A3B8',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: selectedFile ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: selectedFile ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none',
                transition: 'background 0.15s ease',
              }}
            >
              <UploadCloud size={15} />
              <span>Unggah Dokumen</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
