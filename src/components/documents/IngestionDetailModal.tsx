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
  }, [activeTask?.message, activeTask?.progressPercent]);

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
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={handleMinimizeToBackground}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
        }}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {language === 'en' ? 'AI Vector Ingestion Pipeline' : 'Visualizer Pipeline Vektor AI'}
                </h2>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isCompleted
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                      : isError
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 animate-pulse'
                  }`}
                >
                  {activeTask.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {activeTask.fileName}
                </span>
                <span>•</span>
                <span className="font-mono text-[11px]">{formatFileSize(activeTask.fileSize)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleMinimizeToBackground}
              title={
                language === 'en'
                  ? 'Minimize and continue in background'
                  : 'Lanjutkan di latar belakang'
              }
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={closeDetail}
              title={language === 'en' ? 'Close view' : 'Tutup tampilan'}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Main Progress Bar & Metrics */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {activeTask.message}
              </span>
              <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">
                {activeTask.progressPercent}%
              </span>
            </div>

            <div className="w-full bg-slate-200 dark:bg-slate-700/80 rounded-full h-2.5 overflow-hidden p-0.5">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  isCompleted
                    ? 'bg-emerald-500'
                    : isError
                    ? 'bg-rose-500'
                    : 'bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400 shadow-sm'
                }`}
                style={{ width: `${Math.min(100, Math.max(5, activeTask.progressPercent))}%` }}
              />
            </div>

            {/* Quick Metrics Badges */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">
                  {language === 'en' ? 'Pages' : 'Halaman'}
                </span>
                <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                  {activeTask.totalPages || '-'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">
                  {language === 'en' ? 'Chunks' : 'Fragmen Teks'}
                </span>
                <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                  {activeTask.totalChunks || '-'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">
                  {language === 'en' ? 'Vectors' : 'Dimensi Vektor'}
                </span>
                <span className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400">
                  1024-dim
                </span>
              </div>
            </div>
          </div>

          {/* 4-Stage Stepper Pipeline */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {language === 'en' ? 'Ingestion Stages' : 'Tahapan Pipeline Terintegrasi'}
            </h3>

            <div className="space-y-2.5">
              {stages.map((stage) => {
                const Icon = stage.icon;
                const isStageComplete = isCompleted || currentStageNum > stage.num;
                const isStageActive = !isCompleted && !isError && currentStageNum === stage.num;
                const isStagePending = !isCompleted && currentStageNum < stage.num;

                return (
                  <div
                    key={stage.num}
                    className={`p-3.5 rounded-2xl border transition-all duration-200 flex items-start gap-3.5 ${
                      isStageComplete
                        ? 'bg-emerald-50/30 border-emerald-200 dark:bg-emerald-950/10 dark:border-emerald-900/50'
                        : isStageActive
                        ? 'bg-blue-50/50 border-blue-300 dark:bg-blue-950/30 dark:border-blue-700/60 shadow-sm'
                        : 'bg-slate-50/50 border-slate-200/60 dark:bg-slate-900/40 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                        isStageComplete
                          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300'
                          : isStageActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                          : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {isStageComplete ? (
                        <Check className="w-4 h-4 stroke-[3]" />
                      ) : isStageActive ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-bold ${
                            isStageActive
                              ? 'text-blue-700 dark:text-blue-300'
                              : isStageComplete
                              ? 'text-emerald-800 dark:text-emerald-300'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {stage.title}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {stage.detail}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {stage.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Terminal / Live Output Stream */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Terminal className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'Pipeline Telemetry Stream' : 'Live Telemetri Log'}</span>
            </div>

            <div className="p-3 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-xl border border-slate-800 space-y-1 max-h-28 overflow-y-auto shadow-inner">
              <p className="text-slate-500">
                [SYS] Target Document: {activeTask.fileName} ({formatFileSize(activeTask.fileSize)})
              </p>
              <p className="text-slate-500">
                [SYS] Task Client ID: {activeTask.id}
              </p>
              <p className="text-blue-400">
                [STATUS] {activeTask.message} ({activeTask.progressPercent}%)
              </p>
              {activeTask.totalChunks && (
                <p className="text-purple-400">
                  [CHUNKS] Sliding-Window: {activeTask.totalChunks} chunks processed
                </p>
              )}
              {activeTask.processedChunks && (
                <p className="text-amber-400">
                  [VECTOR] Embeddings generated: {activeTask.processedChunks} / {activeTask.totalChunks}
                </p>
              )}
              {isCompleted && (
                <p className="text-emerald-300 font-bold">
                  [SUCCESS] Vector embeddings committed to PostgreSQL pgvector knowledge base.
                </p>
              )}
              {isError && (
                <p className="text-rose-400 font-bold">
                  [ERROR] {activeTask.error || activeTask.message}
                </p>
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {language === 'en'
              ? 'Safe to navigate or refresh'
              : 'Aman berpindah halaman atau tab'}
          </p>

          <div className="flex items-center gap-2">
            {isProcessing && (
              <button
                type="button"
                onClick={handleMinimizeToBackground}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                {language === 'en' ? 'Run in Background' : 'Lanjutkan di Latar Belakang'}
              </button>
            )}

            {isCompleted && (
              <button
                type="button"
                onClick={closeDetail}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {language === 'en' ? 'Done' : 'Selesai'}
              </button>
            )}

            {isError && (
              <button
                type="button"
                onClick={closeDetail}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
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
