# 🎨 Master UI Prompts untuk Google Stitch (BrilianAi Dual-Portal Workspace)

Dokumen ini berisi rangkaian **Prompt Siap Pakai untuk Google Stitch / AI UI Generator** yang membedah seluruh antarmuka sistem BrilianAi dari awal (*Autentikasi SSO*) sampai akhir (*Audit Logs & Agent Builder*), berdasarkan spesifikasi resmi di **[PRD.md](file:///c:/Users/msazi/Work/BrilianAi/PRD.md)** dan **[design.md](file:///c:/Users/msazi/Work/BrilianAi/design.md)**.

---

## 📐 PANDUAN GAYA GLOBAL & DESIGN TOKENS (System Context untuk Google Stitch)
Sertakan blok aturan gaya dan token CSS di bawah ini pada setiap sesi Stitch atau jadikan sebagai *Custom System Instructions* agar seluruh komponen UI konsisten 100%:

```text
=== BRILIANAI GLOBAL DESIGN SYSTEM & TOKENS ===

1. Background & Surfaces (Netral Terang / Canvas):
- --bg-app: #F8FAFC (Slate-50) -> Background utama canvas seluruh halaman
- --bg-card / --color-paper: #FFFFFF (Pure White) -> Kartu dokumen, panel chat, modal, formulir
- --bg-subtle / --color-mist: #F1F5F9 (Slate-100) -> Container sekunder, chip/badge netral
- --bg-muted: #E2E8F0 (Slate-200) -> Divider, skeleton loading, progress track bar

2. Typography & Teks (Netral Gelap / Ink):
- --text-primary / --color-ink: #0F172A (Slate-900) -> Teks utama, judul (heading), isi dokumen
- --text-secondary / --color-slate: #475569 (Slate-600) -> Subjudul, label formulir, metadata
- --text-muted: #94A3B8 (Slate-400) -> Placeholder input, timestamp, hint pembantu
- --text-inverse: #FFFFFF (Pure White) -> Teks di atas tombol aksen primer
- Font: Clean Sans-serif (Plus Jakarta Sans / Inter) untuk antarmuka; Monospace (JetBrains Mono) untuk ID, timestamps, chunks, dan angka teknis.

3. Brand & Primary Accent (Single Accent Principle - Royal Blue):
- --color-primary / --color-accent: #2563EB (Blue-600) -> Tombol utama (CTA), tab aktif, link, focus rings
- --color-primary-hover: #1D4ED8 (Blue-700) -> Efek hover tombol utama
- --color-primary-active: #1E40AF (Blue-800) -> Efek active / pressed tombol utama
- --color-primary-subtle: #EFF6FF (Blue-50) -> Background menu aktif, highlight kutipan
- --color-primary-border: #BFDBFE (Blue-200) -> Border badge aktif / focus indicator

4. Chat Bubble Colors:
- User Bubble: Background #E8F2FF (--user-bubble-bg), Text #0F172A (--user-bubble-text), rounded-2xl (bottom-right sharp corner)
- AI Bubble: Background #FFFFFF (--bg-card), Text #0F172A, 1px solid #E2E8F0 border, rounded-2xl (bottom-left sharp corner)

5. Status & Feedback Semantik (Badge / Toast / Indikator):
- 🟢 Sukses / Aktif (Emerald):
  * Base: #10B981 | Subtle BG: #ECFDF5 | Border: #A7F3D0 | Text: #047857
- 🟡 Peringatan / Standby (Amber):
  * Base: #F59E0B | Subtle BG: #FFFBEB | Border: #FDE68A | Text: #B45309
- 🔴 Bahaya / Error (Crimson):
  * Base: #EF4444 | Subtle BG: #FEF2F2 | Border: #FECACA | Text: #B91C1C

6. Garis Batas & Divider (Hairline 1px - No Heavy Drop Shadows):
- --border-subtle: 1px solid #F1F5F9 (Slate-100) -> Garis pemisah internal halus
- --border-default / --color-hairline: 1px solid #E2E8F0 (Slate-200) -> Border standar kartu, tabel, input form
- --border-hover: 1px solid #CBD5E1 (Slate-300) -> Border saat elemen di-hover

7. Aturan Visual & Filosofi Desain:
- "Dokumen Dulu, Chrome Belakangan": Tampilan tenang, minimalis, dan elegan tanpa gradient neon atau efek glow tebal agar nyaman dibaca berjam-jam.
- Satu Warna Aksen (#2563EB): Warna biru hanya dipicu saat ada aksi interaktif dari pengguna.
- Corner Radius: 8px (cards, modals), 6px (buttons, inputs), 9999px (pills, badges, chips).
- Ikonografi: Outline icons bersih (Lucide icon style).
- Labeling: Seluruh teks, label tombol, dan judul menggunakan Sentence case (bukan ALL-CAPS).
===================================================
```

---

## 🚪 TAHAP 1: GERBANG AUTENTIKASI & AKUN TERPUSAT (PORTAL SSO)

### Prompt 1: Halaman Login SSO Terpusat
```text
Screen: Centralized Single Sign-On (SSO) Login Page
Context: The entry gateway for BrilianAi enterprise platform at sso.brilian.domain.com.
Layout:
- Centered clean card layout on a subtle #F8FAFC slate background.
- Card dimensions: Max-width 420px, #FFFFFF background, 1px solid #E2E8F0 border, rounded-lg (8px), soft shadow.
Header inside Card:
- Modern minimalist logo of BrilianAi (deep blue geometric icon) followed by bold title "Masuk ke BrilianAi".
- Subtitle: "Sistem Asisten Pengetahuan & Dokumen Korporat Terpadu" in #475569 slate.
Form Elements:
- Form field 1: "Email Perusahaan" input with clean outline, placeholder "nama@perusahaan.com", mail icon on the left.
- Form field 2: "Kata Sandi" input with eye icon toggle for show/hide password.
- Row below inputs: "Ingat saya di perangkat ini" checkbox on the left, "Lupa kata sandi?" blue link (#2563EB) on the right.
- Primary CTA Button: "Masuk ke Sistem" in full-width #2563EB royal blue with white text, font-weight 600, rounded-md, subtle hover state.
Footer inside Card:
- Subtle notice at bottom: "Akun baru didaftarkan oleh Administrator. Hubungi tim HRIS jika belum memiliki akses." in #94A3B8 12px text.
Bottom of Page:
- Copyright and security badge: "Protected by Brilian In-House SSO • Enkripsi Asimetris RSA" in muted monospace text.
```

---

### Prompt 2: Halaman Aktivasi Akun & Set Password Baru (`pending_activation`)
```text
Screen: Account Activation & Set Password Page
Context: Screen accessed via email invitation link for newly invited corporate users.
Layout:
- Centered card layout on #F8FAFC background, max-width 460px, #FFFFFF card, 1px solid #E2E8F0 border, rounded-lg.
Header inside Card:
- Key icon inside a soft blue circle (#EFF6FF), followed by title "Aktivasi Akun BrilianAi".
- Description text: "Halo, akun Anda telah didaftarkan oleh Administrator. Silakan atur kata sandi baru untuk mengaktifkan akses Anda."
User Profile Snippet:
- A read-only badge box (#F1F5F9) showing: User Email (e.g. "budi.santoso@perusahaan.com") and Assigned Role badge ("Member").
Form Elements:
- Input 1: "Kata Sandi Baru" with secure password strength meter bar (Weak, Medium, Strong indicators in green/amber/red).
- Password guidelines checklist:
  * Minimal 8 karakter (checked icon)
  * Memuat huruf besar dan angka (checked icon)
  * Memuat karakter simbol khusus
- Input 2: "Konfirmasi Kata Sandi Baru".
- Primary Button: "Aktifkan Akun & Masuk" in #2563EB blue, full-width, disabled until password criteria met.
Footer:
- Link back: "Sudah pernah mengatur kata sandi? Masuk ke portal" in blue text.
```

---

## 💬 TAHAP 2: PORTAL ASSISTANT (FRONTEND / CONSUMER WORKSPACE)

### Prompt 3: Halaman Utama Chat (Empty State & Agent Selector)
```text
Screen: Portal Assistant - Chat Workspace (Empty State)
Context: The default view for users entering the Assistant Portal to ask questions to corporate documents.
Layout:
- Full-height two-column layout:
  * Left Sidebar (260px width, #FFFFFF surface, 1px solid #E2E8F0 right border):
    - Top: Brand logo "BrilianAi Assistant" + "Sesi Baru" (+ icon) button in soft blue tint (#EFF6FF).
    - Session History List grouped by "Hari Ini", "Kemarin", "7 Hari Terakhir". Each session has a chat bubble icon, title text with ellipsis, and a hover 3-dots menu.
    - Bottom Sidebar: User profile avatar with name, role badge, and link to App Switcher.
  * Main Content Canvas (#F8FAFC background):
    - Top Navigation Bar (64px height, #FFFFFF, 1px bottom border):
      - Left: Portal title "Assistant Workspace".
      - Center: Agent Selector Dropdown (Pill badge style: "Asisten Legal Pro ▾" with bot icon, allowing user to switch to "HR Buddy" or "General RAG").
      - Right: "Share Chat" button (outline) + "Atur Agent" button with sliders icon + App Switcher icon button.
    - Center Canvas Area (Empty State):
      - Hero graphic: Clean document icon with a spark/AI indicator.
      - Greeting: "Selamat pagi, Budi. Apa yang ingin Anda teliti hari ini?"
      - Active Knowledge Pill: "12 Dokumen Aktif Terhubung" in emerald green badge (#ECFDF5 with green dot).
      - Suggested Starter Cards (Grid 2x2 of cards in #FFFFFF with thin border):
        1. "Ringkas SOP Cuti dan Izin Kerja 2026"
        2. "Bandingkan Klausul Kontrak Vendor IT Bab 3"
        3. "Cek Kebijakan Plafon Klaim Kesehatan Karyawan"
        4. "Kalkulasi Pertumbuhan Belanja Operasional Q3"
    - Bottom Floating Input Bar (Docked at bottom center, max-width 780px):
      - Rounded-xl (16px) white card with soft shadow and 1px border.
      - Textarea: "Ketik pertanyaan atau ketik 'Atur Agent'..." with auto-grow.
      - Bottom action icons: Paperclip attachment icon, Voice note mic icon, and Send button (blue circle with arrow-up).
```

---

### Prompt 4: Antarmuka Percakapan Aktif (Message Stream & Source Citations)
```text
Screen: Portal Assistant - Active Chat Thread with Document Citations
Context: User has asked a question and the AI responds with verified corporate document context.
Layout:
- Left Sidebar (same 260px history sidebar).
- Main Chat Stream (Centered container, max-width 820px, scrollable):
  * User Message Bubble:
    - Aligned to the right.
    - Background: Soft blue (#E8F2FF), text: #0F172A, rounded-2xl with bottom-right sharp corner.
    - Text: "Bagaimana prosedur pengajuan cuti melahirkan dan berapa bulan hak yang diberikan?"
  * Assistant Response Block:
    - Aligned to the left.
    - Avatar: BrilianAi bot icon.
    - Header: Agent Name "HR & Operations Buddy" • "Baru saja" in #94A3B8 text.
    - Response Body (Clean Markdown):
      - Opening definition paragraph.
      - Formatted bullet list with bold terms.
      - Exact clause citation callout box (#F8FAFC with blue left border):
        "Sesuai Buku Panduan Karyawan 2026 Bab IV Pasal 12 Ayat 1: Hak cuti melahirkan diberikan selama 3 bulan kalender penuh..."
    - Source Verification Bar (Below response):
      - Title: "Referensi Dokumen Terverifikasi (2 Sumber):"
      - Horizontal chips/cards:
        1. [PDF Icon] "Buku_Panduan_Karyawan_2026.pdf" • Halaman 24-25 • Relevansi 98% (Clickable chip).
        2. [PDF Icon] "SOP_Benefit_SDM_Revisi.pdf" • Halaman 8 • Relevansi 92%.
    - Bottom Action Toolbar: Thumbs up / Thumbs down feedback icons, Copy text button, Share button, and Regenerate button.
  * Right Side Drawer (Slide-over panel, 380px width, opens when clicking a source chip):
    - Header: "Kutipan Dokumen Sumber" + Close (X) button.
    - Document title and exact page range badge.
    - Verbatim Raw Text Extract box with yellow highlight on matching sentences.
    - Notice badge: "File asli diproses 100% in-memory tanpa penyimpanan di disk."
```

---

### Prompt 5: Modal UI "Atur Agent" (Personalisasi Custom Persona)
```text
Screen: "Atur Agent" Custom Persona Configuration Modal
Context: Triggered when user clicks "Atur Agent" button or types "Atur Agent" in chat.
Layout:
- Centered modal dialog on dimmed backdrop.
- Modal dimensions: Max-width 580px, #FFFFFF surface, 1px solid #E2E8F0 border, rounded-xl, shadow-float.
Header:
- Title: "Personalisasi Asisten Anda (Custom Agent)" with sliders icon.
- Subtitle: "Pengaturan ini otomatis tersinkronisasi dengan file /.brilian-config/Agent.md" in #475569.
Form Body (Vertical stack with 16px gap):
- Field 1: "Nama Asisten" (Text input, e.g. "Asisten Legal Pro").
- Field 2: "Gaya Bahasa & Kepribadian (Tone)" (Segmented control or 4 radio cards):
  * "Profesional" (Formal, kaku, lugas) [Selected]
  * "Santai" (Ramah, kasual)
  * "Socratic" (Menuntun dengan pertanyaan)
  * "Analitis" (Kritis, skeptis, berbasis data)
- Field 3: "Tingkat Kedalaman Jawaban" (3-step toggle button):
  * "Ringkas" (Poin-poin to the point)
  * "Sedang" (Proporsional seimbang) [Selected]
  * "Mendalam" (Esai komprehensif)
- Field 4: "Fokus Keahlian (Role)" (Dropdown select: General, Legal & Compliance, HR & People, IT & Developer, Finance & Auditor).
- Field 5: "Instruksi Khusus (System Prompt)" (Multi-line textarea with syntax highlight preview):
  - Placeholder: "Contoh: Selalu mulai dengan ringkasan 1 kalimat. Utamakan tabel untuk data angka."
- Footer Sync Notice:
  - Small folder icon with text: "Tersimpan di workspace: /.brilian-config/Agent.md"
Action Buttons:
- Right-aligned: "Batal" (Outline button) and "Simpan Konfigurasi" (#2563EB Blue button).
```

---

### Prompt 6: Tampilan Publik Percakapan Bersama (Share Chat Page)
```text
Screen: Public Shared Chat View (Read-Only)
Context: Read-only web page accessed via unique public link (share.brilian.domain.com/chat/xyz) without requiring login.
Layout:
- Minimalist clean canvas, centered reading container (max-width 780px) on #F8FAFC background.
Top Banner Bar:
- Clean white header: Logo BrilianAi + "Tautan Percakapan Publik (Hanya Baca)".
- Right action: "Salin Jawaban" button and "Buka di BrilianAi" CTA button.
Shared Content Stream:
- Read-only snapshot of the shared chat messages.
- User question box with timestamp.
- Complete AI response with formatted tables, bold text, and clickable document reference chips.
- Notice badge at bottom: "Percakapan ini dibagikan oleh staf terverifikasi. Seluruh informasi disintesis dari dokumen resmi perusahaan."
```

---

## 🛠️ TAHAP 3: PORTAL AGENT STUDIO (BACKEND / ADMIN WORKSPACE)

### Prompt 7: Halaman Knowledge Base (Daftar Dokumen & Kendali Pengetahuan)
```text
Screen: Portal Agent Studio - Knowledge Base Management
Context: Administrative control center where Admins and Superadmins manage corporate PDF documents.
Layout:
- Full-page dashboard layout with top navigation:
  * Brand: "BrilianAi Agent Studio" (Admin Badge in purple/blue pill).
  * Navigation Tabs: "Knowledge Base" [Active], "Agent Builder", "System & Security" (Superadmin only).
  * Right: App Switcher dropdown ("Beralih ke Portal Assistant") + User profile.
Main Content Area (#F8FAFC background, 32px padding):
- Page Header:
  - Title: "Knowledge Base & Dokumen Perusahaan".
  - Subtitle: "Kelola file PDF yang menjadi sumber pengetahuan asisten AI RAG."
  - Right Actions: "Unggah Dokumen (+)" button (#2563EB primary) and "Kurasi Ulang Semua" button (outline).
- Metrics Overview Row (4 small cards):
  1. "Total Dokumen": 18 File
  2. "Total Chunks Vektor": 1,420 Chunks (1024-dim HNSW)
  3. "Status Basis Pengetahuan": 16 Aktif / 2 Standby
  4. "In-Memory Policy": 100% RAM Buffer (Zero Disk)
- Filter & Search Bar:
  - Search input "Cari nama dokumen..." + Filter dropdown "Status: Semua" + Sort by "Tanggal Unggah".
- Document Data Table (#FFFFFF card, 1px hairline border, rounded-lg):
  - Table Columns:
    1. Nama Dokumen (PDF icon + Filename, e.g. "SOP_Operasional_2026.pdf")
    2. Jumlah Halaman & Chunks ("42 Halaman • 86 Chunks")
    3. Status AI (Toggle Switch: Hijau "Aktif sebagai Basis Pengetahuan" vs Abu-abu "Standby")
    4. Tanggal Unggah ("24 Sep 2026, 14:20")
    5. Hasil Kurasi AI (Badge "62 Insight Terkurasi" in emerald tint)
    6. Aksi (Button: "Detail Chunks", "Kurasi AI", and Dropdown: "Hapus Dokumen")
```

---

### Prompt 8: Modal Drag & Drop Upload PDF & Progress Bar Ingestion
```text
Screen: Upload PDF Document Modal with In-Memory Ingestion Progress
Context: Triggered when admin clicks "Unggah Dokumen" in Agent Studio.
Layout:
- Centered modal dialog (max-width 560px), #FFFFFF surface, rounded-xl, 1px border.
Header:
- Title: "Unggah Dokumen PDF Baru" + Close (X) button.
- Subtitle: "File diproses 100% di memori (RAM) via AI Vision dan tidak disimpan di disk server."
Dropzone Area (Initial State):
- Large dashed border box (#E2E8F0, rounded-lg, #F8FAFC background).
- Cloud upload icon in #2563EB blue.
- Text: "Tarik & lepas file PDF di sini, atau telusuri berkas dari komputer".
- File limits hint: "Maksimal 50 MB per file • Format PDF saja".
Active Ingestion Progress State (Simulated Step Progression):
- Progress box showing current processing status:
  * Stage 1: "Rendering Halaman ke Gambar In-Memory (MuPDF WASM)..." [Done - Green Checkmark]
  * Stage 2: "AI Vision Ekstraksi Teks & Tabel (Qwen2.5-VL)..." [Active - 65% Animated Progress Bar]
  * Stage 3: "Sliding-Window Chunking (800 char, 150 overlap)..." [Pending]
  * Stage 4: "Vector Embedding & HNSW Indexing (pgvector 1024-dim)..." [Pending]
- Live counter: "Memproses Halaman 14 dari 26..."
Action Buttons:
- "Batal" (disabled during processing) and "Tutup saat selesai" checkbox.
```

---

### Prompt 9: Halaman Kurasi Wawasan Dokumen (Curation Studio)
```text
Screen: Document Curation Studio & AI Insights Review
Context: Reviewing and manually editing AI-curated structured insights generated from raw document chunks.
Layout:
- Full-page view with breadcrumbs: "Knowledge Base / SOP_Audit_Internal.pdf / Kurasi Wawasan".
- Header: Document title + Total "48 Insight Terstruktur" + "Simpan Perubahan" button (#2563EB).
Two-Column Split Layout:
- Left Column (40% width): List of Curated Insight Cards:
  * Each card shows: Importance Badge ("HIGH" in red/amber pill), Insight Title (e.g. "Prosedur Verifikasi Kas Kecil"), and Page range tag ("Halaman 12-14").
  * Active card has blue left border indicator.
- Right Column (60% width): Active Insight Editor (#FFFFFF card, 1px border):
  * Editable Title Input: "Judul Insight Spesifik".
  * Category Dropdown: "Finance", "Governance", "SOP", "HR", "Legal".
  * Importance Radio: High / Medium / Low.
  * Tag Input Chip Field: ["Kas Kecil", "Audit Cabang", "Kwitansi"].
  * Markdown Editor Pane: Structured content with cleaned Markdown table.
  * Bottom Section: "Teks Mentah Asli (Raw OCR Extract)" in collapsible accordion for audit verification.
```

---

### Prompt 10: Halaman Agent Builder (Perakitan Agen Kustom Multi-Agent)
```text
Screen: Portal Agent Studio - Agent Builder Workspace
Context: Administrator interface to create, assemble, and configure specialized AI agents.
Layout:
- Dashboard layout with two columns:
  * Left Column (320px width): "Daftar Agen Sistem"
    - "Buat Agen Baru (+)" primary button.
    - List of existing agents:
      1. "Asisten Default RAG" (Core System)
      2. "Legal & Contract Auditor" (Active)
      3. "HR & Employee Policy Buddy" (Active)
      4. "IT Runbook Troubleshooting" (Active)
  * Right Column (Main Canvas): "Konfigurasi Agen: Legal & Contract Auditor"
    - Section 1: Identitas Agen:
      * Nama Agen (Text input)
      * Avatar / Ikon Agen selector (Pilihan ikon timbangan, dokumen, robot)
      * Deskripsi Publik ("Asisten khusus penelaahan pasal hukum dan mitigasi kontrak")
    - Section 2: Pemilihan Model AI (Multi-Tier Architecture):
      * Primary Synthesizer Model (Dropdown: DeepSeek-V3, Claude 3.5 Sonnet, GPT-4o-mini, Ollama Local)
      * Temperature slider (0.0 to 1.0, default 0.1 for high precision)
    - Section 3: Core System Prompt & Knowledge Boundary:
      * Large code editor textarea with line numbers containing system prompt rules:
        "TUGAS: Analisis klausul kontrak. Aturan keras: Jangan ubah susunan kata pasal legal..."
    - Section 4: Filter Pengetahuan yang Diizinkan:
      * Checkbox list of specific Knowledge Base documents this agent is allowed to access (e.g. Only Legal & Contract PDFs).
    - Bottom Actions: "Uji Coba Agen (Test Playground)" and "Simpan & Rilis Agen" (#2563EB).
```

---

## 🔒 TAHAP 4: PORTAL ADMINISTRASI & KEAMANAN (SUPERADMIN ONLY)

### Prompt 11: Dasbor Manajemen Pengguna & Persetujuan Akun SSO
```text
Screen: Superadmin User Management & Account Approval Dashboard
Context: Restricted to Super Administrator for approving pending users and managing role assignments.
Layout:
- Dashboard view under "System & Security / Pengguna".
- Header: "Manajemen Pengguna & Otorisasi SSO" + "Tambah Pengguna Baru (+)" button.
Sub-Tabs:
- "Semua Pengguna (48)"
- "Menunggu Aktivasi (4)" [Amber badge notification pill]
- "Administrator (6)"
Table of Pending Activations:
- Columns:
  1. Nama & Email Perusahaan ("siti.aminah@perusahaan.com")
  2. Tanggal Didaftarkan ("25 Sep 2026")
  3. Role yang Ditetapkan ("Member")
  4. Status ("pending_activation" in amber pill)
  5. Aksi: "Kirim Ulang Email Aktivasi" button and "Setujui Akses" (#2563EB blue button).
Active Users Table (Below):
- Columns: User info, Role dropdown selector, Last login timestamp, Active sessions count, Action (Disable / Reset password).
```

---

### Prompt 12: Dasbor Audit Logs & Monitoring Keamanan (dengan Ekspor CSV)
```text
Screen: Superadmin Audit Logs & Compliance Inspector
Context: Full immutable audit trail viewer for corporate enterprise compliance.
Layout:
- Full-page table layout with security dashboard header.
Header:
- Title: "Jejak Audit Keamanan & Kepatuhan Sistem (Audit Logs)".
- Subtitle: "Rekaman seluruh mutasi data, autentikasi, dan aktivitas dokumen secara transparan."
- Right Action: "Ekspor Log (.CSV)" button with download icon.
Filter & Date Range Row:
- Date picker: "7 Hari Terakhir (18 - 25 Sep 2026)"
- Action Filter dropdown: "Semua Aksi", "LOGIN_SUCCESS", "DOCUMENT_UPLOAD", "DOCUMENT_DELETE", "AGENT_CONFIG_UPDATE".
- Search input: "Cari berdasarkan IP, email user, atau entity ID..."
Audit Logs Data Table:
- Dense enterprise data table with monospace font for timestamps and IDs:
  1. Timestamp (e.g. "2026-09-25 14:12:05 WIB")
  2. Pengguna ("superadmin@brilian.ai" or "budi.s@perusahaan.com")
  3. Aksi (Badges: Green "LOGIN_SUCCESS", Blue "DOCUMENT_UPLOAD", Amber "TOGGLE_KNOWLEDGE", Red "DOCUMENT_DELETE")
  4. Entitas Sasaran ("upload_batches: UUID-9812")
  5. Alamat IP & Lokasi ("103.24.12.8 • Jakarta, ID")
  6. Status ("SUCCESS" in green pill)
  7. Detail (Clickable link "Lihat JSON Payload" opening a slide-over drawer showing raw request metadata).
Pagination Footer:
- Showing 1-25 of 1,248 logs • Next & Previous pagination controls.
```

---

> Rangkaian prompt ini mencakup 100% seluruh alur aplikasi BrilianAi dari gerbang awal hingga fitur administrasi terdalam. Anda dapat langsung menyalin setiap blok prompt ke Google Stitch / AI Designer.
