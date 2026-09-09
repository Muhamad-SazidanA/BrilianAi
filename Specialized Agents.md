# Specialized Agents

Dokumen ini merinci arsitektur **Multi-Agent (Specialized Agents)** untuk sistem BrilianAi saat menggunakan **Cloud API**. Dengan memisahkan tanggung jawab ke beberapa agen khusus, sistem menjadi lebih aman (terutama dalam membatasi hak akses RAG), akurat, dan hemat biaya.

---

## 1. Daftar Specialized Agents & Tugasnya

```
[ Ingestion Pipeline ]
  📄 File PDF Upload ──► [Agent 1: Vision Ingestion] ──► [Agent 2: Embedding & Indexing] ──► (pgvector)

[ Chat / Inquiry Pipeline ]
  💬 User Query ───────► [Agent 3: Guardrail & Router] ──► Query ke pgvector
                                                                   │
                                                                   ▼
                         [Agent 5: Evaluator / Safety] ◄── [Agent 4: Synthesizer & RAG Answer]
                                    │
                                    ▼
                               User Chat UI
```

---

### Agent 1: Vision Ingestion Agent
* **Tanggung Jawab:**
  * Menerima gambar hasil render halaman PDF.
  * Mengekstrak teks, membaca struktur tabel secara teratur, serta membersihkan noise (seperti header/footer berulang, watermark).
  * Menghasilkan teks mentah yang rapi sebelum dipotong (*chunking*).
* **Rekomendasi Model:**
  * **Google Gemini 1.5 Flash** (Pilihan Utama: sangat murah, context window besar, akurasi vision luar biasa).
  * *Alternatif:* OpenAI GPT-4o-mini.

---

### Agent 2: Embedding Agent
* **Tanggung Jawab:**
  * Mengubah potongan teks (*chunks*) dari dokumen menjadi representasi vektor numerik.
  * Mengubah query pencarian pengguna menjadi vektor untuk pencarian kemiripan kosinus (*cosine similarity*).
* **Rekomendasi Model:**
  * **OpenAI `text-embedding-3-small`** (Dimensi 1536, sangat murah dan performa tinggi).
  * *Alternatif:* Google `text-embedding-004` (Dimensi 768).

---

### Agent 3: Guardrail & Query Router Agent
* **Tanggung Jawab:**
  * **Menjaga Batasan RAG:** Memeriksa apakah pertanyaan user valid, melanggar kebijakan, atau berusaha melakukan *Prompt Injection* (mencoba menembus dokumen terlarang).
  * **Optimasi Query:** Mengubah bahasa percakapan sehari-hari menjadi query pencarian semantik yang efektif untuk dicocokkan ke database vektor.
  * Menentukan apakah pertanyaan butuh data dokumen (RAG) atau hanya sapaan santai.
* **Rekomendasi Model:**
  * **Google Gemini 1.5 Flash** atau **OpenAI GPT-4o-mini** (Fokus pada latensi sangat cepat dan biaya murah).

---

### Agent 4: RAG Synthesizer & Answer Agent
* **Tanggung Jawab:**
  * Menerima pertanyaan user + potongan dokumen (*context chunks*) yang berhasil diambil dari database.
  * Merangkum dan merumuskan jawaban yang lugas, tepat, dan menyertakan sitasi halaman/sumber dokumen.
  * **Aturan Keras (Zero Hallucination):** Jika jawaban tidak ada di konteks dokumen yang diberikan, agen wajib menjawab bahwa informasi tidak ditemukan.
* **Rekomendasi Model:**
  * **Anthropic Claude 3.5 Sonnet** (Kualitas nalar & sintesis RAG terbaik di industri).
  * *Alternatif:* OpenAI GPT-4o / GPT-4o-mini atau Google Gemini 1.5 Pro.

---

### Agent 5: Safety & Output Evaluator Agent (Opsional tapi Direkomendasikan)
* **Tanggung Jawab:**
  * Melakukan *sanity check* cepat terhadap jawaban sebelum dikirim ke frontend.
  * Memastikan tidak ada data rahasia/sensitif internal perusahaan yang bocor di luar otorisasi pengguna.
* **Rekomendasi Model:**
  * **OpenAI GPT-4o-mini** atau **Gemini 1.5 Flash**.

---

## 2. Link Berlangganan / Subscribe Cloud API

Berikut portal resmi untuk membuat akun, mengisi saldo (kredit), dan mendapatkan API Key:

| Provider | Model yang Dipakai | Fungsi di Sistem | Link Subscribe / Billing |
| :--- | :--- | :--- | :--- |
| **Google AI Studio** | Gemini 1.5 Flash, Text-Embedding-004 | Ingestion Vision, Guardrail, Router | [Google AI Studio Console](https://aistudio.google.com/) <br> *(Ada kuota Free Tier besar sebelum bayar)* |
| **OpenAI Platform** | GPT-4o-mini, text-embedding-3-small | Embedding, Guardrail, Output Safety | [OpenAI API Platform](https://platform.openai.com/signup) <br> *(Top-up kredit mulai $5)* |
| **Anthropic Console** | Claude 3.5 Sonnet | RAG Synthesizer & Jawaban Akhir | [Anthropic Console](https://console.anthropic.com/) <br> *(Top-up kredit mulai $5)* |
| **DeepSeek API** *(Alternatif Hemat)* | DeepSeek-V3 / DeepSeek-R1 | Alternatif Reasoning & Chat sangat murah | [DeepSeek Open Platform](https://platform.deepseek.com/) |

---

## 3. Strategi Efisiensi Biaya (Cost Management)

Jika menggunakan sistem Multi-Agent ini di Cloud API:

1. **Ingestion Dokumen (One-time Cost):**
   * Gunakan **Gemini 1.5 Flash** untuk ekstraksi PDF vision. Biayanya hanya ~$0.00002 per halaman (sangat murah dibanding sewa GPU).
2. **Pencarian (Embedding):**
   * Gunakan **OpenAI `text-embedding-3-small`** ($0.02 per 1 juta token).
3. **Chat Interaktif:**
   * Filter awal via **GPT-4o-mini / Gemini Flash** (~$0.15 per 1 juta token).
   * Jawaban akhir via **Claude 3.5 Sonnet** hanya ketika query benar-benar valid dan relevan.
4. **Estimasi Biaya:**
   * Untuk 50 user aktif per hari, total biaya API umumnya berkisar antara **$10 – $35 / bulan (~Rp 160.000 – Rp 560.000)**, jauh lebih murah dibandingkan menyewa GPU VPS fisik (yang mencapai Rp 4.000.000 – Rp 6.000.000 / bulan).
