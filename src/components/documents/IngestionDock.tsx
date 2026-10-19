'use client';

import React from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  Sparkles,
  Database,
  Trash2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useIngestion, IngestionTask, IngestionStage } from '@/context/IngestionContext';
import { useLanguage } from '@/context/LanguageContext';

export default function IngestionDock() {
  const { language } = useLanguage();
  const {
    tasks,
    activeTaskCount,
    isDockMinimized,
    setIsDockMinimized,
    openDetail,
    clearTask,
    clearCompletedTasks,
  } = useIngestion();

  // If there are no tasks in the session, hide the dock entirely
  if (tasks.length === 0) {
    return null;
  }

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const errorCount = tasks.filter((t) => t.status === 'error').length;
  const hasActive = activeTaskCount > 0;

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getStageBadge = (stage: IngestionStage, task: IngestionTask) => {
    switch (stage) {
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            {language === 'en' ? 'Queued' : 'Antrian'}
          </span>
        );
      case 'extracting':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
            <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
            {language === 'en' ? 'Extracting' : 'Ekstraksi PDF'}
            {task.currentPage && task.totalPages ? ` (${task.currentPage}/${task.totalPages})` : ''}
          </span>
        );
      case 'chunking':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
            <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
            {language === 'en' ? 'Chunking' : 'Chunking'}
            {task.totalChunks ? ` (${task.totalChunks} chunks)` : ''}
          </span>
        );
      case 'embedding':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
            <Sparkles className="w-3 h-3 animate-pulse text-amber-600" />
            {language === 'en' ? 'Embedding' : 'Vector 1024-d'}
            {task.processedChunks && task.totalChunks
              ? ` (${task.processedChunks}/${task.totalChunks})`
              : ''}
          </span>
        );
      case 'storing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
            <Database className="w-3 h-3 animate-bounce text-purple-600" />
            {language === 'en' ? 'Storing' : 'pgvector'}
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            {language === 'en' ? 'Completed' : 'Selesai'}
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            {language === 'en' ? 'Failed' : 'Gagal'}
          </span>
        );
    }
  };

  // Minimized Pill Mode (Bottom Right)
  if (isDockMinimized) {
    return (
      <div
        className="fixed bottom-5 right-6 z-[9999] flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-200 group"
        onClick={() => setIsDockMinimized(false)}
        role="button"
        tabIndex={0}
        aria-label="Expand Ingestion Dock"
      >
        {hasActive ? (
          <div className="relative flex items-center justify-center">
            <span className="absolute -inset-1 rounded-full bg-blue-400/30 animate-ping" />
            <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        ) : errorCount > 0 ? (
          <AlertCircle className="w-4 h-4 text-rose-500" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        )}

        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {hasActive
              ? language === 'en'
                ? `Processing ${activeTaskCount} document${activeTaskCount > 1 ? 's' : ''}`
                : `Memproses ${activeTaskCount} dokumen...`
              : language === 'en'
              ? `${completedCount} document${completedCount > 1 ? 's' : ''} ready`
              : `${completedCount} dokumen selesai`}
          </span>
          {hasActive && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {language === 'en' ? 'Running in background' : 'Berjalan di latar belakang'}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDockMinimized(false);
          }}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-1 rounded-md"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Expanded Floating Card Mode (Bottom Right)
  return (
    <div
      className="fixed bottom-5 right-6 z-[9999] w-[400px] max-w-[calc(100vw-32px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[540px] animate-in fade-in slide-in-from-bottom-4 duration-200"
      style={{
        boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.25)',
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {language === 'en' ? 'Ingestion Pipeline' : 'Pipeline Ingestion Vektor'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {hasActive
                ? language === 'en'
                  ? `${activeTaskCount} active processing`
                  : `${activeTaskCount} proses aktif berjalan`
                : language === 'en'
                ? 'All tasks completed'
                : 'Semua proses selesai'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {completedCount > 0 && (
            <button
              type="button"
              onClick={clearCompletedTasks}
              title={language === 'en' ? 'Clear completed' : 'Bersihkan yang selesai'}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-md transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsDockMinimized(true)}
            title={language === 'en' ? 'Minimize to pill' : 'Kecilkan dock'}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-md transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="p-3 overflow-y-auto space-y-2.5 flex-1 divide-y divide-slate-100 dark:divide-slate-800/60">
        {tasks.map((task) => {
          const isDone = task.status === 'completed';
          const isErr = task.status === 'error';
          const isActive = !isDone && !isErr;

          return (
            <div
              key={task.id}
              className={`pt-2.5 first:pt-0 transition-colors rounded-xl p-2.5 ${
                isActive
                  ? 'bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-start gap-2 min-w-0">
                  <div
                    className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${
                      isDone
                        ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600'
                        : isErr
                        ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600'
                        : 'bg-blue-100 dark:bg-blue-950/50 text-blue-600'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate"
                      title={task.fileName}
                    >
                      {task.fileName}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {formatFileSize(task.fileSize)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {getStageBadge(task.status, task)}
                  {(isDone || isErr) && (
                    <button
                      type="button"
                      onClick={() => clearTask(task.id)}
                      title={language === 'en' ? 'Remove' : 'Hapus'}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1 my-1.5">
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      isDone
                        ? 'bg-emerald-500'
                        : isErr
                        ? 'bg-rose-500'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, task.progressPercent))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="truncate max-w-[260px] text-[10.5px]">
                    {task.message}
                  </span>
                  <span className="font-mono font-medium text-[10.5px] ml-1">
                    {task.progressPercent}%
                  </span>
                </div>
              </div>

              {/* View Detail Button */}
              <div className="flex items-center justify-end pt-1">
                <button
                  type="button"
                  onClick={() => openDetail(task.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md transition-colors"
                >
                  <Maximize2 className="w-3 h-3" />
                  {language === 'en' ? 'Live Visualizer' : 'Visualizer Pipeline'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400">
        <span className="truncate">
          {language === 'en'
            ? 'Background processing is active'
            : '🛡️ Berjalan di background walau page ditutup'}
        </span>
        <button
          type="button"
          onClick={() => setIsDockMinimized(true)}
          className="text-blue-600 dark:text-blue-400 hover:underline font-medium ml-2 flex-shrink-0"
        >
          {language === 'en' ? 'Minimize' : 'Kecilkan'}
        </button>
      </div>
    </div>
  );
}
