'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  Shield,
  Calendar,
  GitBranch,
  Users,
  Plus,
  Trash2,
  ArrowRight,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useUserSession } from '@/context/UserSessionContext';
import { DocumentClassification, DocumentStatus } from '@/types/document';
import { toast } from 'sonner';
import EnterpriseSelect from '@/components/ui/EnterpriseSelect';
import { useIngestion } from '@/context/IngestionContext';
import { ENTERPRISE_DIVISIONS } from '@lib/constants/divisions';

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

export default function DocumentUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: DocumentUploadModalProps) {
  const { language } = useLanguage();
  const { currentUser } = useUserSession();
  const { enqueueFiles, setIsDockMinimized } = useIngestion();

  // Multi-file selection state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Core Metadata Settings (Clean Defaults)
  const [divisionId, setDivisionId] = useState<string>('General');
  const [customDivision, setCustomDivision] = useState<string>('');
  const [classification, setClassification] = useState<DocumentClassification>('Internal');

  // Advanced Settings
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

  // Dynamic divisions: master enterprise divisions + actual user departments (no dummy data)
  const divisionOptions = useMemo(() => {
    const set = new Set<string>(ENTERPRISE_DIVISIONS);
    availableUsers.forEach((u) => {
      const d = (u.department || '').trim();
      if (d && d.toLowerCase() !== 'google account') {
        set.add(d);
      }
    });
    return [
      ...Array.from(set).map((d) => ({ value: d, label: d })),
      { value: 'custom', label: '+ Divisi Lainnya...' },
    ];
  }, [availableUsers]);

  // Auto-populate default division from current user's actual department
  useEffect(() => {
    if (isOpen && currentUser) {
      const userDept =
        currentUser.department && currentUser.department.toLowerCase() !== 'google account'
          ? currentUser.department
          : 'General';
      setDivisionId(userDept);
    }
  }, [isOpen, currentUser]);

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
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        handleModalClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting]);

  const handleModalClose = () => {
    if (isSubmitting) return;
    setSelectedFiles([]);
    setUploadError(null);
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
      appendFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      appendFiles(Array.from(e.target.files));
    }
    // reset input value so re-selecting same file works
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const appendFiles = (files: File[]) => {
    const validPdfs: File[] = [];
    let invalidCount = 0;
    let oversizeCount = 0;

    for (const file of files) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        invalidCount++;
        continue;
      }
      if (file.size > 50 * 1024 * 1024) {
        oversizeCount++;
        continue;
      }
      // Check if already in selectedFiles by name and size
      const exists = selectedFiles.some((f) => f.name === file.name && f.size === file.size);
      if (!exists) {
        validPdfs.push(file);
      }
    }

    if (invalidCount > 0) {
      toast.warning(
        language === 'en'
          ? `${invalidCount} file(s) ignored: only PDF format is supported (.pdf).`
          : `${invalidCount} file diabaikan: hanya format PDF yang didukung (.pdf).`
      );
    }
    if (oversizeCount > 0) {
      toast.error(
        language === 'en'
          ? `${oversizeCount} file(s) exceed maximum limit 50 MB.`
          : `${oversizeCount} file melebihi batas maksimal 50 MB.`
      );
    }

    if (validPdfs.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validPdfs]);
      setUploadError(null);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
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
    if (selectedFiles.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setUploadError(null);

    const finalDivision = divisionId === 'custom' ? customDivision.trim() || 'General' : divisionId;

    try {
      // Enqueue all files into the persistent background ingestion queue
      await enqueueFiles(selectedFiles, {
        ownerId: currentUser?.id,
        divisionId: finalDivision,
        classification,
        status: docStatus,
        version: version.trim() || '1.0',
        reviewDueDate,
        userGrants: userGrants.length > 0 ? userGrants : undefined,
      });

      // Expand floating dock so the user sees progress immediately
      setIsDockMinimized(false);

      toast.success(
        language === 'en'
          ? `${selectedFiles.length} document(s) queued for background vector ingestion!`
          : `${selectedFiles.length} dokumen telah masuk antrian pemrosesan vektor di latar belakang!`
      );

      setSelectedFiles([]);
      onSuccess();
      onClose();
    } catch (err: any) {
      const errMsg = err.message || 'Terjadi kesalahan saat memproses antrian dokumen.';
      setUploadError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(5px)',
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
          maxHeight: 'min(92vh, 600px)',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
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
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UploadCloud size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 650, color: '#0F172A', letterSpacing: '-0.01em', margin: 0 }}>
                {language === 'en' ? 'Upload Documents (Multi-PDF)' : 'Unggah Dokumen (Multi-PDF)'}
              </h3>
              <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', margin: 0 }}>
                {language === 'en'
                  ? 'Queue multiple PDFs for background OCR extraction & pgvector indexing'
                  : 'Ingest banyak file PDF sekaligus ke basis pengetahuan & pgvector'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleModalClose}
            disabled={isSubmitting}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              borderRadius: '8px',
              color: '#94A3B8',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#E2E8F0')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body Content (Wide 2-Column Side-by-Side) ── */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(270px, 1.05fr) minmax(310px, 1.15fr)',
              gap: '16px',
              alignItems: 'start',
            }}
          >
            {/* ── Left Column: Multi-PDF Dropzone & Selected Files List ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `1.5px dashed ${isDragging ? '#2563EB' : selectedFiles.length > 0 ? '#93C5FD' : '#CBD5E1'}`,
                  backgroundColor: isDragging ? '#EFF6FF' : selectedFiles.length > 0 ? '#F0F7FF' : '#F8FAFC',
                  borderRadius: '12px',
                  padding: selectedFiles.length > 0 ? '12px 14px' : '22px 14px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                  minHeight: selectedFiles.length > 0 ? 'auto' : '120px',
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
                  multiple
                  style={{ display: 'none' }}
                />

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
                  {language === 'en'
                    ? 'Drop PDF files here, or'
                    : 'Tarik file PDF ke sini, atau'}{' '}
                  <span style={{ color: '#2563EB' }}>
                    {language === 'en' ? 'browse files' : 'pilih dokumen'}
                  </span>
                </p>
                <p style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '3px', margin: 0 }}>
                  {language === 'en'
                    ? 'Supports multiple PDFs simultaneously (up to 50 MB / file)'
                    : 'Bisa pilih banyak PDF sekaligus (maks. 50 MB / file)'}
                </p>
              </div>

              {/* Selected Files Preview List */}
              {selectedFiles.length > 0 && (
                <div
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    backgroundColor: '#FFFFFF',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#F8FAFC',
                      borderBottom: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                    }}
                  >
                    <span style={{ fontWeight: 650, color: '#334155' }}>
                      {selectedFiles.length} Dokumen Terpilih ({formatFileSize(totalBytes)})
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563EB',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <Plus size={11} />
                      <span>Tambah Lagi</span>
                    </button>
                  </div>

                  <div style={{ maxHeight: '140px', overflowY: 'auto', padding: '4px 6px' }}>
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          gap: '8px',
                          borderBottom: idx < selectedFiles.length - 1 ? '1px solid #F1F5F9' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <FileText size={14} color="#2563EB" style={{ flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <p
                              style={{
                                fontSize: '11.5px',
                                fontWeight: 550,
                                color: '#0F172A',
                                margin: 0,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '170px',
                              }}
                              title={file.name}
                            >
                              {file.name}
                            </p>
                            <span style={{ fontSize: '10px', color: '#94A3B8', fontFamily: 'monospace' }}>
                              {formatFileSize(file.size)}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94A3B8',
                            cursor: 'pointer',
                            padding: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
                          title="Hapus dari antrian"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Capability Notice Card */}
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
                  <Sparkles size={11} color="#2563EB" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#334155' }}>
                    {language === 'en'
                      ? 'Persistent Background Vector Ingestion'
                      : 'Pemrosesan Latar Belakang & pgvector'}
                  </span>
                </div>
                <p style={{ fontSize: '10px', color: '#64748B', margin: 0, lineHeight: 1.35 }}>
                  {language === 'en'
                    ? 'Uploads continue uninterrupted even if you change pages, refresh browser, or minimize modal.'
                    : 'Proses tetap berjalan aman meski berpindah halaman, di-refresh, atau modal ditutup.'}
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

            {/* ── Right Column: Batch Metadata & Access Controls ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Uploader / Owner Identity Info */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  fontSize: '11px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <Building2 size={12} color="#2563EB" style={{ flexShrink: 0 }} />
                  <span style={{ color: '#475569' }}>Pemilik:</span>
                  <strong style={{ color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentUser?.name || 'User'}
                  </strong>
                  <span style={{ color: '#64748B', whiteSpace: 'nowrap' }}>
                    ({currentUser?.department || 'General'})
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    border: '1px solid #BFDBFE',
                    flexShrink: 0,
                  }}
                >
                  {currentUser?.role?.name || 'Member'}
                </span>
              </div>

              {/* Divisi & Klasifikasi */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                    Divisi Pemilik
                  </label>
                  <EnterpriseSelect
                    value={divisionId}
                    onChange={(val) => setDivisionId(String(val))}
                    options={divisionOptions}
                    size="sm"
                  />
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
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', margin: 0 }}>
                      Klasifikasi Akses
                    </label>
                    {currentUser && currentUser.role_id !== 'admin' && currentUser.role?.allowed_classifications && (
                      <span
                        style={{
                          fontSize: '9.5px',
                          fontWeight: 600,
                          color: currentUser.role.allowed_classifications.includes(classification) ? '#16a34a' : '#d97706',
                        }}
                      >
                        {currentUser.role.allowed_classifications.includes(classification) ? '✓ Clearance OK' : '⚠ Perlu Clearance'}
                      </span>
                    )}
                  </div>
                  <EnterpriseSelect
                    value={classification}
                    onChange={(val) => setClassification(val as DocumentClassification)}
                    options={[
                      { value: 'Publik', label: 'Publik' },
                      { value: 'Internal', label: 'Internal (Karyawan)' },
                      { value: 'Rahasia', label: 'Rahasia (Divisi)' },
                      { value: 'Sangat Rahasia', label: 'Sangat Rahasia' },
                    ]}
                    size="sm"
                  />
                </div>
              </div>

              {/* Status & Versi */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                    Status Dokumen
                  </label>
                  <EnterpriseSelect
                    value={docStatus}
                    onChange={(val) => setDocStatus(val as DocumentStatus)}
                    options={[
                      { value: 'Aktif', label: 'Aktif (Masuk RAG)' },
                      { value: 'Draft', label: 'Draft' },
                      { value: 'Review', label: 'Review' },
                    ]}
                    size="sm"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                    Versi Batch
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
                      boxSizing: 'border-box',
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
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* User Grants */}
              <div style={{ borderTop: '1px dashed #E2E8F0', paddingTop: '6px', marginTop: '2px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                  Beri Akses Khusus ke User
                </label>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <EnterpriseSelect
                      value={selectedUserId}
                      onChange={(val) => setSelectedUserId(String(val))}
                      options={availableUsers.map((u) => ({
                        value: u.id,
                        label: u.name,
                        sublabel: `${u.department || 'General'} · ${u.email}`,
                      }))}
                      placeholder="Pilih pengguna..."
                      searchable={true}
                      searchPlaceholder="Cari nama / email..."
                      size="xs"
                      direction="up"
                      menuWidth="240px"
                    />
                  </div>

                  <div style={{ width: '80px', flexShrink: 0 }}>
                    <EnterpriseSelect
                      value={selectedAccessLevel}
                      onChange={(val) => setSelectedAccessLevel(val as 'viewer' | 'editor')}
                      options={[
                        { value: 'viewer', label: 'Viewer' },
                        { value: 'editor', label: 'Editor' },
                      ]}
                      size="xs"
                      direction="up"
                      width="80px"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddUserGrant}
                    disabled={!selectedUserId}
                    style={{
                      height: '24px',
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
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderTop: '1px solid #F1F5F9',
            backgroundColor: '#FAFAFA',
          }}
        >
          <div style={{ fontSize: '11px', color: '#64748B' }}>
            {selectedFiles.length > 0
              ? `${selectedFiles.length} file PDF siap diproses ke pgvector`
              : 'Pilih satu atau lebih dokumen untuk memulai'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleModalClose}
              disabled={isSubmitting}
              style={{
                height: '30px',
                padding: '0 14px',
                borderRadius: '9999px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#475569',
                fontSize: '11.5px',
                fontWeight: 500,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
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
              disabled={selectedFiles.length === 0 || isSubmitting}
              style={{
                height: '30px',
                padding: '0 16px',
                borderRadius: '9999px',
                border: '1px solid #1D4ED8',
                backgroundColor: selectedFiles.length > 0 && !isSubmitting ? '#2563EB' : '#94A3B8',
                color: '#FFFFFF',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: selectedFiles.length > 0 && !isSubmitting ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: selectedFiles.length > 0 ? '0 1px 3px rgba(37, 99, 235, 0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Memasukkan ke Antrian...</span>
                </>
              ) : (
                <>
                  <UploadCloud size={13} strokeWidth={2.2} />
                  <span>
                    {selectedFiles.length > 0
                      ? `Mulai Ingestion (${selectedFiles.length} Dokumen)`
                      : 'Mulai Ingestion'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
