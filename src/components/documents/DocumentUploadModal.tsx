'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { X, CheckCircle2, ArrowRight, ExternalLink } from 'lucide-react';
import Dropzone, { DocumentUploadMetadata } from '@/components/upload/Dropzone';
import PipelineStepper from '@/components/upload/PipelineStepper';
import { PipelineStep, IngestionResult } from '@/types/document';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const INITIAL_STEPS: PipelineStep[] = [
  {
    number: '1',
    title: 'In-Memory Render',
    description: 'PDF diekstrak & dirender tanpa simpan ke disk',
    status: 'idle',
  },
  {
    number: '2',
    title: 'Vision Ingestion Engine',
    description: 'Vision OCR Engine mengekstrak teks & tabel presisi tinggi',
    status: 'idle',
  },
  {
    number: '3',
    title: 'Sliding Window',
    description: 'Chunking 800 char dengan overlap 150',
    status: 'idle',
  },
  {
    number: '4',
    title: 'Dense Vector Embedding',
    description: 'Vektor dense embedding 1024-dimensi disimpan ke pgvector',
    status: 'idle',
  },
];

export default function DocumentUploadModal({ isOpen, onClose, onSuccess }: DocumentUploadModalProps) {
  const { language } = useLanguage();
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [isUploading, setIsUploading] = useState(false);
  const [currentStepMessage, setCurrentStepMessage] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [liveProgress, setLiveProgress] = useState<{
    status?: string;
    message?: string;
    totalChunks?: number;
    processedChunks?: number;
    progressPercent?: number;
    totalPages?: number;
    currentPage?: number;
  } | null>(null);

  const clientIdRef = useRef<string | null>(null);
  const progressPollRef = useRef<NodeJS.Timeout | null>(null);

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

      if (data.message) {
        setCurrentStepMessage(data.message);
      }

      if (data.status === 'completed' || data.progressPercent >= 100) {
        stopPolling();
      }
    } catch {
      // quiet fallback
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const handleUpload = async (file: File, metadata?: DocumentUploadMetadata) => {
    setIsUploading(true);
    setUploadError(null);
    setResult(null);
    setLiveProgress(null);
    clientIdRef.current = `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    toast.info(
      language === 'en'
        ? `Uploading and analyzing "${file.name}"...`
        : `Mengunggah & menganalisis "${file.name}"...`
    );

    setSteps((prev) =>
      prev.map((s, idx) => ({
        ...s,
        status: idx === 0 ? 'running' : 'idle',
      }))
    );
    setCurrentStepMessage('Memeriksa halaman PDF via streaming engine...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clientId', clientIdRef.current || '');
      if (metadata) {
        if (metadata.divisionId) formData.append('divisionId', metadata.divisionId);
        if (metadata.classification) formData.append('classification', metadata.classification);
        if (metadata.status) formData.append('status', metadata.status);
        if (metadata.version) formData.append('version', metadata.version);
        if (metadata.reviewDueDate) formData.append('reviewDueDate', metadata.reviewDueDate);
        if (metadata.userGrants && metadata.userGrants.length > 0) {
          formData.append('userGrants', JSON.stringify(metadata.userGrants));
        }
      }

      progressPollRef.current = setInterval(fetchUploadProgress, 900);

      const timer1 = setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, idx) => ({
            ...s,
            status: idx === 0 ? 'done' : idx === 1 ? 'running' : 'idle',
          }))
        );
        setCurrentStepMessage('Vision OCR Engine mengekstrak teks tiap halaman...');
      }, 3500);

      const timer2 = setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, idx) => ({
            ...s,
            status: idx <= 1 ? 'done' : idx === 2 ? 'running' : 'idle',
          }))
        );
        setCurrentStepMessage('Memotong teks menjadi chunk sliding-window...');
      }, 7500);

      const timer3 = setTimeout(() => {
        setSteps((prev) =>
          prev.map((s, idx) => ({
            ...s,
            status: idx <= 2 ? 'done' : idx === 3 ? 'running' : 'idle',
          }))
        );
        setCurrentStepMessage('Dense Vector Embedding menyimpan vektor ke pgvector...');
      }, 11000);

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses dokumen');
      }

      stopPolling();
      setLiveProgress({
        status: 'completed',
        message: 'Ingestion selesai dengan sukses!',
        totalChunks: data.chunk_count,
        processedChunks: data.chunk_count,
        progressPercent: 100,
      });
      setCurrentStepMessage(`Selesai: ${data.page_count} halaman, ${data.chunk_count} chunks berhasil dibuat.`);

      setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));
      setResult(data);

      toast.success(
        language === 'en'
          ? `Document "${file.name}" ingested successfully!`
          : `Dokumen "${file.name}" berhasil diindeks ke Knowledge Base!`
      );

      // Refresh documents list in background
      onSuccess();
    } catch (err: any) {
      stopPolling();
      const message = err.message || 'Terjadi kesalahan sistem';
      setUploadError(message);
      toast.error(message);
      setSteps((prev) =>
        prev.map((s) => (s.status === 'running' ? { ...s, status: 'error' } : s))
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSteps(INITIAL_STEPS);
    setIsUploading(false);
    setCurrentStepMessage('');
    setUploadError(null);
    setResult(null);
    setLiveProgress(null);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        overflowY: 'auto',
      }}
    >
      <div
        className="ui-card"
        style={{
          width: '100%',
          maxWidth: '760px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.75rem',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Unggah Dokumen PDF & Indeks ke Knowledge Base
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Ekstraksi Vision OCR Engine, pembagian sliding-window, dense embedding, dan pengamanan ABAC
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ borderRadius: '50%', padding: '6px' }}
            title="Tutup Modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        {result ? (
          /* Completion State */
          <div
            style={{
              padding: '2rem 1.5rem',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-success-subtle)',
                color: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Ingestion Selesai dengan Sukses!
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto' }}>
                Dokumen <strong>{result.original_filename}</strong> berhasil diekstrak sebanyak {result.page_count} halaman dan {result.chunk_count} dense vector chunks.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link
                href={`/documents/${result.upload_batch_id}`}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>Buka di Studio & Kurasi</span>
                <ArrowRight size={14} />
              </Link>
              <button
                type="button"
                onClick={handleReset}
                className="btn btn-outline btn-sm"
              >
                Unggah Dokumen Lain
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost btn-sm"
              >
                Tutup & Kembali ke Tabel
              </button>
            </div>
          </div>
        ) : (
          /* Upload & Progress Form */
          <>
            <Dropzone
              onUpload={handleUpload}
              isUploading={isUploading}
              uploadError={uploadError}
            />

            {(isUploading || steps.some((s) => s.status !== 'idle')) && (
              <PipelineStepper
                steps={steps}
                currentMessage={currentStepMessage}
                liveProgress={liveProgress}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
