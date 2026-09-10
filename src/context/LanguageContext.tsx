'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'id' | 'en';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  id: {
    // Nav & Sidebar
    'nav.dashboard': 'Dashboard',
    'nav.documents': 'Knowledge Base',
    'nav.upload': 'Upload Dokumen',
    'nav.chat': 'AI Assistant',
    'nav.users': 'Kelola Pengguna',
    'nav.roles': 'Role & Hak Akses',
    'nav.audit_logs': 'Audit Log Percakapan',
    'nav.close_sidebar': 'Tutup Sidebar (Collapse)',
    'nav.open_sidebar': 'Buka Sidebar (Expand)',

    // Header & Breadcrumbs
    'header.dashboard': 'Dashboard',
    'header.documents': 'Knowledge Base',
    'header.upload': 'Ingestion & Upload',
    'header.chat': 'AI Assistant',
    'header.users': 'Kelola Pengguna',
    'header.roles': 'Role & Hak Akses',
    'header.logs': 'Audit Log Percakapan',
    'header.upload_btn': 'Upload PDF',
    'header.chat_btn': 'Tanya AI',

    // User Menu & Preferences
    'user.profile': 'Profil',
    'user.preferences': 'Preferensi',
    'user.theme': 'Tema',
    'user.theme_light': 'Terang',
    'user.theme_dark': 'Gelap',
    'user.language': 'Bahasa',
    'user.lang_id': 'Indonesia',
    'user.lang_en': 'English',
    'user.help': 'Help Center',
    'user.logout': 'Keluar',
    'user.logout_confirm_title': 'Keluar dari sesi?',
    'user.logout_confirm_desc': 'Anda akan keluar dari sesi akun. Dokumen dan repositori Anda tetap tersimpan dengan aman.',
    'user.cancel': 'Batal',
    'user.done': 'Selesai',
    'user.understand': 'Mengerti',
    'user.toast_dark': 'Tema Gelap diaktifkan',
    'user.toast_light': 'Tema Terang diaktifkan',
    'user.toast_lang_id': 'Bahasa diubah ke Indonesia',
    'user.toast_lang_en': 'Language switched to English',
    'user.toast_logout': 'Sesi akun berhasil dikeluarkan.',

    // Profile Modal
    'profile.title': 'Profil Pengguna',
    'profile.role': 'Peran Akun',
    'profile.role_val': 'Administrator Workspace',
    'profile.vision': 'AI Vision Engine',
    'profile.vision_val': 'Brilian Vision OCR Engine',
    'profile.vector': 'Vektor Store',
    'profile.vector_val': 'pgvector 1024-d Cosine',
    'profile.status': 'Status Akun',
    'profile.status_val': 'Aktif & Terverifikasi',

    // Help Center Modal
    'help.title': 'Pusat Bantuan & Panduan',
    'help.subtitle': 'Dokumentasi ringkas alur kerja platform Brilian.Ai',
    'help.step1_title': '1. Ingestion Dokumen PDF',
    'help.step1_desc': 'Unggah file PDF pada menu Upload Dokumen untuk ekstraksi teks presisi tinggi menggunakan AI Vision OCR.',
    'help.step2_title': '2. Kurasi & Kelola Dokumen',
    'help.step2_desc': 'Gunakan Knowledge Base untuk meninjau status aktif dokumen, kurasi insight penting per halaman, atau rename arsip.',
    'help.step3_title': '3. Tanya AI Assistant (RAG Chat)',
    'help.step3_desc': 'Dapatkan jawaban instan berbasis konten dokumen terverifikasi, lengkap dengan sitasi nomor halaman sumber.',

    // Documents Page & Stats Cards
    'docs.title': 'Knowledge Base & Dokumen',
    'docs.subtitle': 'Kelola repositori dokumen PDF ter-ingest, status basis pengetahuan, dan vektor pgvector',
    'docs.card_published': 'DOKUMEN DITERBITKAN',
    'docs.card_published_desc': 'bisa dijawab Brilian.Ai',
    'docs.card_active': 'DOKUMEN AKTIF',
    'docs.card_active_desc': 'terhubung ke basis pengetahuan',
    'docs.card_inactive': 'DOKUMEN NON-AKTIF',
    'docs.card_inactive_desc': 'dinonaktifkan sementara',
    'docs.card_total': 'TOTAL DOKUMEN',
    'docs.card_total_desc': 'arsip seluruh dokumen PDF',

    // Document Table
    'table.search_placeholder': 'Cari berdasarkan nama file dokumen...',
    'table.filter_all': 'Semua',
    'table.filter_active': 'Dokumen Aktif',
    'table.filter_inactive': 'Dokumen Non-Aktif',
    'table.refresh': 'Segarkan',
    'table.loading': 'Memuat daftar repositori dokumen...',
    'table.empty_title': 'Belum ada dokumen tersimpan',
    'table.empty_desc': 'Mulai unggah dokumen PDF untuk mengekstrak teks via Vision OCR.',
    'table.empty_search_title': 'Tidak ada dokumen yang cocok dengan pencarian',
    'table.empty_search_desc': 'Silakan gunakan kata kunci pencarian nama file yang lain.',
    'table.col_doc': 'Dokumen',
    'table.col_pages': 'Halaman',
    'table.col_chunks': 'Chunks',
    'table.col_time': 'Waktu Ingest',
    'table.col_status': 'Basis AI (Chat)',
    'table.col_curation': 'Status Kurasi',
    'table.col_actions': 'Aksi',
    'table.status_active': 'Aktif',
    'table.status_inactive': 'Standby',
    'table.status_active_rag': 'Aktif (RAG)',
    'table.status_standby': 'Standby',
    'table.action_activate': 'Aktifkan Dokumen',
    'table.action_deactivate': 'Nonaktifkan',
    'table.curated_badge': 'Terkurasi',
    'table.uncurated_badge': 'Belum Dikurasi',
    'table.toggle_tooltip': 'Klik untuk mengubah status dokumen dalam pencarian RAG Chatbot',
    'table.rename_tooltip': 'Ubah nama dokumen',
    'table.delete_tooltip': 'Hapus dokumen',
    'table.open_studio_tooltip': 'Buka Document Studio',

    // Dashboard Home
    'dash.badge': 'AI Knowledge Platform',
    'dash.welcome_title': 'Selamat datang di Workspace Brilian.Ai',
    'dash.welcome_desc': 'Unggah dokumen PDF untuk dipindai oleh AI Vision OCR, dipotong dengan teknik sliding window, dan diindeks menjadi vektor 1024-dimensi untuk temu-balik data akurat tanpa halusinasi.',
    'dash.stat_total_docs': 'Total Dokumen',
    'dash.stat_total_docs_desc': 'Dokumen PDF di repositori',
    'dash.stat_total_chunks': 'Total Chunks',
    'dash.stat_total_chunks_desc': 'Potongan sliding window',
    'dash.stat_active_ai': 'Basis AI Aktif',
    'dash.stat_active_ai_desc': 'Terhubung ke RAG Chatbot',
    'dash.stat_total_pages': 'Total Halaman',
    'dash.stat_total_pages_desc': 'Dipindai Vision OCR',
    'dash.recent_title': 'Dokumen Terbaru',
    'dash.recent_subtitle': '5 batch dokumen terakhir yang telah selesai di-ingest ke sistem',
    'dash.see_all': 'Lihat semua',
    'dash.empty_recent_title': 'Belum ada dokumen di repositori',
    'dash.empty_recent_desc': 'Unggah file PDF pertama Anda untuk mengaktifkan ekstraksi AI Vision dan RAG chat.',
    'dash.start_upload': 'Mulai Upload PDF',
    'dash.upload_new': 'Upload Dokumen Baru',
    'dash.manage_docs': 'Kelola Dokumen',
    'dash.pipeline_title': 'Pipeline & Layanan AI',
    'dash.loading_activity': 'Memuat aktivitas dokumen...',
    'dash.safety_buffer': '100% In-memory Buffer, aman tanpa penyimpanan file PDF fisik ke disk.',

    // Chat
    'chat.title': 'AI Assistant',
    'chat.subtitle': 'Tanya jawab cerdas berbasis dokumen dengan sitasi nomor halaman terverifikasi',
    'chat.welcome': 'Halo! Saya Brilian.Ai Assistant. Tanyakan apa saja seputar dokumen yang telah ter-ingest ke basis pengetahuan pgvector Anda.',
    'chat.context_label': 'Konteks Dokumen:',
    'chat.context_all': 'Seluruh Basis Pengetahuan Aktif',
    'chat.allow_public': 'Izinkan pengetahuan umum jika data kosong',
    'chat.reset_btn': 'Reset Chat',
    'chat.reset_confirm': 'Bersihkan riwayat percakapan?',
    'chat.reset_msg': 'Riwayat percakapan telah dibersihkan. Silakan ajukan pertanyaan baru.',
    'chat.placeholder': 'Tanyakan informasi seputar dokumen yang telah ter-ingest... (Tekan Enter)',
    'chat.send': 'Kirim',
    'chat.thinking': 'AI sedang mencari konteks relevan dan menyusun jawaban via pgvector RAG...',
    'chat.example_questions': 'Contoh Pertanyaan:',
    'chat.q1': 'Apa ringkasan utama isi dokumen ini?',
    'chat.q2': 'Tampilkan data angka penting atau statistik.',
    'chat.q3': 'Siapa saja pihak atau unit yang disebutkan?',
    'chat.q4': 'Jelaskan poin kesimpulan dan rekomendasi.',
    'chat.verified_sources': 'Sumber Terverifikasi:',
    'chat.drawer_title': 'Inspeksi Dokumen Sumber',
    'chat.drawer_badge': 'Sitasi Sumber Terverifikasi',
    'chat.original_text': 'Teks Asli dari Dokumen:',
    'chat.drawer_footnote': 'Jawaban AI didasarkan pada potongan dokumen di atas menggunakan pencarian vektor cosinus 1024 dimensi.',

    'chat.you': 'Anda',
    'chat.assistant': 'Brilian.Ai Assistant',
    'chat.page_abbr': 'Hal',
    'chat.click_citation': 'Klik untuk membuka drawer teks kutipan asli',

    // Upload
    'upload.title': 'Ingestion & Upload Hub',
    'upload.subtitle': 'Unggah dokumen PDF untuk dipindai oleh AI Vision dan di-indeks ke pgvector',
    'upload.success_title': 'Ingestion Berhasil',
    'upload.open_studio': 'Buka di Studio',
    'upload.drop_title': 'Tarik & lepaskan file PDF di sini',
    'upload.drop_subtitle': 'atau klik untuk memilih dokumen dari komputer Anda',
    'upload.badge_slides': 'Slide Presentasi',
    'upload.badge_scan': 'Dokumen Scan',
    'upload.badge_report': 'Laporan Teknis',
    'upload.pipeline_title': 'Pipeline Ingestion AI Vision',
    'upload.pipeline_subtitle': 'Prinsip ekstraksi bertahap dari dokumen fisik ke dense vector pgvector',
    'upload.processing': 'Sedang Berjalan...',
    'upload.live_process': 'Proses Live:',
    'upload.step1_title': 'In-Memory Render',
    'upload.step1_desc': 'PDF dirender ke gambar tanpa disimpan ke disk',
    'upload.step2_title': 'Vision OCR Engine',
    'upload.step2_desc': 'AI Vision mengekstrak teks tiap halaman',
    'upload.step3_title': 'Sliding Window',
    'upload.step3_desc': 'Chunking 800 char dengan overlap 150',
    'upload.step4_title': 'Dense Vector Embedding',
    'upload.step4_desc': 'Vector 1024-dim disimpan ke pgvector',

    // Studio & Tabs
    'studio.title': 'Document Studio',
    'studio.subtitle': 'Inspeksi detail chunks, kurasi AI, dan spesifikasi vektor dokumen',
    'studio.back_to_docs': 'Daftar Dokumen',
    'studio.ask_doc': 'Tanya Dokumen Ini',
    'studio.tab_chunks': 'Raw Chunks',
    'studio.tab_curation': 'Curated Insights',
    'studio.tab_metadata': 'Spesifikasi & Metadata',
    'studio.active_badge': 'Basis AI Aktif',
    'studio.standby_badge': 'Standby',
    'studio.pages': 'Halaman',
    'studio.chunks': 'Chunks',

    // Chunks Tab
    'chunks.subtitle': 'Potongan teks sliding window (800 char / 150 overlap) dengan pelacakan rentang halaman',
    'chunks.search_placeholder': 'Cari dalam teks chunk...',
    'chunks.loading': 'Memuat chunk...',
    'chunks.empty_search': 'Tidak ada chunk yang cocok dengan pencarian',
    'chunks.empty': 'Belum ada chunk pada dokumen ini',
    'chunks.page': 'Halaman',
    'chunks.chars': 'Karakter',
    'chunks.copy': 'Salin',
    'chunks.copied': 'Tersalin',

    // Metadata Tab
    'meta.title': 'Spesifikasi & Metadata Teknis Dokumen',
    'meta.subtitle': 'Parameter inferensi, metrik token, dan penyimpanan pgvector',
    'meta.batch_id': 'Batch ID (UUID)',
    'meta.filename': 'Nama File Asli',
    'meta.completed': 'Waktu Ingestion Selesai',
    'meta.pages': 'Jumlah Halaman',
    'meta.chunks': 'Jumlah Chunks',
    'meta.ratio': 'Rasio Chunks/Halaman',
    'meta.avg_len': 'Rata-rata Panjang Chunk',
    'meta.vision': 'Model AI Vision',
    'meta.embedding': 'Model AI Embedding',
    'meta.vector_db': 'Index Database',

    // Curated Insights & Editor
    'curate.subtitle': 'Ekstraksi fakta, poin penting, dan sintesis terstruktur dari dokumen',
    'curate.export_json': 'Export JSON',
    'curate.export_csv': 'CSV',
    'curate.add_manual': 'Tambah Manual',
    'curate.run_ai': 'Jalankan AI Curation',
    'curate.running_ai': 'AI Mengurasi...',
    'curate.loading': 'Memuat insight...',
    'curate.empty': 'Belum ada insight terkurasi',
    'curate.empty_desc': 'Klik tombol "Jalankan AI Curation" di atas untuk mengekstrak poin penting secara otomatis via LLM.',
    'curate.page': 'Halaman',
    'insight.title_edit': 'Edit Curated Insight',
    'insight.title_create': 'Tambah Curated Insight Baru',
    'insight.field_title': 'Judul Insight',
    'insight.importance': 'Tingkat Kepentingan',
    'insight.importance_high': 'Tinggi (High)',
    'insight.importance_med': 'Sedang (Medium)',
    'insight.importance_low': 'Rendah (Low)',
    'insight.source_pages': 'Halaman Sumber',
    'insight.content': 'Isi & Poin Penting (Sintesis / Key Takeaways)',
    'insight.tags': 'Tags (pisahkan dengan koma)',
    'insight.cancel': 'Batal',
    'insight.save': 'Simpan Perubahan',
    'insight.saving': 'Menyimpan...',

    // Rename
    'rename.title': 'Ubah Nama Dokumen',
    'rename.label': 'Nama File Dokumen',
    'rename.cancel': 'Batal',
    'rename.saving': 'Menyimpan...',
    'rename.save': 'Simpan Perubahan',
  },
  en: {
    // Nav & Sidebar
    'nav.dashboard': 'Dashboard',
    'nav.documents': 'Knowledge Base',
    'nav.upload': 'Upload Document',
    'nav.chat': 'AI Assistant',
    'nav.users': 'User Management',
    'nav.roles': 'Roles & Permissions',
    'nav.audit_logs': 'Chat Audit Logs',
    'nav.close_sidebar': 'Collapse Sidebar',
    'nav.open_sidebar': 'Expand Sidebar',

    // Header & Breadcrumbs
    'header.dashboard': 'Dashboard',
    'header.documents': 'Knowledge Base',
    'header.upload': 'Ingestion & Upload',
    'header.chat': 'AI Assistant',
    'header.users': 'User Management',
    'header.roles': 'Roles & Permissions',
    'header.logs': 'Chat Audit Logs',
    'header.upload_btn': 'Upload PDF',
    'header.chat_btn': 'Ask AI',

    // User Menu & Preferences
    'user.profile': 'Profile',
    'user.preferences': 'Preferences',
    'user.theme': 'Theme',
    'user.theme_light': 'Light',
    'user.theme_dark': 'Dark',
    'user.language': 'Language',
    'user.lang_id': 'Indonesian',
    'user.lang_en': 'English',
    'user.help': 'Help Center',
    'user.logout': 'Sign Out',
    'user.logout_confirm_title': 'Sign out of session?',
    'user.logout_confirm_desc': 'You will be signed out of your account. Your documents and repositories will remain safely stored.',
    'user.cancel': 'Cancel',
    'user.done': 'Done',
    'user.understand': 'Got it',
    'user.toast_dark': 'Dark Theme enabled',
    'user.toast_light': 'Light Theme enabled',
    'user.toast_lang_id': 'Language switched to Indonesian',
    'user.toast_lang_en': 'Language switched to English',
    'user.toast_logout': 'Signed out successfully.',

    // Profile Modal
    'profile.title': 'User Profile',
    'profile.role': 'Account Role',
    'profile.role_val': 'Workspace Administrator',
    'profile.vision': 'AI Vision Engine',
    'profile.vision_val': 'Brilian Vision OCR Engine',
    'profile.vector': 'Vector Store',
    'profile.vector_val': 'pgvector 1024-d Cosine',
    'profile.status': 'Account Status',
    'profile.status_val': 'Active & Verified',

    // Help Center Modal
    'help.title': 'Help Center & Guides',
    'help.subtitle': 'Quick workflow documentation for Brilian.Ai platform',
    'help.step1_title': '1. PDF Document Ingestion',
    'help.step1_desc': 'Upload PDF files in the Upload Document menu for high-precision text extraction via AI Vision OCR.',
    'help.step2_title': '2. Curate & Manage Documents',
    'help.step2_desc': 'Use Knowledge Base to review document active status, curate key insights per page, or rename archives.',
    'help.step3_title': '3. Ask AI Assistant (RAG Chat)',
    'help.step3_desc': 'Get verified document-grounded answers complete with source page number citations.',

    // Documents Page & Stats Cards
    'docs.title': 'Knowledge Base & Documents',
    'docs.subtitle': 'Manage ingested PDF document repositories, AI knowledge base status, and pgvector vectors',
    'docs.card_published': 'PUBLISHED DOCUMENTS',
    'docs.card_published_desc': 'can be answered by Brilian.Ai',
    'docs.card_active': 'ACTIVE DOCUMENTS',
    'docs.card_active_desc': 'connected to knowledge base',
    'docs.card_inactive': 'INACTIVE DOCUMENTS',
    'docs.card_inactive_desc': 'temporarily disabled',
    'docs.card_total': 'TOTAL DOCUMENTS',
    'docs.card_total_desc': 'all archived PDF documents',

    // Document Table
    'table.search_placeholder': 'Search by document filename...',
    'table.filter_all': 'All',
    'table.filter_active': 'Active Documents',
    'table.filter_inactive': 'Inactive Documents',
    'table.refresh': 'Refresh',
    'table.loading': 'Loading document repositories...',
    'table.empty_title': 'No documents stored yet',
    'table.empty_desc': 'Start uploading PDF documents to extract text via Vision OCR.',
    'table.empty_search_title': 'No documents match your search',
    'table.empty_search_desc': 'Please try another filename search keyword.',
    'table.col_doc': 'Document',
    'table.col_pages': 'Pages',
    'table.col_chunks': 'Chunks',
    'table.col_time': 'Ingestion Time',
    'table.col_status': 'AI Status (Chat)',
    'table.col_curation': 'Curation Status',
    'table.col_actions': 'Actions',
    'table.status_active': 'Active',
    'table.status_inactive': 'Standby',
    'table.status_active_rag': 'Active (RAG)',
    'table.status_standby': 'Standby',
    'table.action_activate': 'Activate Document',
    'table.action_deactivate': 'Deactivate',
    'table.curated_badge': 'Curated',
    'table.uncurated_badge': 'Uncurated',
    'table.toggle_tooltip': 'Click to toggle document in RAG chatbot retrieval',
    'table.rename_tooltip': 'Rename document',
    'table.delete_tooltip': 'Delete document',
    'table.open_studio_tooltip': 'Open Document Studio',

    // Dashboard Home
    'dash.badge': 'AI Knowledge Platform',
    'dash.welcome_title': 'Welcome to Brilian.Ai Workspace',
    'dash.welcome_desc': 'Upload PDF documents to be scanned by AI Vision OCR, chunked with sliding window, and indexed into 1024-dimensional vectors for accurate hallucination-free retrieval.',
    'dash.stat_total_docs': 'Total Documents',
    'dash.stat_total_docs_desc': 'PDF documents in repository',
    'dash.stat_total_chunks': 'Total Chunks',
    'dash.stat_total_chunks_desc': 'Sliding window chunks',
    'dash.stat_active_ai': 'Active AI Knowledge',
    'dash.stat_active_ai_desc': 'Connected to RAG Chatbot',
    'dash.stat_total_pages': 'Total Pages',
    'dash.stat_total_pages_desc': 'Scanned by Vision OCR',
    'dash.recent_title': 'Recent Documents',
    'dash.recent_subtitle': 'Last 5 document batches successfully ingested into the system',
    'dash.see_all': 'See all',
    'dash.empty_recent_title': 'No documents in repository yet',
    'dash.empty_recent_desc': 'Upload your first PDF file to enable AI Vision extraction and RAG chat.',
    'dash.start_upload': 'Start Upload PDF',
    'dash.upload_new': 'Upload New Document',
    'dash.manage_docs': 'Manage Documents',
    'dash.pipeline_title': 'AI Pipelines & Services',
    'dash.loading_activity': 'Loading document activity...',
    'dash.safety_buffer': '100% In-memory Buffer, secure with zero physical PDF disk persistence.',

    // Chat
    'chat.title': 'AI Assistant',
    'chat.subtitle': 'Intelligent document-grounded Q&A with verified source citations',
    'chat.welcome': 'Hello! I am Brilian.Ai Assistant. Ask me anything about documents ingested into your pgvector knowledge base.',
    'chat.context_label': 'Document Context:',
    'chat.context_all': 'All Active Knowledge Base',
    'chat.allow_public': 'Allow general knowledge if data is empty',
    'chat.reset_btn': 'Reset Chat',
    'chat.reset_confirm': 'Clear chat conversation history?',
    'chat.reset_msg': 'Conversation history has been cleared. Feel free to ask a new question.',
    'chat.placeholder': 'Ask anything about ingested documents... (Press Enter)',
    'chat.send': 'Send',
    'chat.thinking': 'AI is retrieving relevant context and generating response via pgvector RAG...',
    'chat.example_questions': 'Example Questions:',
    'chat.q1': 'What is the main summary of this document?',
    'chat.q2': 'Show key numerical data and statistics.',
    'chat.q3': 'Which parties or units are mentioned?',
    'chat.q4': 'Explain the key conclusions and recommendations.',
    'chat.verified_sources': 'Verified Sources:',
    'chat.drawer_title': 'Source Document Inspection',
    'chat.drawer_badge': 'Verified Source Citation',
    'chat.original_text': 'Original Text from Document:',
    'chat.drawer_footnote': 'AI response is grounded on the chunk excerpt above using 1024-dimensional cosine vector search.',

    'chat.you': 'You',
    'chat.assistant': 'Brilian.Ai Assistant',
    'chat.page_abbr': 'p.',
    'chat.click_citation': 'Click to view original source citation',

    // Upload
    'upload.title': 'Ingestion & Upload Hub',
    'upload.subtitle': 'Upload PDF documents for AI Vision scanning and pgvector indexing',
    'upload.success_title': 'Ingestion Successful',
    'upload.open_studio': 'Open in Studio',
    'upload.drop_title': 'Drag & drop PDF files here',
    'upload.drop_subtitle': 'or click to browse documents from your computer',
    'upload.badge_slides': 'Slide Presentation',
    'upload.badge_scan': 'Scanned Document',
    'upload.badge_report': 'Technical Report',
    'upload.pipeline_title': 'AI Vision Ingestion Pipeline',
    'upload.pipeline_subtitle': 'Staged extraction workflow from physical PDF to pgvector dense vectors',
    'upload.processing': 'In Progress...',
    'upload.live_process': 'Live Progress:',
    'upload.step1_title': 'In-Memory Render',
    'upload.step1_desc': 'PDF rendered to in-memory buffers without disk storage',
    'upload.step2_title': 'Vision OCR Engine',
    'upload.step2_desc': 'AI Vision extracts page text and tables',
    'upload.step3_title': 'Sliding Window',
    'upload.step3_desc': '800-char chunking with 150 overlap',
    'upload.step4_title': 'Dense Vector Embedding',
    'upload.step4_desc': '1024-dim dense vectors saved to pgvector',

    // Studio & Tabs
    'studio.title': 'Document Studio',
    'studio.subtitle': 'Inspect chunk details, AI curation insights, and vector specifications',
    'studio.back_to_docs': 'Document List',
    'studio.ask_doc': 'Ask This Document',
    'studio.tab_chunks': 'Raw Chunks',
    'studio.tab_curation': 'Curated Insights',
    'studio.tab_metadata': 'Specs & Metadata',
    'studio.active_badge': 'Active Knowledge Base',
    'studio.standby_badge': 'Standby',
    'studio.pages': 'Pages',
    'studio.chunks': 'Chunks',

    // Chunks Tab
    'chunks.subtitle': 'Sliding window text chunks (800 char / 150 overlap) with page tracking',
    'chunks.search_placeholder': 'Search in chunk text...',
    'chunks.loading': 'Loading chunks...',
    'chunks.empty_search': 'No chunks matching search',
    'chunks.empty': 'No chunks in this document yet',
    'chunks.page': 'Page',
    'chunks.chars': 'Characters',
    'chunks.copy': 'Copy',
    'chunks.copied': 'Copied',

    // Metadata Tab
    'meta.title': 'Document Technical Specifications & Metadata',
    'meta.subtitle': 'Inference parameters, token metrics, and pgvector storage',
    'meta.batch_id': 'Batch ID (UUID)',
    'meta.filename': 'Original Filename',
    'meta.completed': 'Ingestion Completed',
    'meta.pages': 'Page Count',
    'meta.chunks': 'Chunk Count',
    'meta.ratio': 'Chunks/Page Ratio',
    'meta.avg_len': 'Average Chunk Length',
    'meta.vision': 'AI Vision Model',
    'meta.embedding': 'AI Embedding Model',
    'meta.vector_db': 'Vector Database Index',

    // Curated Insights & Editor
    'curate.subtitle': 'Extracted facts, key takeaways, and structured synthesis from document',
    'curate.export_json': 'Export JSON',
    'curate.export_csv': 'CSV',
    'curate.add_manual': 'Add Manual',
    'curate.run_ai': 'Run AI Curation',
    'curate.running_ai': 'AI Curating...',
    'curate.loading': 'Loading insights...',
    'curate.empty': 'No curated insights yet',
    'curate.empty_desc': 'Click "Run AI Curation" above to automatically extract key insights via LLM.',
    'curate.page': 'Page',
    'insight.title_edit': 'Edit Curated Insight',
    'insight.title_create': 'Add New Curated Insight',
    'insight.field_title': 'Insight Title',
    'insight.importance': 'Importance Level',
    'insight.importance_high': 'High',
    'insight.importance_med': 'Medium',
    'insight.importance_low': 'Low',
    'insight.source_pages': 'Source Pages',
    'insight.content': 'Content & Key Takeaways (Synthesis)',
    'insight.tags': 'Tags (comma separated)',
    'insight.cancel': 'Cancel',
    'insight.save': 'Save Changes',
    'insight.saving': 'Saving...',

    // Rename
    'rename.title': 'Rename Document',
    'rename.label': 'Document Filename',
    'rename.cancel': 'Cancel',
    'rename.saving': 'Saving...',
    'rename.save': 'Save Changes',
  },
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'id',
  setLanguage: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('id');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('language_preference') as Language | null;
      if (saved === 'en' || saved === 'id') {
        setLanguageState(saved);
        document.documentElement.lang = saved;
      } else {
        setLanguageState('id');
        document.documentElement.lang = 'id';
      }
    } catch {
      // quiet fallback
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('language_preference', lang);
      document.documentElement.lang = lang;
    } catch {
      // quiet fallback
    }
  };

  const t = (key: string): string => {
    const dict = translations[language];
    if (dict && dict[key]) {
      return dict[key];
    }
    // Fallback to Indonesian if key exists there, else return key
    return translations.id[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: 'id' as Language,
      setLanguage: () => {},
      t: (k: string) => k,
    };
  }
  return context;
}
