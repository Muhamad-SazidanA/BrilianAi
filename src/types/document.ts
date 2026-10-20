export type DocumentClassification = 'Publik' | 'Internal' | 'Rahasia' | 'Sangat Rahasia';
export type DocumentStatus =
  | 'Menunggu Kurasi'
  | 'Draft'
  | 'Review'
  | 'Aktif'
  | 'Standby'
  | 'Superseded'
  | 'Arsip';

export interface UploadBatch {
  id: string;
  original_filename: string;
  chunk_count: number;
  page_count: number;
  uploaded_at: string;
  is_active_knowledge?: boolean;
  curated_count?: number;
  processed_chunks?: number;
  // PRD v2.0 Enterprise KMS & ABAC fields:
  owner_id?: string | null;
  division_id?: string;
  classification?: DocumentClassification;
  status?: DocumentStatus;
  version?: string;
  supersedes_id?: string | null;
  effective_date?: string;
  review_due_date?: string | null;
  has_user_grant?: boolean;
}

export interface DocumentGrant {
  id: string | number;
  upload_batch_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_department: string;
  user_role_id: string;
  access_level: 'viewer' | 'editor';
  granted_by?: string | null;
  granted_by_name?: string | null;
  created_at: string;
  updated_at: string;
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
