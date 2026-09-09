export interface ChatSource {
  chunkId: number | string;
  uploadBatchId: string;
  filename: string;
  pageStart: number;
  pageEnd: number;
  content: string;
  similarity: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  sources?: ChatSource[];
  timestamp: string;
  isError?: boolean;
}

export interface ChatRequestPayload {
  query: string;
  documentId?: string;
  allowPublicKnowledge?: boolean;
}

export interface ChatResponsePayload {
  answer: string;
  sources: ChatSource[];
  allowPublicKnowledge: boolean;
  retrievedCount: number;
  error?: string;
}
