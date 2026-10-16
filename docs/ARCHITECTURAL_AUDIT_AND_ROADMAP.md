# 🏛️ BrilianAi — Architectural Audit, Technical Debt & Engineering Roadmap

> **Tanggal Audit**: 15 Oktober 2026  
> **Status Dokumen**: Siap Dieksekusi (*Execution-Ready*)  
> **Target Pengerjaan**: Malam ini / Besok  

---

## Executive Summary

**BrilianAi** telah memiliki arsitektur fungsional yang sangat kaya untuk sistem RAG enterprise:
- Akses kontrol berbasis atribut dan peran (**ABAC & RBAC**) yang memfilter dokumen per departemen dan klasifikasi.
- Sistem **multi-variant response**, sitasi terverifikasi per halaman PDF, pencatatan log audit, serta dukungan dwibahasa (ID/EN).

Namun, seiring dengan rencana peningkatan skala pengguna dan dokumen, terdapat **5 area teknis kritis** yang perlu dioptimasi untuk mencegah penurunan performa (*bottleneck*), potensi *Out-of-Memory (OOM)* pada database, dan beban pemeliharaan kode (*technical debt*).

---

## 🔍 Temuan Audit & Solusi Arsitektural

### 1. [P0 — Kritis] Ketiadaan Streaming Response (HTTP Blocking)
* **Lokasi Kode**:
  * Backend: [`src/app/api/chat/route.ts:80`](file:///c:/Users/msazi/Work/BrilianAi%20-%20Copy/src/app/api/chat/route.ts#L80)
  * Frontend: [`src/components/chat/ChatWorkspace.tsx:388`](file:///c:/Users/msazi/Work/BrilianAi%20-%20Copy/src/components/chat/ChatWorkspace.tsx#L388)
* **Masalah**:
  * Saat ini endpoint `/api/chat` mengembalikan seluruh respon sekaligus via `NextResponse.json(result)`.
  * Pada model LLM lokal/CPU inference, proses inferensi RAG membutuhkan waktu **5 – 30+ detik** (`maxDuration = 300`).
  * Pengguna terpaksa menatap animasi loading dalam durasi panjang tanpa ada teks yang mengalir. **Time-to-First-Token (TTFT)** terasa sangat lambat bagi pengguna akhir.
* **Solusi Arsitektur**:
  1. Ubah generator di `chatService.ts` untuk mendukung callback stream (`ReadableStream` / Server-Sent Events).
  2. Di `/api/chat/route.ts`, kembalikan `new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })`.
  3. Di `ChatWorkspace.tsx`, gunakan reader stream (`res.body.getReader()`) agar teks muncul per kata (*typewriter effect*).

---

### 2. [P0 — Kritis] Resiko OOM pada In-Memory Fallback VectorStore
* **Lokasi Kode**:
  * [`lib/db/vectorStore.ts:681-700`](file:///c:/Users/msazi/Work/BrilianAi%20-%20Copy/lib/db/vectorStore.ts#L681-L700)
* **Masalah**:
  * Ketika operator `vector <=> vector` gagal (misal ekstensi `pgvector` di PostgreSQL lokal/server belum aktif), sistem melakukan fallback ke:
    ```sql
    SELECT c.id, ..., c.embedding FROM document_chunks ...
    ```
  * Lalu Node.js menghitung fungsi `cosineSimilarity(vecA, vecB)` secara manual di memori proses JS.
  * **Resiko**: Jika koleksi dokumen bertambah menjadi **10.000 – 100.000 chunk**, satu panggilan pencarian akan memuat ratusan megabyte array vektor ke RAM Node.js, berujung pada **Out-of-Memory (OOM) Crash** atau lonjakan CPU 100%.
* **Solusi Arsitektur**:
  1. Pastikan script inisialisasi database (`scripts/migrate.js` & `docker-compose.yml`) mewajibkan `CREATE EXTENSION IF NOT EXISTS vector;`.
  2. Tambahkan index `HNSW` (`CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)`) pada kolom embedding.
  3. Berikan *hard limit* atau circuit-breaker pada fallback in-memory (maksimal 200 chunk) agar database tidak membanjiri memori backend.

---

### 3. [P1 — Penting] Refactoring "God Component" `ChatWorkspace.tsx` (>1.590 Baris)
* **Lokasi Kode**:
  * [`src/components/chat/ChatWorkspace.tsx`](file:///c:/Users/msazi/Work/BrilianAi%20-%20Copy/src/components/chat/ChatWorkspace.tsx)
* **Masalah**:
  * File ini mengelola terlalu banyak tanggung jawab (*Violates Single Responsibility Principle*):
    * Siklus hidup sesi (load, cache, auto-title, share fork).
    * Web Speech recognition & Text-to-Speech audio reader.
    * Multiple modals (feedback modal, source citation inspector).
    * Auto-expanding textarea & shortcut key listeners.
  * **Dampak**: Komponen menjadi rapuh, rawan regresi saat ada perubahan CSS/UI, dan siklus *re-render* yang berat.
* **Solusi Arsitektur**:
  Pecah `ChatWorkspace.tsx` menjadi komponen & custom hooks terisolasi:
  ```
  src/
  ├── hooks/
  │   ├── useChatSession.ts       # Manajemen load sesi, LRU cache, dan auto-save
  │   ├── useSpeechRecognition.ts # Web Speech API mic toggle & transcript
  │   └── useTextToSpeech.ts      # SpeechSynthesis read aloud
  └── components/chat/
      ├── ChatHeader.tsx          # Top bar, share button, document upload trigger
      ├── ChatStarterView.tsx     # Hero greeting, empty state, prompt chips
      ├── ChatInputDock.tsx       # Bottom floating input bar, voice button, send
      └── ChatInspectorModal.tsx  # Modal detail dokumen & sitasi
  ```

---

### 4. [P1 — Penting] Sinkronisasi State & Caching Multi-Tab
* **Lokasi Kode**:
  * [`src/components/chat/ChatWorkspace.tsx:50`](file:///c:/Users/msazi/Work/BrilianAi%20-%20Copy/src/components/chat/ChatWorkspace.tsx#L50)
  * [`src/components/layout/Sidebar.tsx:110-130`](file:///c:/Users/msazi/Work/BrilianAi%20-%20Copy/src/components/layout/Sidebar.tsx#L110-L130)
* **Masalah**:
  * Cache sesi disimpan di variabel global memori modul (`const sessionCache = new Map()`). Begitu user menekan **F5 (Refresh)**, seluruh cache memori terhapus.
  * Komunikasi antar komponen (misal saat sesi baru dibuat) masih mengandalkan event bus manual `window.dispatchEvent(new CustomEvent('...'))`.
* **Solusi Arsitektur**:
  * Integrasikan **TanStack Query (React Query)** atau **SWR**.
  * Dapatkan automatic deduping, background invalidation, tab-focus revalidation, dan persistent storage (IndexedDB/localStorage) secara cuma-cuma tanpa *custom event listeners*.

---

### 5. [P2 — Standar Enterprise] Audit Log Fire-and-Forget
* **Lokasi Kode**:
  * [`src/app/api/chat/route.ts:66-78`](file:///c:/Users/msazi/Work/BrilianAi%20-%20Copy/src/app/api/chat/route.ts#L66-L78)
* **Masalah**:
  * `saveAuditLog(...)` dipanggil tanpa `await` (*fire-and-forget*).
  * Pada arsitektur container/serverless, proses worker dapat dimatikan segera setelah HTTP Response 200 dikirimkan, sehingga promise audit log yang sedang berjalan bisa terputus di tengah jalan.
* **Solusi Arsitektur**:
  * Masukkan audit log ke dalam antrean background job berbasis Redis (**BullMQ** yang sudah terpasang di `lib/queue/`) atau gunakan `waitUntil(saveAuditLog(...))` untuk menjamin 100% data audit tercatat (*compliance-proof*).

---

### 6. [P2 — UI/UX] Live Abort/Stop Button pada Input Dock
* **Lokasi Kode**:
  * [`src/components/chat/ChatWorkspace.tsx`](file:///c:/Users/msazi/Work/BrilianAi%20-%20Copy/src/components/chat/ChatWorkspace.tsx)
* **Masalah**:
  * Mekanisme `aiAbortControllerRef` sudah aktif di balik layar untuk membatalkan proses saat berpindah chat.
  * Namun, di antarmuka input bawah, tombol Send hanya berupa icon loading. Pengguna tidak memiliki tombol langsung untuk membatalkan generasi jawaban jika salah memasukkan pertanyaan panjang.
* **Solusi Arsitektur**:
  * Saat `isLoading === true`, ubah tombol Send menjadi tombol **Stop Generating** (ikon persegi hitam dengan tooltip *"Hentikan jawaban"*).

---

## 📋 Action Plan: Checklist Eksekusi (Malam / Besok)

### Tahap 1: Performa & Streaming (P0) — SELESAI ✅
- [x] Buat helper streaming pada `lib/chat/chatService.ts` (`askDocumentChatStream`) dan `lib/ai/` untuk mengalirkan potongan teks per token.
- [x] Perbarui `src/app/api/chat/route.ts` agar mendukung header SSE / `ReadableStream` (`text/event-stream`).
- [x] Sesuaikan `ChatWorkspace.tsx` agar membaca stream token secara real-time dan menghentikan jumping cube seketika saat token pertama tiba.
- [x] Tambahkan unit test suite `tests/chatStream.test.ts` (100% passed).

### Tahap 2: Keamanan Enterprise & Hardening Database (P0) — SELESAI ✅
- [x] Buat tabel `user_sessions` enterprise (`lib/db/sessionStore.ts`) dengan token 64-karakter cryptographically secure, IP, User-Agent, expiry, dan revocation.
- [x] Migrasikan cookie autentikasi ke `httpOnly: true, sameSite: 'lax'` pada route login/logout/me/serverAuth.
- [x] Eliminasi seluruh celah SQL Injection pada `lib/db/vectorStore.ts` via parameterized queries menggunakan `ANY($N::text[])` dan `ANY($N::uuid[])`.
- [x] Pasang in-memory guard caching pada runtime DDL di `lib/db/userStore.ts` dan `lib/db/sessionStore.ts`.
- [x] Tambahkan unit test suite `tests/sessionStore.test.ts` (100% passed).

### Tahap 3: Stabilitas UI/UX & Smart Auto-Scroll (P1) — SELESAI ✅
- [x] Implementasi Smart Auto-Scroll pada `ChatWorkspace.tsx` (`isNearBottomRef`, `scrollContainerRef`) guna mengeliminasi scroll hijacking saat streaming.
- [x] Perbaiki hover styling tombol Cancel pada inline prompt edit (tidak hilang/blank saat di-hover).
- [x] Batasi lebar inline prompt edit menjadi 75% rata kanan dengan border primary yang ramping dan bersih.
- [x] Pastikan keyboard shortcut Enter untuk update dan Shift + Enter untuk multiline.
- [x] Jamin pencatatan Audit Log 100% tercatat via `await saveAuditLog(...)` sebelum stream termination.
- [x] Jalankan verifikasi menyeluruh (`npx vitest run` & `npx tsc --noEmit` — 90/90 passed).

### Tahap 4: Modularisasi Frontend & Pertahanan Brute-Force — SELESAI ✅
- [x] Buat file migrasi `db/migrations/012_create_user_sessions.sql` agar container Docker baru otomatis membuat tabel dan index sesi.
- [x] Pasang **Enterprise Rate Limiter & Brute-Force Shield** ([rateLimiter.ts](file:///c:/Users/msazi/Work/BrilianAi%20-%20Copy/lib/security/rateLimiter.ts)) pada endpoint [login](file:///c:/Users/msazi/Work/BrilianAi%20-%20Copy/src/app/api/auth/login/route.ts) dengan sliding window 15 menit dan mitigasi HTTP 429 Too Many Requests.
- [x] Ekstrak dialog share menjadi komponen modular terisolasi ([ChatShareModal.tsx](file:///c:/Users/msazi/Work/BrilianAi%20-%20Copy/src/components/chat/ChatShareModal.tsx)).
- [x] Ekstrak tampilan greeting & chip saran menjadi komponen modular ([ChatStarterView.tsx](file:///c:/Users/msazi/Work/BrilianAi%20-%20Copy/src/components/chat/ChatStarterView.tsx)).
- [x] Tambahkan unit test suite `tests/rateLimiter.test.ts` (100% passed).

### Tahap 5: Otorisasi Menyeluruh (RBAC) & HTTP Security Headers — SELESAI ✅
- [x] Amankan seluruh endpoint admin & manajemen:
  - `GET /api/audit-logs`: Wajib autentikasi & izin `audit:read`.
  - `GET, POST /api/users` & `PATCH, DELETE /api/users/[id]`: Wajib izin `users:manage` (dan cegah eskalasi role mandiri atau hapus akun sendiri).
  - `GET, POST /api/roles` & `PATCH, DELETE /api/roles/[id]`: Wajib izin `roles:manage`.
  - `POST /api/documents/upload`: Wajib autentikasi & izin `documents:upload` serta proteksi batas payload file 50 MB (`MAX_FILE_SIZE`).
  - `PATCH /api/documents`: Wajib izin `documents:toggle_active`.
  - `POST /api/documents/[id]/curate`: Wajib izin `curation:trigger`.
- [x] Perketat edge middleware (`src/middleware.ts`) agar memverifikasi token sesi `brilian_session_token` (minimal 32 karakter) dan membersihkan seluruh cookie saat tidak sah.
- [x] Pasang **Enterprise HTTP Security Headers** pada `next.config.mjs` (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`).
- [x] Jalankan verifikasi menyeluruh (`npx vitest run` & `npx tsc --noEmit` — 96/96 passed).

---
*Dokumen ini diperbarui secara real-time dan tersimpan di `docs/ARCHITECTURAL_AUDIT_AND_ROADMAP.md`.*
