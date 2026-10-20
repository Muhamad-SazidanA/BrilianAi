'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  X,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Sparkles,
  Database,
  ArrowRight,
  Minimize2,
  Terminal,
  Cpu,
  Scissors,
  Check,
} from 'lucide-react';
import { useIngestion, IngestionStage, IngestionTask } from '@/context/IngestionContext';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

export default function IngestionDetailModal() {
  const { language } = useLanguage();
  const {
    tasks,
    activeDetailTaskId,
    closeDetail,
    setIsDockMinimized,
  } = useIngestion();

  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  const activeTask = tasks.find((t) => t.id === activeDetailTaskId) || null;

  useEffect(() => {
    if (activeTask && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTask, activeTask?.message, activeTask?.progressPercent]);

  if (!activeTask) {
    return null;
  }

  const isCompleted = activeTask.status === 'completed';
  const isError = activeTask.status === 'error';
  const isProcessing = !isCompleted && !isError;

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Determine stage progression (1 to 4)
  const getStageNumber = (status: IngestionStage): number => {
    switch (status) {
      case 'queued':
        return 0;
      case 'extracting':
        return 1;
      case 'chunking':
        return 2;
      case 'embedding':
        return 3;
      case 'storing':
        return 4;
      case 'completed':
        return 5;
      case 'error':
        return -1;
      default:
        return 0;
    }
  };

  const currentStageNum = getStageNumber(activeTask.status);

  const stages = [
    {
      num: 1,
      title: language === 'en' ? 'PDF Text & OCR Extraction' : 'Ekstraksi Teks & OCR Halaman',
      desc:
        language === 'en'
          ? 'Parsing document structure, layout, tables, and page metadata'
          : 'Mengekstrak teks digital, tata letak tabel, dan konten visual PDF',
      icon: FileText,
      detail:
        activeTask.currentPage && activeTask.totalPages
          ? `${language === 'en' ? 'Page' : 'Halaman'} ${activeTask.currentPage} / ${activeTask.totalPages}`
          : activeTask.totalPages
          ? `${activeTask.totalPages} ${language === 'en' ? 'pages identified' : 'halaman teridentifikasi'}`
          : language === 'en'
          ? 'Scanning pages...'
          : 'Memindai halaman...',
    },
    {
      num: 2,
      title: language === 'en' ? 'Semantic Sliding-Window Chunking' : 'Chunking Teks Sliding-Window',
      desc:
        language === 'en'
          ? 'Segmenting text into coherent contextual fragments with 15% overlap'
          : 'Memecah teks menjadi fragmen semantik berukuran optimal dengan overlap 15%',
      icon: Scissors,
      detail:
        activeTask.totalChunks
          ? `${activeTask.totalChunks} ${language === 'en' ? 'semantic chunks created' : 'fragmen chunk terbuat'}`
          : language === 'en'
          ? 'Calculating boundary overlap...'
          : 'Menghitung batas semantik...',
    },
    {
      num: 3,
      title: language === 'en' ? '1024-Dim Vector Embeddings' : 'Embeddings Vektor 1024-Dimensi',
      desc:
        language === 'en'
          ? 'Generating dense vector representations via Gemini multimodal embeddings'
          : 'Menghasilkan representasi vektor densitas tinggi untuk pencarian semantik cerdas',
      icon: Cpu,
      detail:
        activeTask.processedChunks && activeTask.totalChunks
          ? `${language === 'en' ? 'Embedded' : 'Ter-embed'}: ${activeTask.processedChunks} / ${activeTask.totalChunks} chunks`
          : activeTask.totalChunks
          ? `0 / ${activeTask.totalChunks} chunks`
          : language === 'en'
          ? 'Generating vectors...'
          : 'Menghasilkan vektor...',
    },
    {
      num: 4,
      title: language === 'en' ? 'PostgreSQL pgvector & HNSW Storage' : 'Penyimpanan pgvector & Indeks HNSW',
      desc:
        language === 'en'
          ? 'Committing vectorized embeddings with cosine indexing into active knowledge base'
          : 'Menyimpan embedding ke tabel database PostgreSQL dengan indeks HNSW berkecepatan tinggi',
      icon: Database,
      detail: isCompleted
        ? language === 'en'
          ? 'Successfully committed & indexed'
          : 'Berhasil diindeks dan siap digunakan'
        : language === 'en'
        ? 'Awaiting vector batch...'
        : 'Menunggu batch vektor...',
    },
  ];

  const handleMinimizeToBackground = () => {
    closeDetail();
    setIsDockMinimized(false);
    toast.info(
      language === 'en'
        ? 'Ingestion continues in background. You can safely switch pages or work on other tasks.'
        : 'Proses dilanjutkan di latar belakang. Anda dapat berpindah halaman atau bekerja seperti biasa.'
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '1rem',
      }}
      onClick={handleMinimizeToBackground}
    >
      <div
        className="ui-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-default, #e2e8f0)',
          borderRadius: '16px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-default, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              <Sparkles size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                  {language === 'en' ? 'AI Vector Ingestion Pipeline' : 'Visualizer Pipeline Vektor AI'}
                </h2>
                <span
                  className={`badge ${isCompleted ? 'badge-success' : isError ? 'badge-danger' : 'badge-accent'}`}
                  style={{ fontSize: '10px', textTransform: 'uppercase', padding: '2px 8px' }}
                >
                  {activeTask.status}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                  {activeTask.fileName}
                </span>
                <span>•</span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px' }}>
                  {formatFileSize(activeTask.fileSize)}
                </span>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={handleMinimizeToBackground}
              title={language === 'en' ? 'Minimize and continue in background' : 'Lanjutkan di latar belakang'}
              className="btn btn-ghost btn-xs"
              style={{ padding: '6px', borderRadius: '8px' }}
            >
              <Minimize2 size={15} />
            </button>
            <button
              type="button"
              onClick={closeDetail}
              title={language === 'en' ? 'Close view' : 'Tutup tampilan'}
              className="btn btn-ghost btn-xs"
              style={{ padding: '6px', borderRadius: '8px' }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px', flex: 1 }}>
          {/* Main Progress Bar & Metrics */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-subtle, #f8fafc)',
              border: '1px solid var(--border-default, #e2e8f0)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                {activeTask.message}
              </span>
              <span style={{ fontSize: '14px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: '#2563eb' }}>
                {activeTask.progressPercent}%
              </span>
            </div>

            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-default, #e2e8f0)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(5, activeTask.progressPercent))}%`,
                  borderRadius: '9999px',
                  backgroundColor: isCompleted ? '#10b981' : isError ? '#ef4444' : '#2563eb',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            {/* Quick Metrics Badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', paddingTop: '4px', textAlign: 'center' }}>
              <div style={{ padding: '6px 8px', borderRadius: '8px', backgroundColor: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-default, #e2e8f0)' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted, #94a3b8)', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
                  {language === 'en' ? 'Pages' : 'Halaman'}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-primary, #0f172a)' }}>
                  {activeTask.totalPages || '-'}
                </span>
              </div>
              <div style={{ padding: '6px 8px', borderRadius: '8px', backgroundColor: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-default, #e2e8f0)' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted, #94a3b8)', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
                  {language === 'en' ? 'Chunks' : 'Fragmen Teks'}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-primary, #0f172a)' }}>
                  {activeTask.totalChunks || '-'}
                </span>
              </div>
              <div style={{ padding: '6px 8px', borderRadius: '8px', backgroundColor: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-default, #e2e8f0)' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted, #94a3b8)', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
                  {language === 'en' ? 'Vectors' : 'Dimensi Vektor'}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: '#2563eb' }}>
                  1024-dim
                </span>
              </div>
            </div>
          </div>

          {/* 4-Stage Stepper Pipeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted, #94a3b8)', margin: 0 }}>
              {language === 'en' ? 'Ingestion Stages' : 'Tahapan Pipeline Terintegrasi'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stages.map((stage) => {
                const Icon = stage.icon;
                const isStageComplete = isCompleted || currentStageNum > stage.num;
                const isStageActive = !isCompleted && !isError && currentStageNum === stage.num;

                return (
                  <div
                    key={stage.num}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: `1px solid ${isStageActive ? 'var(--color-primary, #2563eb)' : isStageComplete ? '#a7f3d0' : 'var(--border-default, #e2e8f0)'}`,
                      backgroundColor: isStageActive ? 'var(--color-primary-subtle, #eff6ff)' : isStageComplete ? '#ecfdf5' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        backgroundColor: isStageComplete ? '#10b981' : isStageActive ? '#2563eb' : 'var(--bg-muted, #e2e8f0)',
                        color: isStageComplete || isStageActive ? '#ffffff' : 'var(--text-secondary, #64748b)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isStageComplete ? (
                        <Check size={16} />
                      ) : isStageActive ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Icon size={16} />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 650, color: 'var(--text-primary, #0f172a)' }}>
                          {stage.title}
                        </span>
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-secondary, #64748b)' }}>
                          {stage.detail}
                        </span>
                      </div>
                      <p style={{ fontSize: '11.5px', color: 'var(--text-secondary, #64748b)', margin: '2px 0 0' }}>
                        {stage.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Terminal / Live Output Stream */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>
              <Terminal size={14} />
              <span>{language === 'en' ? 'Pipeline Telemetry Stream' : 'Live Telemetri Log'}</span>
            </div>

            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#0f172a',
                color: '#34d399',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '11px',
                borderRadius: '8px',
                border: '1px solid #1e293b',
                maxHeight: '110px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <p style={{ margin: 0, color: '#64748b' }}>
                [SYS] Target Document: {activeTask.fileName} ({formatFileSize(activeTask.fileSize)})
              </p>
              <p style={{ margin: 0, color: '#64748b' }}>
                [SYS] Task Client ID: {activeTask.id}
              </p>
              <p style={{ margin: 0, color: '#60a5fa' }}>
                [STATUS] {activeTask.message} ({activeTask.progressPercent}%)
              </p>
              {activeTask.totalChunks && (
                <p style={{ margin: 0, color: '#c084fc' }}>
                  [CHUNKS] Sliding-Window: {activeTask.totalChunks} chunks processed
                </p>
              )}
              {activeTask.processedChunks && (
                <p style={{ margin: 0, color: '#fbbf24' }}>
                  [VECTOR] Embeddings generated: {activeTask.processedChunks} / {activeTask.totalChunks}
                </p>
              )}
              {isCompleted && (
                <p style={{ margin: 0, color: '#34d399', fontWeight: 700 }}>
                  [SUCCESS] Vector embeddings committed to PostgreSQL pgvector knowledge base.
                </p>
              )}
              {isError && (
                <p style={{ margin: 0, color: '#f87171', fontWeight: 700 }}>
                  [ERROR] {activeTask.error || activeTask.message}
                </p>
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-default, #e2e8f0)',
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary, #64748b)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            {language === 'en' ? 'Safe to navigate or refresh' : 'Aman berpindah halaman atau tab'}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isProcessing && (
              <button
                type="button"
                onClick={handleMinimizeToBackground}
                className="btn btn-outline btn-sm"
              >
                <Minimize2 size={13} />
                <span>{language === 'en' ? 'Run in Background' : 'Lanjutkan di Latar Belakang'}</span>
              </button>
            )}

            {isCompleted && (
              <button
                type="button"
                onClick={closeDetail}
                className="btn btn-primary btn-sm"
              >
                <CheckCircle2 size={13} />
                <span>{language === 'en' ? 'Done' : 'Selesai'}</span>
              </button>
            )}

            {isError && (
              <button
                type="button"
                onClick={closeDetail}
                className="btn btn-outline btn-sm"
              >
                {language === 'en' ? 'Close' : 'Tutup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
