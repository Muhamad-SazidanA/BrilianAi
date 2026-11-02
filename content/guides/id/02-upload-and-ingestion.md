---
title: "Upload & Ingestion Dokumen"
description: "Alur pemrosesan berkas PDF, Word, Excel, dan CSV, ekstraksi AI Vision OCR, pemotongan sliding window, dan penyimpanan vektor pgvector."
---

Pipeline Ingestion Brilian.Ai memproses berkas korporat mentah menjadi representasi semantik terstruktur yang siap dicari secara instan oleh kecerdasan buatan.

---

## 1. Format Berkas yang Didukung

Sistem mendukung 4 kategori dokumen operasional bisnis:
1. **PDF (`.pdf`)**: Dokumen laporan, SOP, regulasi, dan manual teknis. Mendukung PDF digital maupun PDF hasil pemindaian (*scanned images*).
2. **Microsoft Word (`.docx`, `.doc`)**: Format surat dinas, kontrak, dan draft naskah kerja.
3. **Microsoft Excel (`.xlsx`, `.xls`)**: Format spreadsheet laporan keuangan, tabel inventaris, dan rekap data.
4. **CSV (`.csv`)**: Data tabular terstruktur ekspor database.

---

## 2. Cara Mengunggah Dokumen

1. Klik tombol **Upload PDF** di header navigasi atas atau buka menu **Ingestion & Upload** (`/upload`).
2. Tarik berkas ke area dropzone atau klik untuk memilih berkas dari komputer Anda (maksimum 50 MB per berkas).
3. Tentukan metadata dokumen:
   - **Departemen Pemilik**: Pilih divisi terkait (misal: Keuangan, HR, Operasional).
   - **Tingkat Kerahasiaan (Klasifikasi)**: Pilih antara *Publik, Internal, Rahasia,* atau *Sangat Rahasia*.
4. Klik **Mulai Unggah & Ingest**.

---

## 3. Pipeline Pemrosesan 4 Tahap

Setelah berkas diterima, sistem mengeksekusi pipeline otomatis:
- **Tahap 1: Ekstraksi Teks Multi-Format**:
  Mengekstrak teks halaman demi halaman. Jika halaman berupa gambar atau scan beresolusi rendah, sistem secara otomatis mengaktifkan modul **Brilian Vision OCR Engine** untuk membaca teks secara presisi.
- **Tahap 2: Sliding-Window Chunking**:
  Teks dipotong menjadi unit informasi berukuran 800 karakter dengan overlap 150 karakter. Setiap chunk mempertahankan informasi nomor halaman sumber (*source page tracking*) agar sitasi selalu akurat.
- **Tahap 3: Embedding Vektor 1024-Dimensi**:
  Setiap chunk dikonversi menjadi representasi vektor numerik 1024-dimensi untuk menangkap makna semantik kalimat.
- **Tahap 4: Penyimpanan ke pgvector**:
  Chunk dan vektor disimpan ke tabel PostgreSQL `document_chunks` dengan indeks cosine pgvector untuk pencarian ultra-cepat (<50ms).

