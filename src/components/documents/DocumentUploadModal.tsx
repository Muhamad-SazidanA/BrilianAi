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
        padding: '1rem',
      }}
      onClick={handleModalClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: 'min(90vh, 560px)',
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
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
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px 12px',
            borderBottom: '1px solid #F1F5F9',
          }}
        >
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 650, color: '#0F172A', letterSpacing: '-0.01em', margin: 0 }}>
              Unggah Dokumen
            </h3>
            <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', margin: 0 }}>
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
              padding: '5px',
              borderRadius: '6px',
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
            <X size={16} />
          </button>
        </div>

        {/* ── Body Content ── */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Result View */}
          {result ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '12px 0',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#DCFCE7',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={22} />
              </div>

              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 650, color: '#0F172A', margin: 0 }}>
                  Dokumen Berhasil Diproses
                </h4>
                <p style={{ fontSize: '12.5px', color: '#64748B', marginTop: '3px', margin: 0, wordBreak: 'break-all' }}>
                  {result.original_filename}
                </p>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '8px',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    backgroundColor: '#F1F5F9',
                    fontSize: '11.5px',
                    color: '#334155',
                    fontWeight: 550,
                  }}
                >
                  <span>{result.page_count} Halaman</span>
                  <span>•</span>
                  <span>{result.chunk_count} Chunks</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', width: '100%', maxWidth: '320px' }}>
                <Link
                  href={`/documents/${result.upload_batch_id}`}
                  onClick={handleModalClose}
                  style={{
                    flex: 1,
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 550,
                    textDecoration: 'none',
                    boxShadow: '0 1px 2px rgba(37, 99, 235, 0.15)',
                  }}
                >
                  <span>Buka di Studio</span>
                  <ArrowRight size={13} />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setSelectedFile(null);
                    setLiveProgress(null);
                  }}
                  style={{
                    height: '32px',
                    padding: '0 14px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#334155',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Unggah Lagi
                </button>
              </div>
            </div>
          ) : isUploading ? (
            /* Uploading Progress View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '10px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Loader2 size={16} className="animate-spin" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                      Memproses Dokumen...
                    </span>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#2563EB', fontFamily: 'monospace' }}>
                      {liveProgress?.progressPercent || Math.min(currentStepIndex * 25, 95)}%
                    </span>
                  </div>
                  <p style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {liveProgress?.message || 'Vision OCR Engine & pgvector embedding...'}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div
                style={{
                  width: '100%',
                  height: '5px',
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
                        padding: '5px 4px',
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
            /* Idle Input Form (Wide 2-Column Side-by-Side) */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(260px, 1fr) minmax(310px, 1.15fr)',
                gap: '16px',
                alignItems: 'start',
              }}
            >
              {/* ── Left Column: Upload Dropzone & Info ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `1.5px dashed ${isDragging ? '#2563EB' : selectedFile ? '#93C5FD' : '#CBD5E1'}`,
                    backgroundColor: isDragging ? '#EFF6FF' : selectedFile ? '#F0F7FF' : '#F8FAFC',
                    borderRadius: '10px',
                    padding: selectedFile ? '14px 12px' : '22px 14px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    userSelect: 'none',
                    minHeight: '125px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, textAlign: 'left' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            backgroundColor: '#EFF6FF',
                            color: '#2563EB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <FileText size={18} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '12.5px',
                              fontWeight: 600,
                              color: '#0F172A',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '180px',
                            }}
                            title={selectedFile.name}
                          >
                            {selectedFile.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Ganti file
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
                          padding: '4px',
                          borderRadius: '50%',
                          display: 'flex',
                          flexShrink: 0,
                        }}
                        title="Batalkan pilihan"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          color: '#2563EB',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 6px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        }}
                      >
                        <UploadCloud size={16} />
                      </div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', margin: 0 }}>
                        Tarik file PDF ke sini, atau <span style={{ color: '#2563EB' }}>pilih file</span>
                      </p>
                      <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', margin: 0 }}>
                        Format PDF hingga 50 MB
                      </p>
                    </div>
                  )}
                </div>

                {/* Capability Hint Card */}
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={11} color="#2563EB" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#334155' }}>
                      AI Vision OCR & pgvector
                    </span>
                  </div>
                  <p style={{ fontSize: '10px', color: '#64748B', margin: 0, lineHeight: 1.35 }}>
                    Ekstraksi presisi per halaman dengan representasi vektor 1024-dimensi untuk rujukan chat AI.
                  </p>
                </div>

                {/* Error Notice */}
                {uploadError && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FEE2E2',
                      color: '#DC2626',
                      fontSize: '11.5px',
                    }}
                  >
                    <AlertCircle size={13} style={{ flexShrink: 0 }} />
                    <span>{uploadError}</span>
                  </div>
                )}
              </div>

              {/* ── Right Column: Metadata & Access Controls ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Divisi & Klasifikasi */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                      Divisi Pemilik
                    </label>
                    <select
                      value={divisionId}
                      onChange={(e) => setDivisionId(e.target.value)}
                      style={{
                        width: '100%',
                        height: '30px',
                        padding: '0 8px',
                        fontSize: '11.5px',
                        color: '#0F172A',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
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
                          height: '28px',
                          padding: '0 8px',
                          fontSize: '11.5px',
                          color: '#0F172A',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          borderRadius: '5px',
                          marginTop: '4px',
                          outline: 'none',
                        }}
                      />
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                      Klasifikasi Akses
                    </label>
                    <select
                      value={classification}
                      onChange={(e) => setClassification(e.target.value as DocumentClassification)}
                      style={{
                        width: '100%',
                        height: '30px',
                        padding: '0 8px',
                        fontSize: '11.5px',
                        color: '#0F172A',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
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

                {/* Status & Versi */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                      Status Dokumen
                    </label>
                    <select
                      value={docStatus}
                      onChange={(e) => setDocStatus(e.target.value as DocumentStatus)}
                      style={{
                        width: '100%',
                        height: '30px',
                        padding: '0 8px',
                        fontSize: '11.5px',
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
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                      Versi
                    </label>
                    <input
                      type="text"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="1.0"
                      style={{
                        width: '100%',
                        height: '30px',
                        padding: '0 8px',
                        fontSize: '11.5px',
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
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                    Jadwal Tinjau Berkala
                  </label>
                  <input
                    type="date"
                    value={reviewDueDate}
                    onChange={(e) => setReviewDueDate(e.target.value)}
                    style={{
                      width: '100%',
                      height: '30px',
                      padding: '0 8px',
                      fontSize: '11.5px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* User Grants */}
                <div style={{ borderTop: '1px dashed #E2E8F0', paddingTop: '6px', marginTop: '2px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                    Beri Akses Khusus ke User
                  </label>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      style={{
                        flex: 1,
                        height: '28px',
                        padding: '0 6px',
                        fontSize: '11px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        outline: 'none',
                        minWidth: 0,
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
                        width: '74px',
                        height: '28px',
                        padding: '0 4px',
                        fontSize: '11px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        outline: 'none',
                        flexShrink: 0,
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
                        height: '28px',
                        padding: '0 8px',
                        backgroundColor: selectedUserId ? '#F1F5F9' : '#F8FAFC',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        cursor: selectedUserId ? 'pointer' : 'not-allowed',
                        color: selectedUserId ? '#0F172A' : '#94A3B8',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                      title="Tambah Akses User"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {userGrants.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px',
                        marginTop: '6px',
                        maxHeight: '52px',
                        overflowY: 'auto',
                      }}
                    >
                      {userGrants.map((grant) => (
                        <div
                          key={grant.userId}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '2px 7px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderRadius: '9999px',
                            fontSize: '10.5px',
                          }}
                        >
                          <span style={{ fontWeight: 600, color: '#0F172A' }}>{grant.userName}</span>
                          <span style={{ fontSize: '9.5px', padding: '0 4px', borderRadius: '4px', backgroundColor: '#F1F5F9', color: '#64748B' }}>
                            {grant.accessLevel}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveUserGrant(grant.userId)}
                            style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: 0, display: 'flex' }}
                            title="Hapus"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {!result && !isUploading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '8px',
              padding: '12px 20px',
              borderTop: '1px solid #F1F5F9',
              backgroundColor: '#FAFAFA',
            }}
          >
            <button
              type="button"
              onClick={handleModalClose}
              style={{
                height: '28px',
                padding: '0 14px',
                borderRadius: '9999px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#475569',
                fontSize: '11.5px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedFile}
              style={{
                height: '28px',
                padding: '0 14px',
                borderRadius: '9999px',
                border: '1px solid #1D4ED8',
                backgroundColor: selectedFile ? '#2563EB' : '#94A3B8',
                color: '#FFFFFF',
                fontSize: '11.5px',
                fontWeight: 550,
                cursor: selectedFile ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: selectedFile ? '0 1px 2px rgba(37, 99, 235, 0.15)' : 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (selectedFile) {
                  e.currentTarget.style.backgroundColor = '#1D4ED8';
                  e.currentTarget.style.transform = 'translateY(-0.5px)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedFile) {
                  e.currentTarget.style.backgroundColor = '#2563EB';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              <UploadCloud size={12} strokeWidth={2.2} />
              <span>Unggah Dokumen</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
