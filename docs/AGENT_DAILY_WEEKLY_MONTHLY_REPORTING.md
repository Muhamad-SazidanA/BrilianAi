# 📋 Cetak Biru: Asisten Cerdas Pelaporan Berkala (Daily, Weekly, Monthly AI Agents)

Dokumen ini adalah spesifikasi fungsional dan teknis (*technical blueprint*) untuk membangun **Ekosistem AI Agent Pelaporan Berkala** di BrilianAi. Sistem ini dirancang dari sudut pandang **pengalaman nyata pengguna (User-Facing Experience)**: membantu karyawan, manajer, dan direksi menyusun, merekap, memvalidasi, dan mengotomasi laporan kerja harian, mingguan, dan bulanan tanpa beban administrasi yang melelahkan.

---

## 📑 DAFTAR ISI
1. [Latar Belakang & Masalah Nyata Pengguna](#1-latar-belakang--masalah-nyata-pengguna)
2. [Arsitektur 6 User-Facing Reporting Agents](#2-arsitektur-6-user-facing-reporting-agents)
   - [Agent 1: Daily Activity & Standup Reporter](#agent-1-daily-activity--standup-reporter-asisten-laporan-harian)
   - [Agent 2: Weekly Progress & KPI Consolidator](#agent-2-weekly-progress--kpi-consolidator-asisten-rekap-mingguan)
   - [Agent 3: Monthly Strategic & Performance Reviewer](#agent-3-monthly-strategic--performance-reviewer-asisten-laporan-bulanan)
   - [Agent 4: Operational Expense & Budget Auditor](#agent-4-operational-expense--budget-auditor-asisten-keuangan--spensify)
   - [Agent 5: SOP & Compliance Validator](#agent-5-sop--compliance-validator-pengawas-kepatuhan-laporan)
   - [Agent 6: Proactive Dispatcher & Reminder Bot](#agent-6-proactive-dispatcher--reminder-bot-asisten-whatsapp-proaktif)
3. [Format Baku Laporan Korporat (Standardized Output)](#3-format-baku-laporan-korporat-standardized-output)
4. [Alur Interaksi Pengguna (User Journey & Omni-Channel)](#4-alur-interaksi-pengguna-user-journey--omni-channel)
5. [Skema Database Pendukung (Data Persistence)](#5-skema-database-pendukung-data-persistence)
6. [Struktur Folder & Desain Kode Bersih (Clean Code Architecture)](#6-struktur-folder--desain-kode-bersih-clean-code-architecture)
7. [Tahapan Re-Coding Terencana (Execution Roadmap)](#7-tahapan-re-coding-terencana-execution-roadmap)

---

## 1. Latar Belakang & Masalah Nyata Pengguna

### 1.1 Masalah Administratif Karyawan & Tim
* **Penyusunan Manual Memakan Waktu:** Setiap sore atau akhir minggu, staf menghabiskan 30–60 menit hanya untuk mengingat-ingat apa yang sudah dikerjakan dan menyusunnya ke template laporan formal.
* **Format Berantakan & Inkonsisten:** Setiap staf memiliki gaya penulisan berbeda; ada yang terlalu singkat ("follow up client"), ada yang tidak terstruktur, sehingga sulit dievaluasi atasan.
* **Informasi Tercecer:** Catatan kerja tersebar di WhatsApp, to-do list pribadi, email, dan catatan rapat.
* **Rekap Mingguan & Bulanan yang Menumpuk:** Saat akhir bulan tiba, manajer pusing mengumpulkan dan merekap puluhan laporan harian dari belasan anggota tim.
* **Ketidaksesuaian dengan SOP:** Sering kali aktivitas kerja dilaporkan tanpa memperhatikan kepatuhan terhadap SOP operasional internal yang berlaku di perusahaan.

### 1.2 Solusi BrilianAI: Asisten Pelaporan Proaktif
Dengan BrilianAi, pengguna **tidak perlu lagi menulis laporan formal dari nol**:
1. Pengguna cukup mengetik chat santai, bullet point cepat, atau mengirim **Voice Note di WhatsApp**.
2. **AI Agent** otomatis merapikan menjadi laporan formal berstandar korporat.
3. Di akhir minggu dan akhir bulan, **AI Agent otomatis mengompilasi** seluruh catatan menjadi draf Laporan Mingguan & Bulanan yang komprehensif, lengkap dengan analisis KPI dan kesiapan ekspor ke PDF/Excel.

---

## 2. Arsitektur 6 User-Facing Reporting Agents

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      INPUT PENGGUNA (OMNICHANNEL)                      │
 │   • Chat Santai / Bullet Point Web UI       • Voice Note WhatsApp      │
 │   • Unggahan Struk / Nota Biaya             • Dokumen Target KPI       │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                 AGENT 1: Daily Activity Reporter                       │
 │  - Normalisasi bahasa santai/voice note jadi Laporan Harian Formal     │
 │  - Kategorisasi tugas (Selesai, On-Progress, Kendala, Rencana Besok)    │
 └─────────────────┬───────────────────────────────────┬──────────────────┘
                   │ Disimpan per hari                 │ Validasi SOP
                   ▼                                   ▼
 ┌───────────────────────────────────┐   ┌────────────────────────────────┐
 │ AGENT 2: Weekly Progress Consolidator │ AGENT 5: SOP & Compliance Validator
 │ - Mengompilasi 5 log harian       │ │ - Memeriksa kepatuhan aktivitas │
 │ - Analisis capaian vs Target KPI  │ │   terhadap dokumen SOP di RAG    │
 └─────────────────┬─────────────────┘   └────────────────────────────────┘
                   │ Disimpan per minggu
                   ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ AGENT 3: Monthly Strategic Reviewer (Executive Brief)                  │
 │ - Kompilasi 4 laporan mingguan + data divisi / keuangan               │
 │ - Executive Summary untuk Direksi, Analisis MoM, Risiko, & Solusi     │
 └─────────────────┬──────────────────────────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
 ┌─────────────────┐ ┌────────────────────────────────────────────────────┐
 │ AGENT 4:        │ │ AGENT 6: Proactive Dispatcher & Reminder Bot       │
 │ Expense Auditor │ │ - WhatsApp Cron: Jam 16:30 tanya progres harian    │
 │ - Rekap biaya   │ │ - Jumat 16:00: Kirim draf laporan mingguan         │
 │ - Audit budget  │ │ - Akhir Bulan: Kirim draf laporan bulanan          │
 └─────────────────┘ └────────────────────────────────────────────────────┘
```

---

### Agent 1: Daily Activity & Standup Reporter (Asisten Laporan Harian)
* **Peran Pengguna:** Teman kerja harian yang membantu mencatat aktivitas kerja tanpa ribet.
* **Cara Interaksi Pengguna:**
  - Pengguna membuka Web Chat atau mengirim pesan WhatsApp:
    > *"Tadi pagi meeting koordinasi dengan vendor IT soal integrasi API jam 9-11. Siangnya ngerjain draft SOP audit bab 3 sampe tuntas. Tapi verifikasi dokumen keuangan tertunda karena Pak Budi belum kirim berkas fisik. Besok pagi rencana follow up Pak Budi dan lanjut bab 4."*
* **Tugas Cerdas Agent:**
  1. Menguraikan teks santai / hasil transkrip Voice Note menjadi 4 bagian baku:
     - **Pekerjaan Selesai (Completed)**
     - **Pekerjaan Berjalan (In Progress)**
     - **Kendala & Blocker (Issues / Impediments)**
     - **Rencana Kerja Besok (Next Action Plan)**
  2. Memberikan estimasi alokasi waktu dan menandai prioritas tugas (`High`, `Medium`, `Low`).
  3. Menyimpan data terstruktur ke tabel `daily_work_logs`.
  4. Mengembalikan format rapi yang siap di-forward ke grup WhatsApp kantor atau atasan.

---

### Agent 2: Weekly Progress & KPI Consolidator (Asisten Rekap Mingguan)
* **Peran Pengguna:** Asisten manajer/staf yang otomatis menyusun rekap minggu berjalan setiap hari Jumat sore.
* **Cara Interaksi Pengguna:**
  - Pengguna cukup menekan tombol *"Generate Laporan Mingguan"* di dashboard atau membalas pesan bot WhatsApp *"Ya, buatkan laporan minggu ini"*.
* **Tugas Cerdas Agent:**
  1. Menarik data 5 hari kerja (Senin s/d Jumat) dari `daily_work_logs`.
  2. Mengelompokkan aktivitas berdasarkan topik / proyek besar (bukan sekadar daftar kronologis).
  3. Membandingkan capaian minggu ini dengan target mingguan (KPI/OKRs) yang ada di profil divisi pengguna.
  4. Menyoroti **Milestone Utama Tercapai** dan **Tugas yang Tertunda (Carry-Over Tasks)**.
  5. Menyusun strategi prioritas untuk pekan berikutnya.
  6. Menyimpan ke tabel `weekly_reports`.

---

### Agent 3: Monthly Strategic & Performance Reviewer (Asisten Laporan Bulanan)
* **Peran Pengguna:** Analis bisnis senior pribadi untuk level Supervisor, Manajer, hingga Direksi.
* **Cara Interaksi Pengguna:**
  - Di akhir bulan, pengguna memilih menu *"Executive Monthly Review"* atau memasukkan dokumen pendukung (misal laporan kinerja departemen).
* **Tugas Cerdas Agent:**
  1. Mengompilasi 4 laporan mingguan dalam satu bulan penuh.
  2. Menghasilkan **Executive Summary** berbobot tinggi untuk rapat manajemen direksi:
     - **Key Achievements (Pencapaian Kunci):** Highlight nilai dampak (*business impact*).
     - **Month-over-Month (MoM) Trend Analysis:** Perbandingan produktivitas dan penyelesaian isu dibanding bulan lalu.
     - **Critical Blockers & Risk Assessment:** Identifikasi hambatan sistemik dan risiko operasional.
     - **Strategic Action Plan:** 3-5 inisiatif strategis yang wajib dieksekusi bulan depan.
  3. Menyediakan opsi satu kali klik: **"Export to Corporate PDF Report"**.

---

### Agent 4: Operational Expense & Budget Auditor (Asisten Keuangan / Spensify)
* **Peran Pengguna:** Asisten kas operasional & reimbursement pribadi.
* **Cara Interaksi Pengguna:**
  - Pengguna memfoto bon/nota struk pengeluaran atau mengupload rekap pengeluaran harian/mingguan (seperti integrasi Spensify).
* **Tugas Cerdas Agent:**
  1. Membaca nilai nominal, tanggal, nama merchant, dan tujuan pengeluaran via Vision / Text parser.
  2. Mengelompokkan pos pengeluaran: *Transportasi*, *Akomodasi*, *Konsumsi Lembur*, *ATK/Operasional*, *Vendor Support*.
  3. Menghitung total pengeluaran secara presisi menggunakan **Code Interpreter** (menghindari salah hitung matematis).
  4. Memberikan peringatan dini jika pengeluaran mendekati atau melampaui plafon anggaran yang ditentukan.
  5. Menghasilkan tabel klaim pertanggungjawaban dana kas kecil (*Expense Reimbursement Sheet*).

---

### Agent 5: SOP & Compliance Validator (Pengawas Kepatuhan Laporan)
* **Peran Pengguna:** Auditor internal otomatis yang menjaga kualitas kerja tetap sesuai standar.
* **Cara Bekerja Agent:**
  1. Bekerja secara otomatis di belakang layar saat Laporan Harian/Mingguan dibuat.
  2. Mengambil potongan SOP internal yang relevan dari basis pengetahuan pgvector BrilianAi.
  3. Memeriksa apakah langkah-langkah yang dilaporkan sudah sesuai prosedur resmi:
     - Contoh: Jika staf melaporkan *"Menyelesaikan insiden server down"*, agen mengecek apakah staf sudah membuat *"Berita Acara Insiden"* sesuai klausul SOP IT.
  4. Menambahkan catatan kecil di laporan: *"Catatan Kepatuhan: Pastikan melampirkan Berita Acara Insiden sesuai SOP No. 05/IT/2024"*.

---

### Agent 6: Proactive Dispatcher & Reminder Bot (Asisten WhatsApp Proaktif)
* **Peran Pengguna:** Asisten sekretaris pribadi yang mengingatkan pelaporan secara ramah tepat waktu.
* **Jadwal Kerja Otomatis (Cron Engine):**
  - **Setiap Hari Kerja (Senin–Kamis, 16:30):**
    > 💬 *"Selamat sore Pak/Bu! Sebelum mengakhiri hari kerja, apa saja progres yang sudah tuntas hari ini? Cukup balas chat ini atau kirim voice note singkat, saya bantu susunkan Laporan Harian Anda."*
  - **Setiap Jumat Sore (16:00):**
    > 💬 *"Selamat berakhir pekan! 5 hari kerja minggu ini selesai. Saya sudah merangkum catatan harian Anda. Mau saya generate draf Laporan Mingguan sekarang?"*
  - **Setiap Tanggal 28–30 (Akhir Bulan):**
    > 💬 *"Periode akhir bulan telah tiba. Draf Laporan Bulanan divisi Anda sudah siap ditinjau. Silakan buka tautan berikut untuk review & ekspor PDF."*

---

## 3. Format Baku Laporan Korporat (Standardized Output)

### 3.1 Format Laporan Harian (Daily Activity Log)

```markdown
# 📋 LAPORAN AKTIVITAS HARIAN
**Nama Karyawan:** [Nama User] | **Divisi:** [Nama Divisi]  
**Hari / Tanggal:** Kamis, 25 September 2026  
**Status Kehadiran:** WFO (08:30 - 17:30)

---

### ✅ 1. Pekerjaan Selesai (Completed Tasks)
* **Koordinasi Integrasi API Vendor IT [High Priority]**
  - Menyepakati endpoint webhook dan skema payload token keamanan bersama tim vendor.
  - *Output:* Notula kesepakatan teknis API v2.
* **Penyusunan Draft SOP Audit Bab 3 [Medium Priority]**
  - Merampungkan pasal pengujian transaksi kas kecil dan pelaporan berkala.
  - *Output:* Dokumen SOP_Audit_Draft_v1.docx (Halaman 12-25).

### ⏳ 2. Pekerjaan Dalam Proses (In Progress)
* **Verifikasi Berkas Pengeluaran Operasional Cabang Surabaya**
  - Progres: 65% dokumen terverifikasi, menunggu kelengkapan bukti fisik kwitansi asli dari PIC regional.

### ⚠️ 3. Kendala & Hambatan (Blockers / Issues)
* *Kendala:* Dokumen fisik pengeluaran regional Surabaya belum tiba di kantor pusat.
* *Mitigasi:* Menggunakan scan dokumen via email sementara waktu untuk validasi awal.

### 🎯 4. Rencana Kerja Besok (Next Action Plan)
1. Follow up pengiriman kwitansi fisik dengan PIC Surabaya jam 09:00.
2. Melanjutkan penulisan SOP Audit Bab 4 (Mekanisme Eskalasi Temuan).
3. Evaluasi mingguan bersama Kepala Divisi.

---
*Generated by BrilianAI Activity Assistant • Kepatuhan SOP: Terverifikasi (100%)*
```

---

### 3.2 Format Laporan Mingguan (Weekly Status Report)

```markdown
# 📊 LAPORAN KINERJA & PROGRES MINGGUAN (WEEKLK REPORT)
**Periode:** Pekan ke-4 (21 - 25 September 2026)  
**Penyusun:** [Nama User / Tim] | **Departemen:** [Nama Divisi]  
**Target Utama Pekan Ini:** Penyelesaian SOP Audit 2026 & Uji Coba API Baru

---

### 🌟 1. Ringkasan Eksekutif (Executive Weekly Summary)
Pekan ini tim berhasil mencapai 88% dari total target mingguan. Milestone utama integrasi API tahap alpha berhasil diselesaikan bersama vendor. Kendala minor terdapat pada keterlambatan berkas regional yang sedang dalam mitigasi aktif.

### 📈 2. Matriks Capaian vs Target (KPI Progress Matrix)
| Inisiatif / Program Kerja | Target Pekan Ini | Realisasi Capaian | Status |
| :--- | :--- | :--- | :---: |
| Draft SOP Audit Internal | Selesai Bab 1 - 3 | Selesai Bab 1 - 3 | 🟢 Tuntas (100%) |
| Koordinasi Vendor IT | Finalisasi Kontrak API | Endpoint & Payload Disepakati | 🟢 Tuntas (100%) |
| Rekonsiliasi Kas Cabang | 5 Cabang Terverifikasi | 4 Cabang Terverifikasi | 🟡 On-Track (80%) |
| Pelatihan Staf Baru | Modul 1 & 2 | Modul 1 Tuntas | 🔴 Pending (50%) |

### 🔍 3. Kendala Kritis & Solusi yang Diambil
* **Kendala:** Pengiriman dokumen fisik regional terlambat akibat cuaca ekspedisi.
* **Solusi Tim:** Menerapkan verifikasi digital sementara via BrilianAi Curation untuk menghindari terhentinya proses pembukuan.

### 🚀 4. Prioritas Kunci Pekan Depan (Next Week Priorities)
1. Rilis final dokumen SOP Audit Internal untuk diajukan ke Direksi.
2. Kick-off pengujian beban API vendor di server staging.
3. Penyelesaian audit cabang regional Surabaya dan Malang.
```

---

### 3.3 Format Laporan Bulanan (Monthly Strategic Review)

```markdown
# 🏛️ EXECUTIVE MONTHLY PERFORMANCE REVIEW
**Bulan / Tahun:** September 2026  
**Entitas:** PT Brilian Unggul Teknologi / Divisi Operasional  
**Disusun Untuk:** Jajaran Direksi & Dewan Manajemen

---

### 📌 1. Highlight Capaian Strategis (Key Strategic Accomplishments)
1. **Efisiensi Waktu Operasional:** Penerapan automasi laporan BrilianAi memangkas waktu administratif divisi hingga 72% (menghemat ~120 jam kerja staf/bulan).
2. **Kepatuhan Audit:** 100% kepatuhan SOP pada dokumen penagihan dan pengadaan barang.
3. **Pencapaian Target Finansial:** Realisasi anggaran berada di angka 94,2% (di bawah batas pagu maksimal).

### 📊 2. Analisis Tren Kinerja Bulanan (MoM Performance Trend)
* **Penyelesaian Proyek:** Naik 18% dibandingkan bulan Agustus 2026.
* **Waktu Respons Komplain:** Membaik dari rata-rata 4,2 jam menjadi 1,8 jam.
* **Tingkat Keterlambatan Tugas:** Menurun dari 12% menjadi 3,5%.

### ⚠️ 3. Manajemen Risiko & Evaluasi Tantangan (Risk & Governance)
* **Risiko Operasional:** Ketergantungan pada vendor pihak ketiga untuk API cloud.
* **Langkah Mitigasi:** Mengembangkan fallback lokal on-premise berbasis model Ollama.

### 🔮 4. Rekomendasi & Rencana Strategis Triwulan Berikutnya
1. Alokasi anggaran untuk peningkatan infrastruktur server lokal.
2. Standardisasi format pelaporan digital di seluruh kantor perwakilan regional.
3. Pelaksanaan audit berkala kepatuhan data privasi.
```

---

## 4. Alur Interaksi Pengguna (User Journey & Omni-Channel)

Sistem dirancang fleksibel agar pengguna bisa berinteraksi lewat saluran yang paling nyaman:

```
[ PENGGUNA ]
    │
    ├─► Mode 1: WhatsApp Chat / Voice Note (Paling sering dipakai saat mobile/di lapangan)
    │     1. User kirim voice note: "Hari ini sudah kelarin audit cabang A..."
    │     2. Agent 6 meneruskan ke Whisper API ➔ teks mentah
    │     3. Agent 1 mengonversi ke format Laporan Harian resmi
    │     4. Bot WhatsApp membalas format rapi + link ke Dashboard
    │
    ├─► Mode 2: Web Dashboard BrilianAI (Dipakai saat di depan laptop/PC)
    │     1. User membuka menu "Daily & Weekly Standup"
    │     2. Mengisi input cepat / klik "Kompilasi Minggu Ini"
    │     3. Tampilan preview interaktif (bisa edit manual jika ada revisi)
    │     4. Klik "Export PDF Laporan Resmi"
    │
    └─► Mode 3: Manager / Supervisor View (Untuk pimpinan tim)
          1. Manajer membuka "Team Performance Overview"
          2. Melihat rekap status: siapa staf yang sudah/belum lapor hari ini
          3. AI menyajikan ringkasan 1 halaman berisi capaian seluruh anggota tim
```

---

## 5. Skema Database Pendukung (Data Persistence)

Untuk menyimpan riwayat laporan dan mempermudah kompilasi otomatis, skema PostgreSQL berikut disiapkan:

```sql
-- db/migrations/011_create_reporting_tables.sql

-- 1. Tabel Laporan Kerja Harian
CREATE TABLE IF NOT EXISTS daily_work_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    raw_input TEXT NOT NULL,                  -- teks mentah atau transkrip voice note
    completed_tasks JSONB NOT NULL DEFAULT '[]', -- array of {task, priority, output}
    in_progress_tasks JSONB NOT NULL DEFAULT '[]',
    blockers JSONB NOT NULL DEFAULT '[]',
    next_day_plans JSONB NOT NULL DEFAULT '[]',
    formatted_markdown TEXT NOT NULL,
    sop_compliance_score NUMERIC(3, 2) DEFAULT 1.00,
    sop_notes TEXT,
    channel VARCHAR(20) DEFAULT 'web',        -- 'web', 'whatsapp', 'api'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_user_log_date UNIQUE (user_id, log_date)
);

-- 2. Tabel Laporan Mingguan
CREATE TABLE IF NOT EXISTS weekly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year_number INT NOT NULL,
    week_number INT NOT NULL,                 -- pekan ke-1 s/d 52
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    executive_summary TEXT NOT NULL,
    kpi_matrix JSONB NOT NULL DEFAULT '[]',   -- array of {kpi, target, actual, status}
    blockers_and_solutions JSONB NOT NULL DEFAULT '[]',
    next_week_priorities JSONB NOT NULL DEFAULT '[]',
    formatted_markdown TEXT NOT NULL,
    is_submitted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel Laporan Bulanan
CREATE TABLE IF NOT EXISTS monthly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department_id VARCHAR(50),
    report_month INT NOT NULL,                -- 1 s/d 12
    report_year INT NOT NULL,
    executive_summary TEXT NOT NULL,
    strategic_achievements JSONB NOT NULL DEFAULT '[]',
    mom_trend_analysis TEXT,
    risk_assessment JSONB NOT NULL DEFAULT '[]',
    action_plans JSONB NOT NULL DEFAULT '[]',
    formatted_markdown TEXT NOT NULL,
    pdf_export_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabel Jadwal Pengingat Proaktif Pengguna
CREATE TABLE IF NOT EXISTS user_reporting_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_whatsapp VARCHAR(25),
    is_whatsapp_reminder_active BOOLEAN DEFAULT TRUE,
    daily_reminder_time TIME DEFAULT '16:30:00',
    weekly_reminder_day INT DEFAULT 5,        -- 5 = Jumat
    weekly_reminder_time TIME DEFAULT '16:00:00',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_work_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_user ON weekly_reports(user_id, year_number, week_number);
```

---

## 6. Struktur Folder & Desain Kode Bersih (Clean Code Architecture)

Untuk menempatkan kode agen pelaporan ini secara rapi di dalam proyek:

```
src/
├── app/
│   ├── reports/
│   │   ├── daily/page.tsx            # Halaman UI Laporan Harian
│   │   ├── weekly/page.tsx           # Halaman UI Rekap Mingguan
│   │   └── monthly/page.tsx          # Halaman UI Executive Bulanan
│   └── api/
│       ├── reports/
│       │   ├── daily/route.ts        # GET / POST log harian
│       │   ├── weekly/generate/route.ts # Trigger kompilasi mingguan
│       │   ├── monthly/generate/route.ts# Trigger kompilasi bulanan
│       │   └── export/pdf/route.ts   # Download PDF resmi
lib/
├── agents/
│   └── reporting/                    # DIREKTORI KHUSUS REPORTING AGENTS
│       ├── DailyReporterAgent.ts     # Logika pembedah aktivitas harian
│       ├── WeeklyConsolidatorAgent.ts# Logika kompilasi 5 hari kerja + KPI
│       ├── MonthlyReviewerAgent.ts   # Logika nalar strategis bulanan
│       ├── ExpenseAuditorAgent.ts    # Kalkulator biaya & nota
│       ├── SopComplianceAgent.ts     # Pengecekan silang ke pgvector RAG
│       └── ProactiveReminderAgent.ts # Scheduler WhatsApp & pengingat
├── queue/
│   └── reportingReminderQueue.ts     # BullMQ cron job jam 16:30 & Jumat 16:00
└── export/
    └── pdfReportGenerator.ts         # Renderer HTML ke PDF (Puppeteer / PDFKit)
```

---

## 7. Tahapan Re-Coding Terencana (Execution Roadmap)

Agar proses coding berjalan bertahap, mudah diuji, dan rapih:

### 🔹 Sprint R1: Daily Report Core & UI (Langkah Pertama)
1. Eksekusi migrasi database `db/migrations/011_create_reporting_tables.sql`.
2. Buat `DailyReporterAgent.ts`: Prompt khusus untuk memecah teks santai/voice note menjadi 4 pilar (Selesai, Berjalan, Kendala, Besok).
3. Buat API `POST /api/reports/daily` dan UI formulir santai di `src/app/reports/daily/page.tsx`.
4. *Hasil:* Pengguna sudah bisa mengisi laporan harian dengan cepat dan mendapatkan output rapi.

### 🔹 Sprint R2: Weekly Consolidator & KPI Tracking (Langkah Kedua)
1. Buat `WeeklyConsolidatorAgent.ts`: Fungsi yang menarik 5 log harian terakhir dari database, merangkumnya per topik proyek, dan membandingkan dengan target KPI.
2. Buat API `POST /api/reports/weekly/generate` dan UI rekap mingguan.
3. Tambahkan tombol *"Copy to WhatsApp"* dan *"Simpan Laporan Mingguan"*.

### 🔹 Sprint R3: Monthly Executive Review & Export PDF (Langkah Ketiga)
1. Buat `MonthlyReviewerAgent.ts`: Model nalar tinggi (DeepSeek-V3 / Claude Sonnet / GPT-4o) untuk menyusun *Executive Summary Direksi*.
2. Implementasikan `pdfReportGenerator.ts`: Menghasilkan dokumen PDF resmi lengkap dengan logo perusahaan, tabel KPI, dan kolom tanda tangan pimpinan.

### 🔹 Sprint R4: Otomasi Proaktif WhatsApp Bot (Langkah Keempat)
1. Pasang worker BullMQ cron yang mengecek tabel `user_reporting_schedules`.
2. Jam 16:30 setiap hari kerja: Mengirim pesan sapaan ke WhatsApp pengguna.
3. Menghubungkan webhook WhatsApp agar balasan pesan/voice note langsung diproses oleh `DailyReporterAgent`.

---

> Dokumen cetak biru ini siap digunakan sebagai panduan re-coding lengkap. Anda dapat memilih modul mana yang ingin diimplementasikan terlebih dahulu!
