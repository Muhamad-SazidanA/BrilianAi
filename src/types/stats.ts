import { UploadBatch } from './document';

export interface RecentLogin {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  avatarColor: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AttentionSummary {
  pendingUsersCount: number;
  pendingUsers: { id: string; name: string; email: string; createdAt: string }[];
  knowledgeGapsCount: number;
  recentGaps: { id: string; queryText: string; createdAt: string }[];
  negativeFeedbackCount: number;
  errorCount: number;
}

export interface TrendPoint {
  date: string;
  label: string;
  current: number;
  previous: number;
}

export interface ActivityTrend {
  points: TrendPoint[];
  totalCurrent: number;
  totalPrevious: number;
  changePercentage: number;
  topTopics: { topic: string; count: number; percentage: number }[];
}

export interface PersonalStats {
  totalSessions: number;
  totalQueries: number;
  lastActiveSession?: { id: string; title: string; updatedAt: string };
}

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
    multiAgent?: {
      geminiVision: boolean;
      openAiEmbedding: boolean;
      deepseekSynthesizer: boolean;
    };
  };
  recentBatches: UploadBatch[];
  recentLogins?: RecentLogin[];
  attention?: AttentionSummary;
  trend?: ActivityTrend;
  personal?: PersonalStats;
}
