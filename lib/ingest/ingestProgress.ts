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
  return ingestProgressMap.get(clientId) ?? null;
}

export function clearIngestProgress(clientId: string): void {
  ingestProgressMap.delete(clientId);
}
