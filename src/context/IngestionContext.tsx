'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';

export type IngestionStage =
  | 'queued'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'storing'
  | 'completed'
  | 'error';

export interface IngestionTask {
  id: string; // unique clientId
  fileName: string;
  fileSize: number;
  status: IngestionStage;
  message: string;
  progressPercent: number;
  totalPages?: number;
  currentPage?: number;
  totalChunks?: number;
  processedChunks?: number;
  error?: string;
  result?: {
    upload_batch_id: string;
    original_filename: string;
    page_count: number;
    chunk_count: number;
  };
  startedAt: number;
  completedAt?: number;
}

export interface IngestionOptions {
  ownerId?: string;
  divisionId?: string;
  classification?: string;
  status?: string;
  version?: string;
  reviewDueDate?: string | null;
  userGrants?: Array<{ userId: string; accessLevel: 'viewer' | 'editor' }>;
}

interface IngestionContextType {
  tasks: IngestionTask[];
  activeTaskCount: number;
  isDockMinimized: boolean;
  setIsDockMinimized: (minimized: boolean) => void;
  enqueueFiles: (files: File[], options: IngestionOptions) => Promise<void>;
  clearTask: (taskId: string) => void;
  clearCompletedTasks: () => void;
}

const IngestionContext = createContext<IngestionContextType | undefined>(undefined);

const STORAGE_KEY = 'brilian_ingestion_tasks_v1';

export function IngestionProvider({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  const [tasks, setTasks] = useState<IngestionTask[]>([]);
  const [isDockMinimized, setIsDockMinimized] = useState<boolean>(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const tasksRef = useRef<IngestionTask[]>(tasks);
  tasksRef.current = tasks;

  // Concurrency-controlled Upload Queue (Max 3 parallel workers for memory safety)
  const uploadQueueRef = useRef<Array<{ file: File; clientId: string; options: IngestionOptions }>>([]);
  const activeWorkerCountRef = useRef<number>(0);
  const MAX_CONCURRENT_UPLOADS = 3;

  // 1. Restore persistent tasks from localStorage on initial load
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: IngestionTask[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter tasks older than 2 hours to prevent stale accumulation
          const cutoff = Date.now() - 2 * 60 * 60 * 1000;
          const fresh = parsed.filter((t) => t.startedAt > cutoff);
          setTasks(fresh);
          // Jika seluruh tugas yang dimuat sudah selesai, otomatis tampilkan dalam mode minimized pill
          if (fresh.length > 0 && fresh.every((t) => t.status === 'completed' || t.status === 'error')) {
            setIsDockMinimized(true);
          }
        }
      }
    } catch (e) {
      console.warn('[IngestionContext] Failed to load stored tasks:', e);
    }
  }, []);

  // 2. Persist tasks to localStorage whenever tasks change
  useEffect(() => {
    try {
      if (tasks.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('[IngestionContext] Failed to persist tasks:', e);
    }
  }, [tasks]);

  // 3. Resilient Poller for active non-terminal tasks
  useEffect(() => {
    const hasActiveTasks = tasks.some((t) => t.status !== 'completed' && t.status !== 'error');

    if (!hasActiveTasks) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    if (pollingRef.current) return;

    pollingRef.current = setInterval(async () => {
      const currentActive = tasksRef.current.filter((t) => t.status !== 'completed' && t.status !== 'error');
      if (currentActive.length === 0) return;

      for (const task of currentActive) {
        try {
          const res = await fetch(`/api/documents/upload?clientId=${encodeURIComponent(task.id)}`);
          if (!res.ok) continue;
          const data = await res.json();

          if (data.status === 'idle') {
            // Task might have been evicted or not found on server yet
            continue;
          }

          setTasks((prev) =>
            prev.map((t) => {
              if (t.id !== task.id) return t;

              const isJustFinished = (data.status === 'completed' && t.status !== 'completed');
              const isJustFailed = (data.status === 'error' && t.status !== 'error');

              if (isJustFinished) {
                toast.success(
                  language === 'en'
                    ? `Document "${t.fileName}" successfully indexed into Vector Store!`
                    : `Dokumen "${t.fileName}" berhasil di-ingest ke Vector Store!`
                );
                // Dispatch event so DocumentTable or other views can auto-refresh
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('document_ingestion_completed', { detail: { taskId: t.id, result: data.result } }));
                }
              } else if (isJustFailed) {
                toast.error(
                  language === 'en'
                    ? `Ingestion failed for "${t.fileName}": ${data.message || data.error}`
                    : `Gagal memproses "${t.fileName}": ${data.message || data.error}`
                );
              }

              return {
                ...t,
                status: data.status,
                message: data.message || t.message,
                progressPercent: data.progressPercent ?? t.progressPercent,
                totalPages: data.totalPages ?? t.totalPages,
                currentPage: data.currentPage ?? t.currentPage,
                totalChunks: data.totalChunks ?? t.totalChunks,
                processedChunks: data.processedChunks ?? t.processedChunks,
                error: data.error,
                result: data.result ?? t.result,
                completedAt: data.status === 'completed' || data.status === 'error' ? Date.now() : undefined,
              };
            })
          );
        } catch {
          // Network hiccup - ignore and keep polling
        }
      }
    }, 850);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [tasks, language]);

  // Concurrency worker: Memproses antrian dokumen secara bertahap (maks 3 file paralel)
  const processNextFromQueue = useCallback(async () => {
    if (activeWorkerCountRef.current >= MAX_CONCURRENT_UPLOADS) return;
    if (uploadQueueRef.current.length === 0) return;

    const item = uploadQueueRef.current.shift();
    if (!item) return;

    activeWorkerCountRef.current++;
    const { file, clientId, options } = item;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === clientId
          ? {
              ...t,
              status: 'extracting',
              message: language === 'en' ? 'Uploading & parsing document...' : 'Mengunggah & memproses dokumen...',
              progressPercent: 10,
            }
          : t
      )
    );

    const formData = new FormData();
    formData.append('file', file);
    formData.append('clientId', clientId);
    formData.append('async', 'true');
    if (options.ownerId) formData.append('ownerId', options.ownerId);
    if (options.divisionId) formData.append('divisionId', options.divisionId);
    if (options.classification) formData.append('classification', options.classification);
    if (options.status) formData.append('status', options.status);
    if (options.version) formData.append('version', options.version);
    if (options.reviewDueDate) formData.append('reviewDueDate', options.reviewDueDate);
    if (options.userGrants && options.userGrants.length > 0) {
      formData.append('userGrants', JSON.stringify(options.userGrants));
    }

    try {
      const res = await fetch('/api/documents/upload?async=true', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Upload failed with status ${res.status}`);
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === clientId
            ? {
                ...t,
                status: 'extracting',
                message: language === 'en' ? 'Processing document pipeline...' : 'Memproses pipeline ekstraksi berkas...',
                progressPercent: 20,
              }
            : t
        )
      );
    } catch (err: any) {
      console.error('[IngestionContext] Upload dispatch error:', err);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === clientId
            ? {
                ...t,
                status: 'error',
                message: err.message || 'Gagal mengirim file',
                error: err.message,
                progressPercent: 100,
                completedAt: Date.now(),
              }
            : t
        )
      );
    } finally {
      activeWorkerCountRef.current = Math.max(0, activeWorkerCountRef.current - 1);
      // Lanjutkan antrean berkas berikutnya secara otomatis
      setTimeout(() => {
        processNextFromQueue();
      }, 40);
    }
  }, [language]);

  // 4. Enqueue multiple files to the ingestion queue (Tanpa batas file, concurrency 3)
  const enqueueFiles = useCallback(async (files: File[], options: IngestionOptions) => {
    if (files.length === 0) return;

    const newTasks: IngestionTask[] = [];

    for (const file of files) {
      const clientId = `upload-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const task: IngestionTask = {
        id: clientId,
        fileName: file.name,
        fileSize: file.size,
        status: 'queued',
        message: language === 'en' ? 'Queued (waiting for worker slot)...' : 'Dalam antrean (menunggu giliran proses)...',
        progressPercent: 5,
        startedAt: Date.now(),
      };
      newTasks.push(task);
      uploadQueueRef.current.push({ file, clientId, options });
    }

    setTasks((prev) => [...prev, ...newTasks]);
    // Pastikan floating dock terbuka agar pengguna melihat progres langsung
    setIsDockMinimized(false);

    // Picu worker hingga batas concurrency maksimal (3)
    for (let i = 0; i < MAX_CONCURRENT_UPLOADS; i++) {
      processNextFromQueue();
    }
  }, [language, processNextFromQueue]);


  const clearTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const clearCompletedTasks = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status !== 'completed' && t.status !== 'error'));
  }, []);

  const activeTaskCount = tasks.filter((t) => t.status !== 'completed' && t.status !== 'error').length;

  return (
    <IngestionContext.Provider
      value={{
        tasks,
        activeTaskCount,
        isDockMinimized,
        setIsDockMinimized,
        enqueueFiles,
        clearTask,
        clearCompletedTasks,
      }}
    >
      {children}
    </IngestionContext.Provider>
  );
}

export function useIngestion() {
  const context = useContext(IngestionContext);
  if (!context) {
    throw new Error('useIngestion must be used within an IngestionProvider');
  }
  return context;
}
