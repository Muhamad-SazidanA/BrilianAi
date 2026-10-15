# 🚀 Katalog AI Agents Produktivitas & Operasional Korporat (BrilianAi)

Dokumen ini adalah cetak biru teknis dan fungsional untuk **koleksi AI Agent operasional** di luar sekadar pelaporan berkala. Agen-agen ini dirancang untuk **langsung dipakai oleh staf, manajer, tim operasional, sales, legal, dan pimpinan**, memberikan nilai nyata (*tangible value*) yang langsung terasa mempermudah pekerjaan sehari-hari.

---

## 📑 DAFTAR ISI AGENT OPERASIONAL
1. [Agent 1: Reviewer Kontrak & Analisis Risiko Legal (Legal Contract Auditor)](#1-reviewer-kontrak--analisis-risiko-legal-legal-contract-auditor)
2. [Agent 2: Asisten Notula Rapat & Task Extractor (Meeting MoM & Action Tracker)](#2-asisten-notula-rapat--task-extractor-meeting-mom--action-tracker)
3. [Agent 3: Asisten Tender, RFP & Proposal Generator (Tender & Proposal Copilot)](#3-asisten-tender-rfp--proposal-generator-tender--proposal-copilot)
4. [Agent 4: Auditor Kesiapan Inspeksi & Kepatuhan ISO/Regulasi (Compliance & Audit Inspector)](#4-auditor-kesiapan-inspeksi--kepatuhan-isoregulasi-compliance--audit-inspector)
5. [Agent 5: Konsultan Kebijakan Karyawan & Onboarding Buddy (HR Policy & Onboarding Buddy)](#5-konsultan-kebijakan-karyawan--onboarding-buddy-hr-policy--onboarding-buddy)
6. [Agent 6: Asisten Penawaran Sales & Balasan Klien WhatsApp (Sales & Quotation Agent)](#6-asisten-penawaran-sales--balasan-klien-whatsapp-sales--quotation-agent)
7. [Agent 7: Penanganan Insiden & Troubleshooting Lapangan (Incident & Runbook Copilot)](#7-penanganan-insiden--troubleshooting-lapangan-incident--runbook-copilot)
8. [Agent 8: Riset Pasar & Intelijen Kompetitor (Competitive & Market Intelligence Agent)](#8-riset-pasar--intelijen-kompetitor-competitive--market-intelligence-agent)
9. [Agent 9: Pembuat Materi Pelatihan & Kuis SOP Interaktif (Learning & SOP Quiz Creator)](#9-pembuat-materi-pelatihan--kuis-sop-interaktif-learning--sop-quiz-creator)
10. [Matriks Perbandingan, Frekuensi, & Nilai Bisnis](#10-matriks-perbandingan-frekuensi--nilai-bisnis)
11. [Rekomendasi Struktur Kode Bersih untuk Re-Coding](#11-rekomendasi-struktur-kode-bersih-untuk-re-coding)

---

## 1. Reviewer Kontrak & Analisis Risiko Legal (Legal Contract Auditor)

### 🔴 Masalah Pengguna
Karyawan atau manajer sering menerima draf kontrak (MoU, Perjanjian Kerja Sama/PKS, Non-Disclosure Agreement, Kontrak Vendor) setebal 20–60 halaman. Membaca pasal demi pasal memakan waktu berjam-jam, dan berisiko tinggi melewatkan **klausul berbahaya** (seperti denda sepihak, termin pembayaran merugikan, klausul kerahasiaan seumur hidup, atau batasan ganti rugi yang timpang).

### 🟢 Solusi & Cara Kerja Agent
* **Input Pengguna:** Mengunggah file PDF/Word draf kontrak yang baru diterima dari pihak luar.
* **Proses Agent:**
  1. Memindai seluruh pasal kontrak secara mendalam.
  2. Membandingkan dengan **Standar Kebijakan Kontrak Internal** perusahaan yang tersimpan di pgvector BrilianAi.
  3. Mengidentifikasi klausul anomali atau tidak seimbang.
* **Output yang Dihasilkan:**
  - 🚩 **Red Flag Matrix:** Daftar pasal berisiko tinggi, sedang, dan aman.
  - ⚖️ **Analisis Pasal Bermasalah:** Penjelasan dalam bahasa lugas mengapa pasal tersebut merugikan perusahaan.
  - 💡 **Rekomendasi Klausul Revisi:** Teks pasal tandingan (*counter-clause*) yang siap dikirim kembali ke vendor/klien.
  - 📊 **Skor Kelayakan Kontrak:** (Contoh: *Skor Keamanan 68/100 — Perlu Revisi Sebelum Tanda Tangan*).

---

## 2. Asisten Notula Rapat & Task Extractor (Meeting MoM & Action Tracker)

### 🔴 Masalah Pengguna
Setelah rapat 1–2 jam, sering kali tidak ada yang sempat mencatat notula (*Minutes of Meeting / MoM*). Keputusan penting terlupakan, dan tidak jelas siapa yang bertanggung jawab mengerjakan tugas tindak lanjut (*action items*) beserta tenggat waktunya.

### 🟢 Solusi & Cara Kerja Agent
* **Input Pengguna:** Menempelkan (*paste*) rekaman transkrip Google Meet/Zoom, catatan coretan kasar peserta rapat, atau rekaman audio via WhatsApp.
* **Proses Agent:**
  1. Mengekstrak topik-topik utama yang diperdebatkan.
  2. Memisahkan antara "pembicaraan biasa" dengan "keputusan final".
  3. Mengidentifikasi penugasan tugas berdasarkan nama orang/jabatan yang disebut.
* **Output yang Dihasilkan:**
  - 📝 **Ringkasan Notula Rapat Resmi:** Format korporat siap arsip.
  - 🎯 **Tabel Matriks Action Items:** Berisi kolom: *Tugas*, *Penanggung Jawab (PIC)*, *Tenggat Waktu (Deadline)*, dan *Deliverable*.
  - 💬 **WhatsApp Blast Summary:** Teks ringkas 1 layar HP yang siap di-forward ke grup WhatsApp tim.

---

## 3. Asisten Tender, RFP & Proposal Generator (Tender & Proposal Copilot)

### 🔴 Masalah Pengguna
Saat perusahaan ingin mengikuti tender proyek pengadaan atau merespons *Request for Proposal (RFP)* dari calon klien, dokumen Kerangka Acuan Kerja (KAK / TOR) sangat tebal dan memiliki ratusan persyaratan administratif, teknis, serta kualifikasi portofolio.

### 🟢 Solusi & Cara Kerja Agent
* **Input Pengguna:** Mengunggah dokumen KAK/TOR Tender dari calon klien.
* **Proses Agent:**
  1. Membaca seluruh kualifikasi yang diwajibkan oleh pemberi tender.
  2. Mencocokkan dengan profil perusahaan, pengalaman proyek masa lalu, sertifikasi staf, dan produk di database BrilianAi (*Compliance Gap Analysis*).
  3. Menghasilkan draf awal proposal teknis dan metodologi kerja.
* **Output yang Dihasilkan:**
  - 📋 **Checklist Kelayakan Tender:** Centang hijau untuk syarat yang sudah dimiliki vs tanda silang untuk syarat yang belum terpenuhi.
  - 📄 **Draf Proposal Teknis:** Bab Pendahuluan, Pemahaman Lingkup Kerja, dan Metodologi Pelaksanaan yang disesuaikan persis dengan KAK.
  - ⏳ Menghemat waktu tim tender dari 5–7 hari kerja menjadi hitungan jam.

---

## 4. Auditor Kesiapan Inspeksi & Kepatuhan ISO/Regulasi (Compliance & Audit Inspector)

### 🔴 Masalah Pengguna
Menjelang audit tahunan (ISO 9001, ISO 27001, audit OJK, atau audit internal), seluruh divisi panik mencari bukti kepatuhan (*evidence*). Banyak dokumen kerja yang tidak sinkron dengan SOP terbaru sehingga menghasilkan temuan (*findings*).

### 🟢 Solusi & Cara Kerja Agent
* **Input Pengguna:** Memilih standar audit (misal: *Audit Mutu Internal ISO 9001*) dan melampirkan berkas operasional divisi.
* **Proses Agent:**
  1. Menguji dokumen berkas kerja divisi terhadap klausul standar ISO dan SOP internal.
  2. Menemukan titik-titik rawan: bukti serah terima yang belum bertandatangan, log pemeliharaan yang terlewat, atau nomor registrasi yang tidak standar.
* **Output yang Dihasilkan:**
  - 🛡️ **Mock Audit Report (Simulasi Hasil Audit):** Daftar potensi temuan *Major Non-Conformance*, *Minor Non-Conformance*, dan *Observation*.
  - ❓ **Daftar Pertanyaan Simulasi:** Prediksi pertanyaan yang akan diajukan auditor eksternal kepada staf divisi saat wawancara.
  - 🛠️ **Daftar Tindakan Korektif (Corrective Action Plan):** Panduan langkah cepat membereskan dokumen sebelum auditor resmi datang.

---

## 5. Konsultan Kebijakan Karyawan & Onboarding Buddy (HR Policy & Onboarding Buddy)

### 🔴 Masalah Pengguna
Karyawan baru atau lama sering kali bingung mengenai hak-hak kerja mereka (plafon klaim kacamata/rawat inap, jatah cuti melahirkan/menikah, aturan lembur, izin dinas luar kota). Menghubungi tim HR berulang kali sangat menyita waktu staf HR.

### 🟢 Solusi & Cara Kerja Agent
* **Input Pengguna:** Karyawan bertanya santai di chat atau WhatsApp:
  > *"Saya mau klaim kacamata anak, maksimal berapa rupiah ya? Dan syarat nota kwitansinya harus gimana?"*
* **Proses Agent:**
  1. Mengakses Buku Panduan Karyawan, Perjanjian Kerja Bersama (PKB), dan SOP Benefit SDM.
  2. Mengambil angka plafon yang sesuai dengan level/golongan jabatan karyawan.
* **Output yang Dihasilkan:**
  - 💡 Jawaban lugas dengan sitasi pasal resmi: *"Sesuai PKB 2024 Pasal 18 Ayat 2, plafon kacamata tanggungan anak adalah Rp 1.250.000 per 2 tahun."*
  - 📋 Daftar syarat berkas yang harus dilampirkan (resep dokter mata asli, kuitansi bermeterai).
  - 📝 Opsi pembuatan draf otomatis formulir permohonan klaim.
  - 🎒 **Onboarding Checklist:** Mengingatkan karyawan baru tentang apa saja yang harus diselesaikan pada minggu ke-1, ke-2, dan ke-4 masa percobaan.

---

## 6. Asisten Penawaran Sales & Balasan Klien WhatsApp (Sales & Quotation Agent)

### 🔴 Masalah Pengguna
Staf penjualan / Account Executive sering menerima pertanyaan mendadak dari klien di WhatsApp mengenai spesifikasi teknis produk, harga paket, SLA layanan, atau perbandingan dengan kompetitor. Menjawab lambat membuat calon klien beralih ke kompetitor.

### 🟢 Solusi & Cara Kerja Agent
* **Input Pengguna:** Sales menempelkan pesan obrolan calon klien atau mengetik:
  > *"Klien PT Maju butuh sistem cloud untuk 50 user dengan backup harian. Buatkan penawaran dan perbandingannya kalau mereka bandingin dengan provider lokal lain."*
* **Proses Agent:**
  1. Menarik data harga katalog resmi, matriks fitur, dan batasan SLA dari basis data produk.
  2. Menyusun narasi persuasif bernada bisnis profesional ramah (*consultative selling*).
* **Output yang Dihasilkan:**
  - 💬 **Draft Balasan WhatsApp:** Siap dikirim dalam hitungan detik.
  - 📄 **Tabel Rincian Penawaran Harga (Quotation):** Rincian biaya lisensi, implementasi, dan pemeliharaan.
  - 🥊 **Battlecard Kompetitor:** 3 poin keunggulan utama produk internal dibanding kompetitor spesifik yang ditanyakan klien.

---

## 7. Penanganan Insiden & Troubleshooting Lapangan (Incident & Runbook Copilot)

### 🔴 Masalah Pengguna
Ketika terjadi gangguan operasional di lapangan (misal: sistem transaksi kasir error, database cabang tidak bisa sync, atau mesin pabrik/jaringan mati mendadak), staf lapangan panik dan salah mengambil langkah karena lupa letak dokumen *Standard Operating Procedure (SOP)* atau *Disaster Recovery Plan*.

### 🟢 Solusi & Cara Kerja Agent
* **Input Pengguna:** Mengetik kode error, foto layar error, atau deskripsi singkat gejala gangguan.
* **Proses Agent:**
  1. Mencocokkan gejala dengan *Troubleshooting Runbook* dan SOP Penanganan Insiden resmi.
  2. Memberikan instruksi darurat langkah demi langkah (*step-by-step*).
* **Output yang Dihasilkan:**
  - 🚨 **Panduan Triage Darurat:** Langkah 1, 2, 3 yang aman tanpa risiko merusak data.
  - ⚠️ **Larangan Keras:** Hal-hal yang TIDAK boleh ditekan/dijalankan selama status darurat.
  - 📑 **Draf Otomatis Berita Acara Insiden:** Laporan kronologis insiden siap tanda tangan untuk eskalasi ke divisi pusat.

---

## 8. Riset Pasar & Intelijen Kompetitor (Competitive & Market Intelligence Agent)

### 🔴 Masalah Pengguna
Pimpinan divisi bisnis dan pemasaran tidak punya waktu untuk terus-menerus membaca portal berita, siaran pers regulator (BI, OJK, Kominfo, Kementerian), atau memantau pergerakan produk kompetitor.

### 🟢 Solusi & Cara Kerja Agent
* **Input Pengguna:** Konfigurasi topik minat divisi (misal: *Peraturan FinTech, Pergerakan Bunga Kredit Mikro, Produk Baru Kompetitor A/B*).
* **Proses Agent:**
  1. Bekerja secara otomatis di belakang layar menggunakan **Web Grounding**.
  2. Memfilter berita relevan dan membandingkannya dengan portofolio dokumen strategi internal.
* **Output yang Dihasilkan:**
  - 📰 **Weekly Executive Intelligence Brief:** Rangkuman 2 halaman berisi tren regulasi baru dan manuver kompetitor.
  - 🎯 **Analisis Dampak Bisnis:** Penjelasan singkat: *"Regulasi baru ini berpotensi memengaruhi lini produk X kita karena mewajibkan sertifikasi tambahan dalam 6 bulan ke depan."*

---

## 9. Pembuat Materi Pelatihan & Kuis SOP Interaktif (Learning & SOP Quiz Creator)

### 🔴 Masalah Pengguna
Perusahaan memiliki ratusan dokumen SOP dan manual kerja, tetapi karyawan jarang membacanya. Membuat modul pelatihan dan soal ujian sertifikasi internal secara manual sangat memakan waktu trainer / departemen People Development.

### 🟢 Solusi & Cara Kerja Agent
* **Input Pengguna:** Memilih satu dokumen SOP tebal (misal: *SOP Pelayanan Nasabah 2024 - 80 halaman*).
* **Proses Agent:**
  1. Membedah poin-poin kritis yang wajib dikuasai oleh staf.
  2. Menghasilkan ringkasan berkonsep *Micro-learning* (dapat dibaca dalam 3–5 menit).
  3. Membuat bank soal ujian interaktif berbasis studi kasus riil.
* **Output yang Dihasilkan:**
  - 📖 **Modul Ringkas Pelatihan (Cheat Sheet):** Poin inti, alur bagan, dan larangan utama.
  - 📝 **Paket Kuis Interaktif (10–20 Soal):** Pilihan ganda dan studi kasus, lengkap dengan kunci jawaban dan sitasi nomor pasal penjelasannya.

---

## 10. Matriks Perbandingan, Frekuensi, & Nilai Bisnis

| ID | Nama Agent | Target Pengguna Utama | Frekuensi Penggunaan | Nilai Bisnis Nyata (ROI) |
| :--- | :--- | :--- | :--- | :--- |
| **OP-01** | **Reviewer Kontrak Legal** | Legal, Manajer, Pengadaan | On-demand (saat ada PKS) | Mencegah klausul jebakan & denda kerugian finansial |
| **OP-02** | **Notula Rapat & Task Extractor** | Seluruh Karyawan & Manajer | Harian / Setelah Rapat | Mencegah tugas hilang, menghemat 45 menit/rapat |
| **OP-03** | **Tender & Proposal Copilot** | Tim Bisnis, Tender, Sales | Mingguan / Bulanan | Menang tender lebih cepat, potong waktu riset 80% |
| **OP-04** | **Auditor Kesiapan ISO & Audit** | Quality Assurance, Supervisor | Bulanan / Menjelang Audit | Mengurangi temuan audit mayor/minor eksternal |
| **OP-05** | **HR Policy & Onboarding Buddy** | Seluruh Karyawan, Karyawan Baru | Harian (kapan saja) | Memangkas 70% beban tanya-jawab tim HR |
| **OP-06** | **Sales Quotation & WhatsApp Agent** | Sales Rep, Account Executive | Harian (saat ada prospek) | Waktu respons klien < 1 menit, konversi penjualan naik |
| **OP-07** | **Troubleshooting Runbook Copilot** | Staf Operasional, IT Support | Event-driven (saat insiden) | Mempercepat pemulihan sistem (MTTR) hingga 50% |
| **OP-08** | **Intelijen Pasar & Regulasi** | Direksi, Tim Strategis | Mingguan (otomatis) | Deteksi dini regulasi baru & ancaman kompetitor |
| **OP-09** | **Pembuat Modul & Kuis SOP** | HR Trainer, Compliance Officer | Bulanan / Saat SOP rilis | Meningkatkan kepatuhan karyawan terhadap SOP resmi |

---

## 11. Rekomendasi Struktur Kode Bersih untuk Re-Coding

Untuk menambahkan agen-agen operasional ini ke dalam proyek BrilianAi tanpa mengacaukan kode yang sudah ada:

```
lib/
├── agents/
│   ├── operational/
│   │   ├── ContractReviewerAgent.ts       # OP-01: Bedah pasal & red flags
│   │   ├── MeetingMinutesAgent.ts         # OP-02: Transkrip ke MoM & tasks
│   │   ├── TenderProposalAgent.ts         # OP-03: KAK / TOR gap analysis
│   │   ├── ComplianceAuditAgent.ts        # OP-04: Simulasi audit ISO
│   │   ├── HrPolicyBuddyAgent.ts          # OP-05: Buku panduan karyawan & hak cuti
│   │   ├── SalesQuotationAgent.ts         # OP-06: Penawaran cepat & WhatsApp
│   │   ├── IncidentRunbookAgent.ts        # OP-07: Triage darurat & SOP insiden
│   │   ├── MarketIntelligenceAgent.ts     # OP-08: Web grounding tren industri
│   │   └── SopQuizCreatorAgent.ts         # OP-09: Generator micro-learning & soal kuis
src/
├── app/
│   ├── studio/                            # Ruang Kerja Agent di Web UI
│   │   ├── contract-audit/page.tsx        # UI Review Kontrak
│   │   ├── meeting-notes/page.tsx         # UI Transkrip Rapat
│   │   ├── tender-copilot/page.tsx        # UI Bantuan Tender
│   │   └── sop-quiz/page.tsx              # UI Kuis Interaktif
```

---

> Dokumen ini adalah pelengkap fungsional praktis dari cetak biru arsitektur teknis sebelumnya. Setiap agen dirancang untuk menyelesaikan satu masalah kerja spesifik yang nyata di lingkungan korporat.
