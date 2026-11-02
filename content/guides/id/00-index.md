---
title: "Memulai dengan Brilian.Ai"
description: "Panduan pengenalan platform Knowledge Base enterprise, AI Ingestion dokumen, dan AI Copilot terkurasi berbasis pgvector."
---

Selamat datang di **Pusat Bantuan Brilian.Ai**! Platform ini dirancang untuk enterprise dan korporat dalam mengotomatisasi pemahaman dokumen, ekstraksi insight berbasis AI Vision OCR, kurasi data, hingga konsultasi tanya-jawab (*Retrieval-Augmented Generation / RAG*) dengan perlindungan keamanan data tingkat tinggi (*Zero Data Retention*).

[Read this guide in English](/docs/en/00-index)

---

## Alur Kerja Utama Sistem

Untuk memanfaatkan fitur platform secara optimal, berikut urutan alur kerja yang direkomendasikan:

1. **Autentikasi & Masuk Akun**: Akses kredensial workspace Anda melalui halaman login aman atau passkey.
2. **Ingestion & Upload Dokumen**: Unggah dokumen kerja (*PDF, Word .docx, Excel .xlsx, atau CSV*). Dokumen diproses otomatis melalui pipeline ekstraksi teks dan AI Vision OCR presisi tinggi.
3. **Repositori Knowledge Base**: Kelola status aktifasi pengetahuan dokumen (*Toggle Active Knowledge*) dan tetapkan klasifikasi keamanan (*Publik, Internal, Rahasia, Sangat Rahasia*).
4. **AI Curation Studio**: Tinjau hasil kurasi wawasan otomatis (Zero-Token Tabular Engine) atau kurasi manual per halaman untuk menghasilkan fakta terverifikasi.
5. **AI Assistant (Chat RAG)**: Lakukan diskusi, tanya jawab kebijakan, analisis data dengan sitasi kutipan sumber asli dan format tabel Markdown otomatis.
6. **AI Dynamic Dashboard**: Bangun visualisasi widget analitik dinamis dengan interaksi *draggable & 2D resizable card* serta Copilot Canvas.
7. **Tata Kelola & Audit**: Super Administrator dapat mengelola persetujuan pengguna, matriks hak akses peran (*Role Matrix*), dan memantau rekaman jejak audit (*Audit Logs*).

---

## Daftar Bab Panduan

Jelajahi panduan lengkap berdasarkan modul sistem:

1. [Autentikasi & Keamanan Sesi](01-authentication) — Login, ganti kata sandi mandiri, reset admin, dan inactivity auto-logout 30 menit.
2. [Upload & Ingestion Dokumen](02-upload-and-ingestion) — Dukungan format PDF, Word, Excel, CSV, chunking sliding window, dan vektor embedding pgvector.
3. [Knowledge Base](03-knowledge-base) — Manajemen status dokumen aktif, klasifikasi privasi, dan pencarian repositori.
4. [AI Curation Studio](04-ai-curation) — Kurasi wawasan otomatis tanpa token (Zero-Token), peninjauan fakta per halaman, dan verifikasi status.
5. [AI Assistant & Tanya Jawab RAG](05-ai-chat) — Pencarian hybrid vector, pelacakan sitasi halaman asli, format tabel markdown, dan ekspor percakapan.
6. [Dynamic Dashboard & Copilot Canvas](06-ai-dashboard) — Visualisasi analitik, grid interaktif, layout responsif, dan generate widget AI.
7. [Manajemen Pengguna](07-user-management) — Persetujuan pendaftaran akun baru, penonaktifan akun, dan reset kredensial.
8. [Role & Matriks Hak Akses](08-roles-and-permissions) — Konfigurasi izin granular (RBAC/ABAC) dan pembatasan klasifikasi dokumen.
9. [Audit Logs & Kepatuhan Enterprise](09-audit-logs) — Pencatatan log aktivitas sistem, audit turn sesi, dan ekspor CSV/JSON.

---

## Istilah Penting Sistem

- **Active Knowledge**: Dokumen yang statusnya telah diaktifkan ke dalam memori vektor AI. Hanya dokumen berstatus aktif yang akan dijadikan referensi jawaban oleh AI Assistant.
- **pgvector 1024-d**: Basis data vektor PostgreSQL berdimensi 1024 yang menyimpan representasi semantik dari potongan dokumen (*chunks*) untuk pencarian berbasis kemiripan kosinus (*cosine distance*).
- **Curated Insights**: Fakta dan wawasan terkurasi yang diekstraksi dari dokumen. Memiliki prioritas tertinggi dalam referensi grounding AI untuk meminimalkan halusinasi.
- **ABAC (Attribute-Based Access Control)**: Mekanisme kontrol akses yang membatasi dokumen berdasarkan level kerahasiaan (*Publik, Internal, Rahasia, Sangat Rahasia*) dan departemen pengguna.
