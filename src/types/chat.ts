export interface ChatSource {
  chunkId: number | string;
  uploadBatchId: string;
  filename: string;
  pageStart: number;
  pageEnd: number;
  content: string;
  similarity: number;
}

export interface ChatMessageVariant {
  text: string;
  sources?: ChatSource[];
  timestamp?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  sources?: ChatSource[];
  timestamp: string;
  isError?: boolean;
  variants?: ChatMessageVariant[];
  currentVariantIndex?: number;
}

export interface ChatRequestPayload {
  query: string;
  documentId?: string;
  allowPublicKnowledge?: boolean;
  bypassCache?: boolean;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    department?: string;
  };
  sessionId?: string;
}

export interface ChatResponsePayload {
  answer: string;
  sources: ChatSource[];
  allowPublicKnowledge: boolean;
  retrievedCount: number;
  error?: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  is_pinned: boolean;
  last_shared_message_id?: string | null;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

