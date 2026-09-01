# BrilianAI — Sistem Ingestion PDF via AI Vision

Repositori ini memuat fondasi infrastruktur dan pipeline lengkap ingestion PDF via AI Vision berbasis Next.js (App Router, TypeScript), LangChain.js, PostgreSQL 16 (pgvector), Redis (BullMQ), dan Ollama.

---

## 🚀 1. Setup Docker Compose (Local / VPS)

Jalankan seluruh service pendukung (PostgreSQL 16 dengan pgvector, Redis, dan Ollama):

```bash
# 1. Salin environment variables jika belum
cp .env.example .env

# 2. Jalankan container di background
docker compose up -d

# 3. Periksa status container & healthcheck
docker compose ps
```

Semua service (`brilian_postgres`, `brilian_redis`, `brilian_ollama`) akan berstatus `Up (healthy)`.

---

## 🗄️ 2. Migrasi Database (pgvector)

Skema database otomatis dimuat saat container database pertama kali dibuat melalui mount `./db/migrations/001_create_ingestion_tables.sql` ke `/docker-entrypoint-initdb.d/`.

Jika database sudah berjalan dan ingin menjalankan migrasi secara manual:

**Opsi A: Menggunakan script Node (NPM)**
```bash
npm run db:migrate
```

**Opsi B: Menggunakan psql di dalam container**
```bash
docker compose exec postgres psql -U postgres -d brilian_ai -f /docker-entrypoint-initdb.d/001_create_ingestion_tables.sql
```

**Verifikasi pgvector extension:**
```bash
docker compose exec postgres psql -U postgres -d brilian_ai -c "SELECT * FROM pg_extension WHERE extname='vector';"
```

---

## 🤖 3. Unduh Model AI di Ollama

Setelah container `ollama` berjalan, unduh model AI Vision dan Embedding yang dibutuhkan:

1. **Model AI Vision (Qwen 2.5 VL 7B):**
```bash
docker compose exec ollama ollama pull qwen2.5vl:7b
```

2. **Model Embedding (BGE-M3 - 1024 dimensi):**
```bash
docker compose exec ollama ollama pull bge-m3
```

**Verifikasi daftar model terinstal:**
```bash
docker compose exec ollama ollama list
```

---

## 🌐 4. Endpoint API Dokumen

Jalankan server Next.js:
```bash
npm run dev
```

### 📤 A. Upload & Ingest Dokumen PDF
- **Method:** `POST`
- **URL:** `http://localhost:3000/api/documents/upload`
- **Body:** `multipart/form-data` dengan field `file` (File PDF)

**Contoh Request via cURL:**
```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@/path/to/dokumen.pdf"
```

**Contoh Response Sukses (200 OK):**
```json
{
  "upload_batch_id": "c7a8e2d4-1a2b-4c5d-9e8f-0123456789ab",
  "original_filename": "dokumen.pdf",
  "page_count": 5,
  "chunk_count": 14
}
```

---

### 📋 B. Mengambil Daftar Batch Upload
- **Method:** `GET`
- **URL:** `http://localhost:3000/api/documents`

**Contoh Request via cURL:**
```bash
curl http://localhost:3000/api/documents
```

---

### 📑 C. Mengambil Chunks Dokumen Berdasarkan Batch ID
- **Method:** `GET`
- **URL:** `http://localhost:3000/api/documents/[upload_batch_id]/chunks`

**Contoh Request via cURL:**
```bash
curl http://localhost:3000/api/documents/c7a8e2d4-1a2b-4c5d-9e8f-0123456789ab/chunks
```

**Contoh Item Chunk:**
```json
[
  {
    "id": 1,
    "upload_batch_id": "c7a8e2d4-1a2b-4c5d-9e8f-0123456789ab",
    "chunk_index": 0,
    "content": "Teks substantif hasil pembacaan AI Vision...",
    "source_page_start": 1,
    "source_page_end": 2,
    "embedding": "[-0.0123, 0.0456, ...]",
    "created_at": "2026-09-01T15:30:00.000Z"
  }
]
```

---

## 🧪 5. Pengujian Otomatis (Unit Tests Vitest)

Jalankan seluruh 25 unit test:
```bash
npm test
```

Test suite mencakup pengujian menyeluruh:
1. **Render PDF (`tests/renderPages.test.ts`)**: Render in-memory PNG, magic bytes `89 50 4E 47 0D 0A 1A 0A`, penanganan buffer rusak.
2. **Vision Client (`tests/visionClient.test.ts`)**: Multimodal payload base64, exponential backoff retry 3x, fallback silent string kosong.
3. **Chunking & Page Tracking (`tests/splitWithPageTracking.test.ts`)**: Multi-page spanning, single-page chunking, penanganan frasa identik berulang ("Purnama26") tanpa salah kecocokan, substring overlap.
4. **Embedding Client (`tests/embeddingClient.test.ts`)**: Batch embedding BGE-M3 (1024-dimensi).
5. **Vector Store (`tests/vectorStore.test.ts`)**: Multi-row batch insert, pgvector casting `$n::vector`, transaksi database atomik.
6. **Ingestion Service (`tests/ingestService.test.ts`)**: Urutan pemanggilan pipeline 1 s/d 7, zero disk write.
7. **API Route Handlers (`tests/apiRoutes.test.ts`)**: Validasi MIME & header PDF (400 Bad Request untuk non-PDF), upload endpoint, list batches, dan list chunks.

---

## 🔍 6. Script Verifikasi Manual

### A. Gate Verifikasi AI Vision (Teks "HALO DUNIA 12345")
```bash
npm run verify:vision
```

### B. Verifikasi Database & pgvector Store
```bash
npm run verify:db
```

---

## 📁 Struktur Direktori

```
.
├── .env.example
├── .env
├── .gitignore
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── next.config.mjs
├── db/
│   └── migrations/
│       └── 001_create_ingestion_tables.sql
├── lib/
│   ├── ai/
│   │   ├── embeddingClient.ts           # Batch embedding BGE-M3 (1024 dim)
│   │   └── visionClient.ts              # Client AI Vision Qwen2.5-VL via ChatOllama
│   ├── chunking/
│   │   └── splitWithPageTracking.ts     # Sliding-window chunker dengan page tracking
│   ├── db/
│   │   ├── dbClient.ts                  # PostgreSQL connection pool
│   │   └── vectorStore.ts               # Raw SQL store untuk upload_batches & document_chunks
│   ├── ingest/
│   │   └── ingestService.ts             # Pipeline end-to-end ingestion in-memory
│   ├── pdf/
│   │   └── renderPages.ts               # Render PDF -> PNG (Buffer) via mupdf
│   └── queue/
│       └── ingestQueue.ts               # BullMQ job queue & worker
├── scripts/
│   ├── migrate.js                      # Runner migrasi DB
│   ├── verify-vision.mjs               # Script gate verifikasi manual "HALO DUNIA"
│   └── verify-db-vector.mjs            # Script verifikasi database pgvector
├── src/
│   └── app/
│       ├── api/
│       │   └── documents/
│       │       ├── route.ts             # GET /api/documents
│       │       ├── [id]/
│       │       │   └── chunks/
│       │       │       └── route.ts     # GET /api/documents/[id]/chunks
│       │       └── upload/
│       │           └── route.ts         # POST /api/documents/upload
│       ├── globals.css
│       ├── layout.tsx
│       └── page.tsx
├── tests/
│   ├── fixtures/
│   │   └── createPdf.ts                # Fixture generator PDF
│   ├── apiRoutes.test.ts               # Tests API route handlers
│   ├── embeddingClient.test.ts         # Unit tests AI Embedding client (Mocked)
│   ├── ingestService.test.ts           # Tests end-to-end pipeline ingestion
│   ├── renderPages.test.ts             # Unit tests render PDF
│   ├── splitWithPageTracking.test.ts   # Unit tests text chunking & page tracking
│   ├── vectorStore.test.ts             # Unit tests database vector store
│   └── visionClient.test.ts            # Unit tests AI Vision client (Mocked)
└── README.md
```
