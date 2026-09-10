'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ArrowRight, FileText, Layers, ExternalLink } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import Dropzone from '@/components/upload/Dropzone';
import PipelineStepper from '@/components/upload/PipelineStepper';
import { PipelineStep, IngestionResult } from '@/types/document';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

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

export default function UploadPage() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [isUploading, setIsUploading] = useState(false);
  const [currentStepMessage, setCurrentStepMessage] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [liveProgress, setLiveProgress] = useState<{ status?: string; message?: string; totalChunks?: number; processedChunks?: number; progressPercent?: number; totalPages?: number; currentPage?: number } | null>(null);
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
      // ignore polling errors
    }
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const handleUpload = async (file: File) => {
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

    // Step 1: Render
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

      progressPollRef.current = setInterval(fetchUploadProgress, 900);

      // Simulating visual progression based on server timestamps
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

      // Mark all done
      setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));
      setResult(data);
      toast.success(
        language === 'en'
          ? `Document "${file.name}" ingested successfully!`
          : `Dokumen "${file.name}" berhasil diproses!`
      );
    } catch (err: any) {
      stopPolling();
      const errMsg = err.message || 'Terjadi kesalahan saat memproses file';
      setUploadError(errMsg);
      setSteps((prev) =>
        prev.map((s) => (s.status === 'running' ? { ...s, status: 'error' } : s))
      );
      toast.error(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AppShell
      title={t('upload.title')}
      subtitle={t('upload.subtitle')}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
        {/* Success Banner */}
        {result && (
          <div
            className="ui-card"
            style={{
              borderColor: 'var(--color-success)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              padding: '1.25rem 1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-success-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-success)',
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {t('upload.success_title')}: {result.original_filename}
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {language === 'en' ? 'Successfully extracted ' : 'Berhasil mengekstrak '}
                  <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                    {result.page_count} {language === 'en' ? 'pages' : 'halaman'}
                  </span>{' '}
                  {language === 'en' ? 'into ' : 'menjadi '}
                  <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                    {result.chunk_count} chunks
                  </span>{' '}
                  {language === 'en' ? 'indexed in pgvector.' : 'tersimpan di pgvector.'}
                </p>
              </div>
            </div>

            <Link
              href={`/documents/${result.upload_batch_id}`}
              className="btn btn-primary btn-sm"
              style={{ gap: '6px' }}
            >
              <span>{t('upload.open_studio')}</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {/* Dropzone Component */}
        <Dropzone
          onUpload={handleUpload}
          isUploading={isUploading}
          uploadError={uploadError}
        />

        {/* Pipeline Stepper Component */}
        <PipelineStepper
          steps={steps}
          currentStepMessage={currentStepMessage}
          isProcessing={isUploading}
          currentProgress={liveProgress}
        />
      </div>
    </AppShell>
  );
}
