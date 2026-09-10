export type IngestProgressStatus =
  | 'queued'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'storing'
  | 'completed'
  | 'error';

export interface IngestProgressState {
  clientId: string;
  status: IngestProgressStatus;
  message: string;
  totalPages?: number;
  currentPage?: number;
  totalChunks?: number;
  processedChunks?: number;
  progressPercent?: number;
  updatedAt: number;
}

const ingestProgressMap = new Map<string, IngestProgressState>();

export function setIngestProgress(clientId: string, progress: Omit<IngestProgressState, 'updatedAt'>): IngestProgressState {
  const next = {
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
