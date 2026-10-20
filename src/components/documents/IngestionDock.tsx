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
  Maximize2,
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
    const badgeBaseStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: '9999px',
      fontSize: '10.5px',
      fontWeight: 500,
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
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#94a3b8' }} />
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
              border: '1px solid rgba(37, 99, 235, 0.2)',
            }}
          >
            <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
            {language === 'en' ? 'Extracting' : 'Ekstraksi PDF'}
            {task.currentPage && task.totalPages ? ` (${task.currentPage}/${task.totalPages})` : ''}
          </span>
        );
      case 'chunking':
        return (
          <span
            style={{
              ...badgeBaseStyle,
              backgroundColor: 'rgba(79, 70, 229, 0.08)',
              color: '#4f46e5',
              border: '1px solid rgba(79, 70, 229, 0.2)',
            }}
          >
            <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
            {language === 'en' ? 'Chunking' : 'Chunking'}
            {task.totalChunks ? ` (${task.totalChunks} chunks)` : ''}
          </span>
        );
      case 'embedding':
        return (
          <span
            style={{
              ...badgeBaseStyle,
              backgroundColor: 'rgba(217, 119, 6, 0.08)',
              color: '#d97706',
              border: '1px solid rgba(217, 119, 6, 0.2)',
            }}
          >
            <Sparkles size={11} />
            {language === 'en' ? 'Embedding' : 'Vector 1024-d'}
            {task.processedChunks && task.totalChunks
              ? ` (${task.processedChunks}/${task.totalChunks})`
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
              border: '1px solid rgba(147, 51, 234, 0.2)',
            }}
          >
            <Database size={11} />
            {language === 'en' ? 'Storing' : 'pgvector'}
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
            <CheckCircle2 size={11} />
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
            <AlertCircle size={11} />
            {language === 'en' ? 'Failed' : 'Gagal'}
          </span>
        );
    }
  };

  // Minimized Pill Mode (Bottom Right)
  if (isDockMinimized) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 16px',
          borderRadius: '9999px',
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-default, #e2e8f0)',
          boxShadow: '0 10px 25px -4px rgba(15, 23, 42, 0.15)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onClick={() => setIsDockMinimized(false)}
        role="button"
        tabIndex={0}
        aria-label="Expand Ingestion Dock"
      >
        {hasActive ? (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={16} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : errorCount > 0 ? (
          <AlertCircle size={16} color="#ef4444" />
        ) : (
          <CheckCircle2 size={16} color="#10b981" />
        )}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
            {hasActive
              ? language === 'en'
                ? `Processing ${activeTaskCount} document${activeTaskCount > 1 ? 's' : ''}`
                : `Memproses ${activeTaskCount} dokumen...`
              : language === 'en'
              ? `${completedCount} document${completedCount > 1 ? 's' : ''} ready`
              : `${completedCount} dokumen selesai`}
          </span>
          {hasActive && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted, #94a3b8)', fontFamily: 'var(--font-mono, monospace)' }}>
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
          title={language === 'en' ? 'Expand' : 'Buka detail'}
          style={{
            padding: '3px',
            color: 'var(--text-muted, #94a3b8)',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            marginLeft: '4px',
          }}
        >
          <ChevronUp size={16} />
        </button>

        {!hasActive && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clearCompletedTasks();
            }}
            title={language === 'en' ? 'Dismiss' : 'Tutup pemberitahuan'}
            style={{
              padding: '3px',
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
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  // Expanded Floating Card Mode (Bottom Right)
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        width: '390px',
        maxWidth: 'calc(100vw - 32px)',
        backgroundColor: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-default, #e2e8f0)',
        borderRadius: '16px',
        boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.22), 0 4px 12px -2px rgba(15, 23, 42, 0.08)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '520px',
        animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: 'var(--bg-subtle, #f8fafc)',
          borderBottom: '1px solid var(--border-default, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb',
            }}
          >
            <Layers size={16} />
          </div>
          <div>
            <h3 style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
              {language === 'en' ? 'Ingestion Pipeline' : 'Pipeline Ingestion Vektor'}
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary, #64748b)', margin: '1px 0 0' }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {completedCount > 0 && (
            <button
              type="button"
              onClick={clearCompletedTasks}
              title={language === 'en' ? 'Clear completed' : 'Bersihkan yang selesai'}
              style={{
                padding: '6px',
                color: 'var(--text-muted, #94a3b8)',
                border: 'none',
                background: 'transparent',
                borderRadius: '6px',
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
              <Trash2 size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsDockMinimized(true)}
            title={language === 'en' ? 'Minimize' : 'Kecilkan'}
            style={{
              padding: '6px',
              color: 'var(--text-muted, #94a3b8)',
              border: 'none',
              background: 'transparent',
              borderRadius: '6px',
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
            <ChevronDown size={16} />
          </button>

          {!hasActive && (
            <button
              type="button"
              onClick={clearCompletedTasks}
              title={language === 'en' ? 'Close & dismiss' : 'Tutup pemberitahuan'}
              style={{
                padding: '6px',
                color: 'var(--text-muted, #94a3b8)',
                border: 'none',
                background: 'transparent',
                borderRadius: '6px',
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
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Task List */}
      <div
        style={{
          padding: '12px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
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
                borderRadius: '12px',
                padding: '10px 12px',
                backgroundColor: isActive ? 'rgba(37, 99, 235, 0.03)' : 'var(--bg-card, #ffffff)',
                border: isActive
                  ? '1px solid rgba(37, 99, 235, 0.2)'
                  : '1px solid var(--border-default, #e2e8f0)',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', minWidth: 0 }}>
                  <div
                    style={{
                      marginTop: '2px',
                      padding: '5px',
                      borderRadius: '8px',
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
                    <FileText size={14} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-primary, #0f172a)',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '200px',
                      }}
                      title={task.fileName}
                    >
                      {task.fileName}
                    </p>
                    <p style={{ fontSize: '10.5px', color: 'var(--text-muted, #94a3b8)', fontFamily: 'var(--font-mono, monospace)', margin: '2px 0 0' }}>
                      {formatFileSize(task.fileSize)}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {getStageBadge(task.status, task)}
                  {(isDone || isErr) && (
                    <button
                      type="button"
                      onClick={() => clearTask(task.id)}
                      title={language === 'en' ? 'Remove' : 'Hapus'}
                      style={{
                        padding: '4px',
                        color: 'var(--text-muted, #94a3b8)',
                        border: 'none',
                        background: 'transparent',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
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

              {/* Progress bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '6px 0' }}>
                <div
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                    borderRadius: '9999px',
                    height: '5px',
                    overflow: 'hidden',
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--text-secondary, #64748b)' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                    {task.message}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, marginLeft: '4px' }}>
                    {task.progressPercent}%
                  </span>
                </div>
              </div>

              {/* View Detail Button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => openDetail(task.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.06)',
                    border: '1px solid rgba(37, 99, 235, 0.15)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.06)';
                  }}
                >
                  <Maximize2 size={11} />
                  <span>{language === 'en' ? 'Live Visualizer' : 'Visualizer Pipeline'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div
        style={{
          padding: '8px 16px',
          backgroundColor: 'var(--bg-subtle, #f8fafc)',
          borderTop: '1px solid var(--border-default, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-muted, #94a3b8)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {language === 'en'
            ? 'Background processing is active'
            : '🛡️ Berjalan di background'}
        </span>
        <button
          type="button"
          onClick={() => setIsDockMinimized(true)}
          style={{
            color: '#2563eb',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '11px',
            marginLeft: '8px',
            flexShrink: 0,
          }}
        >
          {language === 'en' ? 'Minimize' : 'Kecilkan'}
        </button>
      </div>
    </div>
  );
}
