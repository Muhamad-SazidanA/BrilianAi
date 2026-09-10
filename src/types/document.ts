export interface UploadBatch {
  id: string;
  original_filename: string;
  chunk_count: number;
  page_count: number;
  uploaded_at: string;
  is_active_knowledge?: boolean;
  curated_count?: number;
  processed_chunks?: number;
}

export interface DocumentChunk {
  id: number | string;
  upload_batch_id: string;
  chunk_index: number;
  content: string;
  source_page_start: number;
  source_page_end: number;
  embedding?: string | number[];
  created_at: string;
}

export interface IngestionResult {
  upload_batch_id: string;
  original_filename: string;
  page_count: number;
  chunk_count: number;
}

export type PipelineStepStatus = 'idle' | 'running' | 'done' | 'error';

export interface PipelineStep {
  number: string;
  title: string;
  description: string;
  status: PipelineStepStatus;
}
