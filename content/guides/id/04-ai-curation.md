---
title: "AI Curation Studio"
description: "Kurasi wawasan otomatis (Zero-Token Tabular Engine), ekstraksi fakta kunci per halaman, dan verifikasi status kurasi."
---

Modul **Curation Studio** (`/documents/[id]`) adalah keunggulan utama Brilian.Ai yang menjamin jawaban AI bebas halusinasi. Melalui kurasi, dokumen diurai menjadi fakta terverifikasi sebelum dijadikan bahan acuan.

---

## 1. Konsep Dual-Chunk (Konten Mentah vs Insight Terkurasi)

Saat dokumen diproses, Brilian.Ai memisahkan penyimpanan data menjadi 2 lapisan:
1. **Raw Document Chunks**: Potongan teks utuh dari berkas asli yang diindeks ke pgvector.
2. **Curated Insights**: Rangkuman fakta penting, poin keputusan, klausul hukum, atau angka penting yang telah diverifikasi manusia atau AI.

> **Prioritas Grounding:** Saat pengguna mengajukan pertanyaan di AI Assistant, sistem mencari *Curated Insights* terlebih dahulu. Jika ditemukan kecocokan, insight tersebut dijadikan acuan utama dengan bobot paling tinggi.

---

## 2. Zero-Token Tabular Curation Engine

Khusus berkas spreadsheet **Excel (`.xlsx`)** dan **CSV**:
- Sistem menjalankan mesin kurasi deterministik otomatis tanpa mengonsumsi kuota token LLM (0 Token / Bebas Biaya API).
- Mesin secara otomatis mendeteksi kolom keuangan (Pendapatan, Biaya, Saldo), membuat metadata ringkasan, dan mengaktifkan dokumen secara instan tanpa menunggu proses manual.

---

## 3. Menjalankan Kurasi Manual & AI

Pada dokumen teks atau PDF:
1. Buka halaman detail dokumen di Knowledge Base (`/documents/[id]`).
2. Pilih tab **AI Curation**.
3. Anda dapat:
   - **Trigger Kurasi Otomatis AI**: AI menganalisis setiap halaman dan merangkum poin-poin penting.
   - **Tambah Insight Manual**: Tuliskan fakta spesifik, tandai nomor halaman sumber, dan tetapkan tag kategori.
4. Tandai status insight sebagai **Verified (Terverifikasi)** untuk memastikan validitas hukum atau operasional data.

