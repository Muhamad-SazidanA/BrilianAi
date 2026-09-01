# PRD 1 — AI Agent: Ingestion PDF via AI Vision (MVP Fokus Awal)
### Next.js + LangChain.js — Baca PDF, Hasilkan Chunks Mentah dengan Sliding Window

| | |
|---|---|
| **Versi** | 2.0 — restart, fokus dipersempit |
| **Bagian dari** | Sistem Asisten AI Data Enterprise (lihat PRD.md master) |
| **Ganti dari** | Versi 1.0 (Python/FastAPI) — sekarang Next.js + LangChain.js |

---

## 0. Konteks & Kenapa Restart Ini Penting

Versi sebelumnya (Python/FastAPI) mencoba menangani terlalu banyak hal sekaligus: 4 format file, deteksi fast-path vs vision, enrichment AI (title/tags/importance), reprocess endpoint — semua di satu PRD. Itu yang bikin coding agent "halu" karena scope-nya terlalu lebar.

**PRD ini SENGAJA dipersempit** ke satu jalur saja: **PDF → AI Vision → chunk mentah dengan sliding window (seperti `RecursiveCharacterTextSplitter`)**. Format lain dan fitur lanjutan ditunda ke Bagian 15 (Fase Berikutnya) — bukan dihapus, hanya belum sekarang.

## 1. Tujuan
Upload PDF → setiap halaman dibaca AI Vision → hasil teks digabung lalu dipotong sliding-window (mirip pola yang terlihat di referensi: "Halaman 1-3", "Halaman 3-4", "Halaman 4-6"...) → tersimpan sebagai chunks di pgvector. **File asli tidak pernah disimpan.**

## 2. Ruang Lingkup

### ✅ DI DALAM scope PRD ini:
- Upload PDF (satu format ini saja dulu)
- Render tiap halaman PDF jadi gambar
- AI Vision baca tiap halaman → teks
- Sliding-window chunking (LangChain.js `RecursiveCharacterTextSplitter`) lintas halaman, dengan overlap
- Pelacakan rentang halaman per chunk (`source_page_start`, `source_page_end`)
- Simpan chunk mentah + embedding ke pgvector

### ❌ DI LUAR scope PRD ini (JANGAN dikerjakan sekarang):
- **Tidak ada** DOCX, XLSX, CSV — hanya PDF dulu
- **Tidak ada** deteksi fast-path vs vision, `detect_page_type()`, atau optimasi — SEMUA halaman lewat AI Vision dulu di versi ini, optimasi menyusul setelah alur dasar terbukti jalan
- **Tidak ada** enrichment AI (title, tags, importance, display_content sintesis) — itu chunk MENTAH apa adanya dari Vision, bukan hasil ringkasan/sintesis
- **Tidak ada** endpoint `/ask` atau logic menjawab pertanyaan — itu PRD 2, terpisah
- **Tidak ada** kode UI/frontend selain endpoint API-nya — itu PRD 3

## 3. Prinsip Non-Negosiasi (Hard Constraints)
1. File diproses **100% in-memory** (Node `Buffer`), tidak pernah ditulis ke disk.
2. Next.js jalan sebagai **server Node.js persisten** di Docker (bukan serverless/Vercel Functions) — supaya proses AI Vision yang bisa berdurasi lama tidak kena timeout.
3. Model AI (Vision & Embedding) wajib on-premise via Ollama — tidak ada API publik.
4. **Kontrak lintas-PRD:** model embedding = `bge-m3`, dimensi = `1024`. Kalau nanti PRD 2 (chatbot) dibangun, ia HARUS pakai model & dimensi yang sama persis untuk embed pertanyaan.

## 4. Keputusan Stack

| Kebutuhan | Pilihan | Alasan |
|---|---|---|
| Backend + Frontend | **Next.js (App Router)**, satu aplikasi yang sama | Route Handler langsung jadi backend, tidak perlu proxy ke service terpisah |
| Bahasa | TypeScript | Konsisten satu bahasa FE+BE |
| Framework AI | **LangChain.js** — `@langchain/textsplitters` (RecursiveCharacterTextSplitter), `@langchain/ollama` (ChatOllama untuk vision, OllamaEmbeddings) | Persis sesuai pola sliding-window-overlap yang kamu identifikasi dari referensi |
| Render PDF → gambar | **`mupdf`** (npm resmi dari Artifex, WASM, tanpa dependency native) | Tidak butuh GraphicsMagick/Ghostscript di Docker — `npm install` saja. Catatan: lisensi AGPL/komersial, cek ke legal kalau ini jadi produk komersial. Alternatif tanpa isu lisensi: shell out ke `pdftoppm` (poppler-utils) via `child_process` |
| Database | PostgreSQL + pgvector, akses via `pg` (node-postgres) | Sama seperti rencana sebelumnya, sekarang lewat Node |
| Job queue (pengganti Celery) | **BullMQ** + Redis | Supaya upload besar tidak memblokir request lain |

## 5. Arsitektur Alur

```
Upload PDF (Next.js Route Handler, multipart)
    │
    ▼
Render SETIAP halaman jadi gambar PNG (mupdf)
    │
    ▼
AI Vision (qwen2.5vl:7b via @langchain/ollama ChatOllama, images param)
— baca SETIAP halaman satu per satu → teks per halaman
    │
    ▼
Gabungkan teks semua halaman jadi SATU string panjang, sambil catat
offset karakter awal-akhir tiap halaman (page offset table)
    │
    ▼
LangChain RecursiveCharacterTextSplitter({chunkSize: 800, chunkOverlap: 150})
.splitText(fullText) → array of chunk strings, TIDAK peduli batas halaman
    │
    ▼
Untuk tiap chunk: cari posisinya di fullText (fullText.indexOf), lalu cocokkan
ke page offset table → hasilkan source_page_start & source_page_end
    │
    ▼
AI Embedding (bge-m3 via OllamaEmbeddings) — embed tiap chunk
    │
    ▼
Simpan ke document_chunks (content mentah, source_page_start/end, embedding,
raw_extracted_text = sama dengan content di versi ini)
    │
    ▼
Buang gambar halaman & file PDF asli dari memori
```

## 6. Skema Database

```sql
-- db/migrations/001_create_ingestion_tables.sql

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS upload_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_filename TEXT NOT NULL,
    chunk_count INT NOT NULL DEFAULT 0,
    page_count INT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id BIGSERIAL PRIMARY KEY,
    upload_batch_id UUID NOT NULL REFERENCES upload_batches(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,                  -- chunk mentah, HASIL LANGSUNG dari Vision, tidak disintesis
    source_page_start INT NOT NULL,
    source_page_end INT NOT NULL,           -- sama dengan source_page_start kalau chunk tidak lintas halaman
    embedding VECTOR(1024) NOT NULL,        -- bge-m3 = 1024 dimensi
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_chunks_batch ON document_chunks (upload_batch_id);
```

## 7. Kontrak API

### 7.1 `POST /api/documents/upload`
- Request: `multipart/form-data`, field `file` (PDF saja — tipe lain → `400`)
- Response `200`:
```json
{
  "upload_batch_id": "uuid",
  "original_filename": "TM 1. Sejarah FT.pdf",
  "page_count": 26,
  "chunk_count": 12
}
```

### 7.2 `GET /api/documents`
List `upload_batches`, tanpa isi file — hanya metadata.

### 7.3 `GET /api/documents/[id]/chunks`
List chunk untuk satu batch (untuk keperluan verifikasi manual/debug), format:
```json
[{"chunk_index": 0, "content": "...", "source_page_start": 1, "source_page_end": 3}]
```

## 8. Spesifikasi Modul

| File | Fungsi Utama | Tanggung Jawab |
|---|---|---|
| `lib/pdf/renderPages.ts` | `renderPdfPagesToImages(buffer: Buffer): Promise<Buffer[]>` | Pakai `mupdf`: `mupdf.Document.openDocument(buffer, "application/pdf")` → loop `doc.loadPage(i)` → `page.toPixmap(mupdf.Matrix.scale(2,2), mupdf.ColorSpace.DeviceRGB)` → `.asPNG()` per halaman, kembalikan sebagai array Buffer PNG, in-memory |
| `lib/ai/visionClient.ts` | `extractPageText(imageBuffer: Buffer): Promise<string>` | `ChatOllama` dari `@langchain/ollama`, model `qwen2.5vl:7b`, kirim gambar via `images` param. Prompt WAJIB instruksikan: tulis urutan baca logis, ABAIKAN watermark/logo/nomor halaman berulang |
| `lib/chunking/splitWithPageTracking.ts` | `chunkWithPageOffsets(pages: {pageNumber: number, text: string}[], chunkSize=800, chunkOverlap=150): ChunkWithPageRange[]` | Gabungkan teks antar-halaman dengan pencatatan offset karakter per halaman, jalankan `RecursiveCharacterTextSplitter.splitText()`, lalu cocokkan tiap chunk balik ke rentang halamannya via `indexOf` berurutan (cari dari posisi akhir pencarian sebelumnya, supaya chunk yang overlap tidak salah cocok ke posisi lebih awal) |
| `lib/ai/embeddingClient.ts` | `embedTexts(texts: string[]): Promise<number[][]>` | `OllamaEmbeddings` dari `@langchain/ollama`, model `bge-m3` |
| `lib/ingest/ingestService.ts` | `ingestPdf(fileBuffer: Buffer, filename: string): Promise<UploadResult>` | Orkestrasi Bagian 5 lengkap |
| `lib/db/vectorStore.ts` | `createUploadBatch()`, `insertChunks()`, `listBatches()`, `listChunks(batchId)` | Query `pg` langsung (raw SQL, bukan ORM dulu — lebih mudah dikontrol untuk pgvector) |
| `app/api/documents/upload/route.ts` | Endpoint 7.1 | Terima multipart, panggil `ingestService`, format response |
| `app/api/documents/route.ts` | Endpoint 7.2 | List batches |
| `app/api/documents/[id]/chunks/route.ts` | Endpoint 7.3 | List chunks per batch |

## 9. Model AI

| Model | Peran | Cara Panggil |
|---|---|---|
| **AI Vision** — `qwen2.5vl:7b` via Ollama | Baca tiap halaman PDF sebagai gambar → teks | `new ChatOllama({model: "qwen2.5vl:7b"})`, kirim image via `images` di call options (paket `@langchain/ollama`) |
| **AI Embedding** — `bge-m3` via Ollama | Embed tiap chunk & (nanti) pertanyaan | `new OllamaEmbeddings({model: "bge-m3"})` |

**Catatan penting (dari riset, sudah pernah ada laporan bug):** beberapa integrasi LangChain+Ollama untuk vision pernah tidak benar-benar mengirim gambar ke model (model "halu" mendeskripsikan gambar acak). Test manual di awal WAJIB: kirim satu gambar berisi teks yang jelas terbaca, pastikan hasil ekstraksi benar-benar mencerminkan isi gambar tersebut, sebelum lanjut ke integrasi penuh.

## 10. Kriteria Performa
- Tidak ada target kecepatan ketat untuk versi MVP ini — fokus dulu ke BENAR, bukan CEPAT
- Upload tetap harus non-blocking untuk request lain (jalankan proses ingest via BullMQ job, bukan langsung di request handler kalau dokumennya banyak halaman)

## 11. Test Cases (Vitest)
1. `renderPdfPagesToImages()` dengan PDF 3 halaman → mengembalikan array 3 Buffer PNG
2. `extractPageText()` dengan gambar test berisi teks sederhana (generate pakai `sharp`/`canvas` + teks "Halo Dunia") → hasil mengandung kata tersebut (test integrasi manual dengan Ollama asli, dicatat terpisah dari unit test biasa)
3. `chunkWithPageOffsets()` dengan 3 halaman teks pendek → chunk yang dihasilkan punya `source_page_start`/`source_page_end` yang benar, termasuk kasus SATU chunk mencakup LEBIH dari satu halaman
4. `chunkWithPageOffsets()` — chunk yang overlap (karena `chunkOverlap`) tidak salah dicocokkan ke halaman yang salah (test dengan teks yang punya frasa berulang di halaman berbeda, untuk memastikan `indexOf` mencari dari posisi yang benar)
5. Setelah upload selesai — assert tidak ada file di disk manapun
6. `POST /api/documents/upload` dengan file bukan PDF → `400`

## 12. Struktur File
```
app/api/documents/upload/route.ts
app/api/documents/route.ts
app/api/documents/[id]/chunks/route.ts
lib/pdf/renderPages.ts
lib/ai/visionClient.ts
lib/ai/embeddingClient.ts
lib/chunking/splitWithPageTracking.ts
lib/ingest/ingestService.ts
lib/db/vectorStore.ts
db/migrations/001_create_ingestion_tables.sql
tests/renderPages.test.ts
tests/splitWithPageTracking.test.ts
tests/ingestService.test.ts
package.json  (tambahkan: @langchain/core, @langchain/ollama, @langchain/textsplitters, mupdf, pg, bullmq)
```

## 13. Environment Variables
```
OLLAMA_ENDPOINT=http://ollama:11434
VISION_MODEL_NAME=qwen2.5vl:7b
EMBEDDING_MODEL_NAME=bge-m3
EMBEDDING_DIM=1024
DATABASE_URL=postgresql://user:pass@postgres:5432/dbname
REDIS_URL=redis://redis:6379
CHUNK_SIZE=800
CHUNK_OVERLAP=150
```

## 14. Definition of Done
- [ ] Upload `TM 1. Sejarah FT.pdf` (atau PDF serupa) → chunks tersimpan, bisa dilihat lewat `GET /api/documents/[id]/chunks`
- [ ] `content` chunk bisa dibaca manusia (bukan karakter acak) — halaman slide yang tadinya rusak sekarang terbaca jelas lewat AI Vision
- [ ] Chunk menunjukkan rentang halaman yang masuk akal (ada yang 1 halaman, ada yang lintas 2-3 halaman, mengikuti pola sliding window)
- [ ] Test manual vision (test case #2) berhasil — model benar-benar "melihat" gambar, bukan mengarang
- [ ] Semua test di Bagian 11 lolos
- [ ] Tidak ada satupun endpoint `/ask` atau kode DOCX/XLSX/CSV di codebase ini

## 15. Fase Berikutnya (SENGAJA belum dikerjakan, bukan dilupakan)
Setelah PRD ini terbukti jalan dengan benar, baru lanjut satu-per-satu:
1. **Optimasi kecepatan**: tambahkan fast-path ekstraksi teks non-AI untuk PDF yang bukan slide/scan, AI Vision jadi fallback (bukan default untuk semua halaman)
2. **Format lain**: DOCX, XLSX, CSV
3. **Enrichment AI**: lapisan tambahan yang menghasilkan title, tags, importance, dan versi ringkasan bersih (`display_content`) di atas chunk mentah yang sudah ada — ini yang sebelumnya diminta di percakapan sebelumnya, tetap relevan tapi menyusul
4. **PRD 2 (Chatbot)**: dibangun ulang dengan stack Next.js + LangChain.js yang sama, supaya konsisten satu bahasa dengan PRD ini
5. **PRD 3 (Frontend)**: disederhanakan — karena backend sekarang SATU aplikasi Next.js yang sama dengan frontend, tidak perlu lagi proxy ke service Python terpisah