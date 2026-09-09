export type InsightImportance = 'high' | 'medium' | 'low';

export interface CuratedInsightItem {
  id: number | string;
  upload_batch_id: string;
  title: string;
  content: string;
  importance: InsightImportance;
  category: string;
  tags: string[];
  source_pages: string;
  source_chunk_id?: number | string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CurateGenerationResult {
  message: string;
  insights: CuratedInsightItem[];
  count: number;
}
