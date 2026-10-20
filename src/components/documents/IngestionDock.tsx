'use client';

import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Sparkles,
  Database,
  Trash2,
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
    const badgeBaseStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 7px',
      borderRadius: '9999px',
      fontSize: '10.5px',
      fontWeight: 500,
      letterSpacing: '0.01em',
    };

    switch (stage) {
      case 'queued':
        return (
          <span
            style={{
              ...badgeBaseStyle,
              backgroundColor: 'var(--bg-subtle, #f1f5f9)',
              color: 'var(--text-secondary, #475569)',
              border: '1px solid var(--border-default, #e2e8f0)',
            }}
          >
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#94a3b8' }} />
            {language === 'en' ? 'Queued' : 'Antrian'}
          </span>
        );
      case 'extracting':
        return (
          <span
            style={{
              ...badgeBaseStyle,
              backgroundColor: 'rgba(37, 99, 235, 0.08)',
              color: '#2563eb',
              border: '1px solid rgba(37, 99, 235, 0.18)',
            }}
          >
            <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
            {language === 'en' ? 'OCR' : 'Ekstraksi'}
            {task.currentPage && task.totalPages ? ` ${task.currentPage}/${task.totalPages}` : ''}
          </span>
        );
      case 'chunking':
        return (
          <span
            style={{
              ...badgeBaseStyle,
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              color: '#6366f1',
              border: '1px solid rgba(99, 102, 241, 0.18)',
            }}
          >
            <Layers size={10} />
            {language === 'en' ? 'Chunking' : 'Chunking'}
            {task.totalChunks ? ` (${task.totalChunks})` : ''}
          </span>
        );
      case 'embedding':
        return (
          <span
            style={{
              ...badgeBaseStyle,
              backgroundColor: 'rgba(217, 119, 6, 0.08)',
              color: '#d97706',
              border: '1px solid rgba(217, 119, 6, 0.18)',
            }}
          >
            <Sparkles size={10} />
            {language === 'en' ? 'Vector 1024-d' : 'Vektor 1024-d'}
            {task.processedChunks && task.totalChunks
              ? ` ${task.processedChunks}/${task.totalChunks}`
              : ''}
          </span>
        );
      case 'storing':
        return (
          <span
            style={{
              ...badgeBaseStyle,
              backgroundColor: 'rgba(147, 51, 234, 0.08)',
              color: '#9333ea',
              border: '1px solid rgba(147, 51, 234, 0.18)',
            }}
          >
            <Database size={10} />
            pgvector
          </span>
        );
      case 'completed':
        return (
          <span
            style={{
              ...badgeBaseStyle,
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              color: '#059669',
              border: '1px solid rgba(16, 185, 129, 0.2)',
            }}
          >
            <CheckCircle2 size={10.5} />
            {language === 'en' ? 'Completed' : 'Selesai'}
          </span>
        );
      case 'error':
        return (
          <span
            style={{
              ...badgeBaseStyle,
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              color: '#dc2626',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            <AlertCircle size={10.5} />
            {language === 'en' ? 'Failed' : 'Gagal'}
          </span>
        );
    }
  };

  // ── Minimized Mode: Sleek Floating Pill ──
  if (isDockMinimized) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          padding: '7px 14px',
          borderRadius: '9999px',
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-default, #e2e8f0)',
          boxShadow: '0 10px 25px -4px rgba(15, 23, 42, 0.12), 0 2px 8px -2px rgba(15, 23, 42, 0.04)',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={() => setIsDockMinimized(false)}
        role="button"
        tabIndex={0}
        aria-label="Buka Ingestion Pipeline"
      >
        {hasActive ? (
          <Loader2 size={14} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
        ) : errorCount > 0 ? (
          <AlertCircle size={14} color="#ef4444" />
        ) : (
          <CheckCircle2 size={14} color="#10b981" />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
            {hasActive
              ? language === 'en'
                ? `Ingesting ${activeTaskCount} file${activeTaskCount > 1 ? 's' : ''}`
                : `Memproses ${activeTaskCount} file...`
              : language === 'en'
              ? `${completedCount} file${completedCount > 1 ? 's' : ''} ready`
              : `${completedCount} file selesai`}
          </span>
        </div>

        <ChevronUp size={14} style={{ color: 'var(--text-muted, #94a3b8)', marginLeft: '2px' }} />

        {!hasActive && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clearCompletedTasks();
            }}
            title={language === 'en' ? 'Dismiss' : 'Tutup pemberitahuan'}
            style={{
              padding: '2px',
              color: 'var(--text-muted, #94a3b8)',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              marginLeft: '2px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted, #94a3b8)';
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>
    );
  }

  // ── Expanded Mode: Ultra-Clean Floating Card ──
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        width: '360px',
        maxWidth: 'calc(100vw - 32px)',
        backgroundColor: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-default, #e2e8f0)',
        borderRadius: '14px',
        boxShadow: '0 16px 36px -6px rgba(15, 23, 42, 0.14), 0 4px 12px -2px rgba(15, 23, 42, 0.05)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '480px',
        animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* ── 1. Clean Header ── */}
      <div
        style={{
          padding: '11px 14px',
          backgroundColor: 'var(--bg-subtle, #f8fafc)',
          borderBottom: '1px solid var(--border-default, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb',
            }}
          >
            <Layers size={14} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                {language === 'en' ? 'Ingestion Pipeline' : 'Pipeline Ingestion'}
              </h3>
              {hasActive && (
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#2563eb',
                    display: 'inline-block',
                    animation: 'pulse 1.5s infinite',
                  }}
                />
              )}
            </div>
            <p style={{ fontSize: '10.5px', color: 'var(--text-secondary, #64748b)', margin: 0 }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {completedCount > 0 && (
            <button
              type="button"
              onClick={clearCompletedTasks}
              title={language === 'en' ? 'Clear completed' : 'Bersihkan yang selesai'}
              style={{
                padding: '5px',
                color: 'var(--text-muted, #94a3b8)',
                border: 'none',
                background: 'transparent',
                borderRadius: '5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted, #94a3b8)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Trash2 size={13} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsDockMinimized(true)}
            title={language === 'en' ? 'Minimize' : 'Kecilkan'}
            style={{
              padding: '5px',
              color: 'var(--text-muted, #94a3b8)',
              border: 'none',
              background: 'transparent',
              borderRadius: '5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary, #0f172a)';
              e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f1f5f9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted, #94a3b8)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ChevronDown size={15} />
          </button>

          {!hasActive && (
            <button
              type="button"
              onClick={clearCompletedTasks}
              title={language === 'en' ? 'Close & dismiss' : 'Tutup'}
              style={{
                padding: '5px',
                color: 'var(--text-muted, #94a3b8)',
                border: 'none',
                background: 'transparent',
                borderRadius: '5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted, #94a3b8)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Task Cards Stream ── */}
      <div
        style={{
          padding: '10px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flex: 1,
        }}
      >
        {tasks.map((task) => {
          const isDone = task.status === 'completed';
          const isErr = task.status === 'error';
          const isActive = !isDone && !isErr;

          return (
            <div
              key={task.id}
              style={{
                borderRadius: '10px',
                padding: '9px 11px',
                backgroundColor: isActive ? 'rgba(37, 99, 235, 0.02)' : 'var(--bg-card, #ffffff)',
                border: isActive
                  ? '1px solid rgba(37, 99, 235, 0.18)'
                  : '1px solid var(--border-default, #e2e8f0)',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Row 1: File Info & Status Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '8px',
                  marginBottom: '7px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      marginTop: '2px',
                      padding: '4px',
                      borderRadius: '6px',
                      flexShrink: 0,
                      backgroundColor: isDone
                        ? 'rgba(16, 185, 129, 0.1)'
                        : isErr
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'rgba(37, 99, 235, 0.1)',
                      color: isDone ? '#10b981' : isErr ? '#ef4444' : '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FileText size={13} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 600,
                        color: 'var(--text-primary, #0f172a)',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={task.fileName}
                    >
                      {task.fileName}
                    </p>
                    <p
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-muted, #94a3b8)',
                        fontFamily: 'var(--font-mono, monospace)',
                        margin: '1px 0 0',
                      }}
                    >
                      {formatFileSize(task.fileSize)}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  {getStageBadge(task.status, task)}
                  {(isDone || isErr) && (
                    <button
                      type="button"
                      onClick={() => clearTask(task.id)}
                      title={language === 'en' ? 'Remove' : 'Hapus'}
                      style={{
                        padding: '3px',
                        color: 'var(--text-muted, #94a3b8)',
                        border: 'none',
                        background: 'transparent',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#ef4444';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-muted, #94a3b8)';
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2: Slim Smooth Progress Bar */}
              <div
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                  borderRadius: '9999px',
                  height: '4px',
                  overflow: 'hidden',
                  margin: '6px 0 5px',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    borderRadius: '9999px',
                    transition: 'width 0.3s ease',
                    width: `${Math.min(100, Math.max(5, task.progressPercent))}%`,
                    background: isDone
                      ? '#10b981'
                      : isErr
                      ? '#ef4444'
                      : 'linear-gradient(90deg, #2563eb, #6366f1)',
                  }}
                />
              </div>

              {/* Row 3: Progress Message & Percentage */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '10.5px',
                  color: 'var(--text-secondary, #64748b)',
                }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '240px',
                  }}
                  title={task.message}
                >
                  {task.message}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontWeight: 600,
                    fontSize: '10.5px',
                    marginLeft: '6px',
                    color: isDone ? '#059669' : isErr ? '#dc2626' : '#2563eb',
                  }}
                >
                  {task.progressPercent}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 3. Ultra-Clean Minimal Footer ── */}
      <div
        style={{
          padding: '8px 14px',
          backgroundColor: 'var(--bg-subtle, #f8fafc)',
          borderTop: '1px solid var(--border-default, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '10.5px',
          color: 'var(--text-secondary, #64748b)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: hasActive ? '#2563eb' : '#10b981',
            }}
          />
          {hasActive
            ? language === 'en'
              ? 'Background processing active'
              : 'Proses latar belakang aktif'
            : language === 'en'
            ? 'Knowledge Base ready'
            : 'Dokumen tersimpan di Knowledge Base'}
        </span>

        <button
          type="button"
          onClick={() => setIsDockMinimized(true)}
          style={{
            fontSize: '11px',
            fontWeight: 500,
            color: '#2563eb',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: '4px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = 'none';
          }}
        >
          {language === 'en' ? 'Minimize' : 'Kecilkan'}
        </button>
      </div>
    </div>
  );
}
