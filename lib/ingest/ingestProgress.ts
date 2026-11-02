export type IngestProgressStatus =
  | 'queued'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'storing'
  | 'completed'
  | 'error';

export interface IngestProgressResult {
  upload_batch_id: string;
  original_filename: string;
  page_count: number;
  chunk_count: number;
}

export interface IngestProgressState {
  clientId: string;
  filename?: string;
  status: IngestProgressStatus;
  message: string;
  totalPages?: number;
  currentPage?: number;
  totalChunks?: number;
  processedChunks?: number;
  progressPercent?: number;
  result?: IngestProgressResult;
  error?: string;
  updatedAt: number;
}

const ingestProgressMap = new Map<string, IngestProgressState>();
const PROGRESS_TTL_MS = 30 * 60 * 1000; // 30 menit TTL untuk entri yang ditinggalkan

// Pembersihan berkala setiap 5 menit agar memori tetap bersih
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    ingestProgressMap.forEach((state, key) => {
      if (now - state.updatedAt > PROGRESS_TTL_MS) {
        ingestProgressMap.delete(key);
      }
    });
  }, 5 * 60 * 1000).unref?.();
}

export function setIngestProgress(clientId: string, progress: Omit<IngestProgressState, 'updatedAt'>): IngestProgressState {
  const existing = ingestProgressMap.get(clientId);
  const next: IngestProgressState = {
    ...existing,
    ...progress,
    updatedAt: Date.now(),
  };

  ingestProgressMap.set(clientId, next);
  return next;
}

export function getIngestProgress(clientId: string): IngestProgressState | null {
  const state = ingestProgressMap.get(clientId);
  if (!state) return null;

  // Jika entri sudah melebihi TTL, bersihkan
  if (Date.now() - state.updatedAt > PROGRESS_TTL_MS) {
    ingestProgressMap.delete(clientId);
    return null;
  }

  return state;
}

export function clearIngestProgress(clientId: string): void {
  ingestProgressMap.delete(clientId);
}

