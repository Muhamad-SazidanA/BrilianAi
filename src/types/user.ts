export type PermissionKey =
  | 'documents:read'
  | 'documents:upload'
  | 'documents:toggle_active'
  | 'documents:delete'
  | 'curation:trigger'
  | 'curation:edit'
  | 'curation:delete'
  | 'chat:query'
  | 'chat:export'
  | 'users:manage'
  | 'roles:manage'
  | 'audit:read';

export type PermissionCategory = 'documents' | 'curation' | 'chat' | 'administration';

export interface PermissionDefinition {
  key: PermissionKey;
  labelId: string;
  labelEn: string;
  descId: string;
  descEn: string;
  category: PermissionCategory;
}

export const PERMISSIONS_CATALOG: PermissionDefinition[] = [
  // Documents
  {
    key: 'documents:read',
    category: 'documents',
    labelId: 'Lihat Dokumen',
    labelEn: 'View Documents',
    descId: 'Melihat repositori dokumen & cuplikan intisari',
    descEn: 'Browse document repository and chunk previews',
  },
  {
    key: 'documents:upload',
    category: 'documents',
    labelId: 'Upload Dokumen',
    labelEn: 'Upload Documents',
    descId: 'Mengunggah file PDF ke pipeline ingestion & pgvector',
    descEn: 'Upload PDF files to ingestion pipeline & pgvector',
  },
  {
    key: 'documents:toggle_active',
    category: 'documents',
    labelId: 'Aktif / Nonaktifkan Dokumen',
    labelEn: 'Toggle Active Knowledge',
    descId: 'Mengubah status dokumen aktif/standby untuk RAG',
    descEn: 'Toggle document active/standby state for RAG',
  },
  {
    key: 'documents:delete',
    category: 'documents',
    labelId: 'Hapus Dokumen',
    labelEn: 'Delete Documents',
    descId: 'Menghapus dokumen dan seluruh chunk dari database',
    descEn: 'Delete document batch and chunks from database',
  },

  // Curation
  {
    key: 'curation:trigger',
    category: 'curation',
    labelId: 'Mulai Kurasi AI',
    labelEn: 'Trigger AI Curation',
    descId: 'Menjalankan ekstraksi intisari kurasi AI mandiri',
    descEn: 'Run AI curated insights extraction on chunks',
  },
  {
    key: 'curation:edit',
    category: 'curation',
    labelId: 'Sunting Intisari Kurasi',
    labelEn: 'Edit Curated Insights',
    descId: 'Memperbaiki teks intisari & metadata insight terkurasi',
    descEn: 'Modify insight content & curated metadata',
  },
  {
    key: 'curation:delete',
    category: 'curation',
    labelId: 'Hapus Intisari Kurasi',
    labelEn: 'Delete Curated Insights',
    descId: 'Menghapus insight terkurasi dari database',
    descEn: 'Remove curated insight records from database',
  },

  // Chat
  {
    key: 'chat:query',
    category: 'chat',
    labelId: 'Bertanya ke Chatbot AI',
    labelEn: 'Ask AI Chatbot',
    descId: 'Mengirimkan pertanyaan ke model Llama & pgvector RAG',
    descEn: 'Send queries to Llama model & pgvector RAG',
  },
  {
    key: 'chat:export',
    category: 'chat',
    labelId: 'Ekspor Riwayat Chat',
    labelEn: 'Export Chat History',
    descId: 'Menyimpan dan mengunduh riwayat percakapan',
    descEn: 'Export and download conversation history',
  },

  // Administration
  {
    key: 'users:manage',
    category: 'administration',
    labelId: 'Kelola Pengguna',
    labelEn: 'Manage Users',
    descId: 'Menambah, menyunting, mengaktifkan/menonaktifkan akun user',
    descEn: 'Create, edit, toggle active, and manage user accounts',
  },
  {
    key: 'roles:manage',
    category: 'administration',
    labelId: 'Kelola Role & Hak Akses',
    labelEn: 'Manage Roles & RBAC',
    descId: 'Menentukan matriks perizinan dan membuat role kustom',
    descEn: 'Configure permission matrix and create custom roles',
  },
  {
    key: 'audit:read',
    category: 'administration',
    labelId: 'Lihat Audit Log Percakapan',
    labelEn: 'View Chat Audit Logs',
    descId: 'Melihat aktivitas dan riwayat chat seluruh pengguna',
    descEn: 'Inspect query volume, topics, and full chat audit logs',
  },
];

export interface Role {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  permissions: PermissionKey[];
  created_at?: string;
  updated_at?: string;
  user_count?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role_id: string;
  role?: Role;
  status: 'active' | 'inactive';
  department?: string;
  avatar_color?: string;
  last_login_at?: string;
  created_at?: string;
  updated_at?: string;
  question_count?: number;
}

export interface ChatAuditLog {
  id: string;
  session_id: string;
  user_id?: string | null;
  user_name: string;
  user_email: string;
  user_department?: string | null;
  query_text: string;
  topic: string;
  answer_excerpt?: string | null;
  sources_used: any[];
  retrieved_count: number;
  created_at: string;
}

export interface TopActiveUser {
  user_id: string;
  name: string;
  email: string;
  department?: string;
  avatar_color?: string;
  role_id?: string;
  role_name?: string;
  total_queries: number;
  last_active?: string;
  top_topics: string[];
}

export interface AuditAnalyticsSummary {
  total_conversations: number;
  total_active_users: number;
  top_topics: { topic: string; count: number }[];
  top_users: TopActiveUser[];
}
