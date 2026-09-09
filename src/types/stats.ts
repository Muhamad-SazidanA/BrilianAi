import { UploadBatch } from './document';

export interface DashboardStats {
  totalDocuments: number;
  totalChunks: number;
  totalPages: number;
  activeKnowledgeCount: number;
  systemHealth: {
    postgres: boolean;
    ollama: boolean;
    visionModel: string;
    embeddingModel: string;
  };
  recentBatches: UploadBatch[];
}
