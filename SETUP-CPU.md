# Panduan Setup BrilianAi: CPU / Hard Processor Infrastructure

Panduan ini ditujukan untuk menjalankan sistem **BrilianAi tanpa kartu grafis khusus (Non-GPU)**, murni mengandalkan kekuatan prosesor (*hard processor* seperti Intel Xeon, Intel Core i7/i9, atau AMD EPYC/Ryzen) dan RAM sistem berkapasitas besar.

---

## 1. Spesifikasi Hardware & Rekomendasi

Karena inference AI (Vision, Chat, Embedding) berjalan di CPU, sistem sangat bergantung pada **jumlah core, clock speed, dukungan instruksi AVX2/AVX-512, dan bandwidth RAM**.

| Komponen | Spesifikasi Minimum | Rekomendasi Produksi (50 User) |
|---|---|---|
| **Processor (CPU)** | 8 vCPU / 8 Core (Support AVX2) | **16 vCPU / 16 Core+** (AMD EPYC / Intel Xeon Gen 3+) |
| **RAM Sistem** | 16 GB DDR4 | **32 GB - 64 GB DDR4/DDR5** (Dual/Quad Channel wajib) |
| **Storage** | 100 GB SSD SATA | **250 - 500 GB NVMe PCIe Gen4** (Penyimpanan Model & PostgreSQL) |
| **Arsitektur CPU** | x86_64 dengan AVX2 / AVX-512 | x86_64 dengan AVX-512 & VNNI |
| **OS** | Ubuntu 22.04 LTS / Debian 12 | Ubuntu 22.04 LTS Server |

---

## 2. Estimasi Biaya di Indonesia

### A. Sewa VPS CPU Standar di Provider Cloud Indonesia
Ini adalah opsi paling umum dan terjangkau jika ingin server online 24/7 tanpa beli mesin fisik.

| Provider Lokal | Paket / Spesifikasi | RAM | NVMe SSD | Estimasi Biaya per Bulan |
|---|---|---|---|---|
| **IDCloudHost** (Cloud VPS) | 8 vCPU | 32 GB | 200 GB NVMe | **Rp 800.000 - Rp 1.200.000** |
| **Niagahoster / Hostinger ID** | KVM 8 (8 vCPU) | 32 GB | 400 GB NVMe | **Rp 450.000 - Rp 750.000** *(promo durasi panjang)* |
| **Biznet GIO** (NEO Cloud) | 8 vCPU | 32 GB | 160 GB SSD | **Rp 1.100.000 - Rp 1.600.000** |
| **Dewaweb / Rumahweb** | 8 - 12 vCPU Cloud | 32 GB | 200 GB SSD | **Rp 1.400.000 - Rp 2.200.000** |

> 💡 **Bandingkan dengan GPU:** Biaya VPS CPU 32GB RAM ini **10x hingga 15x lebih murah** dibandingkan menyewa GPU H100/L40S per bulan.

### B. Opsi Beli Komputer / Server Mini PC Bare-Metal (On-Premise)
Jika ditaruh di kantor lokal untuk pemakaian internal:

| Komponen Hardware | Rekomendasi Part | Estimasi Harga di Indonesia |
|---|---|---|
| **Mini PC / Barebone** | Minisforum / Beelink (AMD Ryzen 9 7940HS / 8845HS - 8 Core 16 Thread) | Rp 7.500.000 - Rp 11.000.000 |
| **PC Desktop Rakitan** | AMD Ryzen 9 5900X / Intel i7-13700 + Motherboard B660/B550 | Rp 8.000.000 - Rp 12.000.000 |
| **RAM Komputer** | 64GB DDR4/DDR5 (3200MHz/5600MHz) | Rp 2.500.000 - Rp 3.500.000 |
| **NVMe SSD** | 1 TB NVMe Gen4 | Rp 1.200.000 - Rp 1.800.000 |
| **Power Supply & Case** | PSU 550W 80+ Bronze + Casing M-ATX | Rp 1.200.000 - Rp 1.800.000 |
| **Total Investasi Mesin Fisik** | *Server CPU Siap Pakai* | **Rp 12.000.000 - Rp 18.000.000** *(Sekali beli, tanpa sewa bulanan)* |

---

## 3. Langkah-Langkah Setup Server Berbasis CPU

### Langkah 1: Optimasi Sistem Linux Host
Pada CPU, kita perlu memastikan scheduler Linux tidak membatasi performa prosesor:

```bash
# Update sistem
sudo apt update && sudo apt upgrade -y

# Install Docker & Docker Compose
sudo apt install -y curl git htop
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Set governor CPU ke performance (jika server fisik bare-metal)
sudo apt install -y cpufrequtils
sudo systemctl disable ondemand
echo 'GOVERNOR="performance"' | sudo tee /etc/default/cpufrequtils
sudo systemctl restart cpufrequtils
```

---

### Langkah 2: Penyesuaian `docker-compose.yml` Khusus CPU

Karena tidak ada GPU, kita harus membatasi parallel threads agar CPU tidak mengalami *overheating* atau *100% thread lock*:

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    container_name: brilian_ollama
    restart: unless-stopped
    environment:
      - OLLAMA_KEEP_ALIVE=24h
      - OLLAMA_NUM_PARALLEL=1        # WAJIB: 1 request saja pada satu waktu di CPU
      - OLLAMA_FLASH_ATTENTION=0     # Flash attention hanya untuk GPU
    volumes:
      - ollama_data:/root/.ollama
    networks:
      - brilian_internal

  # Service postgres, redis, dan app tetap sama seperti bawaan project
```

---

### Langkah 3: Gunakan Model yang Terkuantisasi Ringan (Quantized)

Model bawaan dengan presisi penuh akan sangat lambat di CPU. Selalu pilih versi quantisasi **Q4_K_M** (4-bit) agar muat di cache memory prosesor dan berjalan lebih cepat:

```bash
# Nyalakan service
docker compose up -d

# Unduh model yang sudah dioptimasi untuk CPU
docker exec -it brilian_ollama ollama pull qwen2.5vl:3b-instruct-q4_K_M
docker exec -it brilian_ollama ollama pull llama3.2:3b-instruct-q4_K_M
docker exec -it brilian_ollama ollama pull bge-m3:q4_k_m
```

---

### Langkah 4: Optimasi Konfigurasi Queue & Worker (PENTING)

Karena inference CPU membutuhkan waktu lebih lama:
1. **Background Processing Wajib:** Pastikan seluruh proses upload PDF diarahkan ke **BullMQ + Redis**, jangan biarkan Next.js Route Handler menunggu secara synchronous.
2. **Naikkan Timeout:** Di file konfigurasi pemanggilan fetch/HTTP client (`lib/ai/visionClient.ts`), naikkan timeout request dari 30 detik menjadi **180 - 300 detik** untuk mencegah error *Gateway Timeout (504)* saat CPU sedang memproses halaman PDF padat.

---

## 4. Analisis Performa & Cara Menangani 50 Concurrent Users

Jika 50 user menggunakan aplikasi secara bersamaan di server CPU murni:

1. **Strategi Antrian (Queueing System):**
   * CPU **TIDAK BISA** melayani 50 user secara instan bersamaan.
   * Redis + BullMQ akan menampung 50 tugas tersebut dalam barisan antrian (*FIFO Queue*).
   * User diberi feedback visual di frontend: *"Dokumen Anda sedang dalam antrean (Urutan ke-3 dari 10)..."*.
2. **Kinerja Chat:**
   * Chat interaktif di CPU memerlukan waktu ~15-30 detik per jawaban.
   * Sangat disarankan mengaktifkan **Server-Sent Events (SSE) / Streaming Response** di Next.js agar user melihat kata demi kata muncul dan tidak merasa sistem sedang hang.

---

## 5. Ringkasan Kelebihan & Kekurangan Setup CPU

### Kelebihan:
* 💰 **Sangat Murah:** Cukup sewa VPS Rp 500rb - Rp 1 jutaan/bulan atau beli mini PC lokal sekali bayar.
* 🛠️ **Tidak Ribet:** Tidak perlu konfigurasi driver NVIDIA, CUDA toolkit, atau isu kompatibilitas hardware GPU.
* 📦 **Kompatibel:** Bisa dideploy di hampir semua cloud provider mana pun di dunia.

### Kekurangan:
* ⏳ **Kecepatan Rendah:** Ekstraksi PDF gambar butuh 30-90 detik per halaman.
* ⚠️ **Mudah Menumpuk:** Jika banyak user upload dokumen tebal sekaligus, antrian akan berjalan lambat.

---

## 6. Konfigurasi Model AI yang Sedang Digunakan Saat Ini (Current Project Tier) & Optimasi Smart Cache

Konfigurasi ini adalah versi bawaan (*default*) yang saat ini aktif di dalam kode project BrilianAi dan disesuaikan untuk server CPU / VPS:

1. **Ingestion Dokumen (AI Vision):**
   * Gunakan **`qwen2.5vl:3b`** (atau versi kuantisasi `qwen2.5vl:3b-instruct-q4_K_M`).
   * **Alasan:** Versi paling ringan yang memungkinkan CPU memproses gambar halaman PDF tanpa menghabiskan seluruh RAM server.

2. **Pencarian (Embedding Vector):**
   * Gunakan **`bge-m3`** (atau `bge-m3:q4_k_m`, dimensi 1024).
   * **Alasan:** Standar industri untuk pencarian semantik teks bahasa Indonesia dan Inggris, cepat dihitung oleh CPU, dan kompatibel penuh dengan pgvector.

3. **Chat Interaktif & RAG:**
   * Gunakan **`llama3.2:3b`** (atau `llama3.2:3b-instruct-q4_K_M`).
   * **Alasan:** Parameter 3B adalah batas optimal untuk CPU agar menghasilkan kecepatan token wajar (~8–15 token/detik) tanpa membuat prosesor *throttling*.

4. **Kebutuhan Resource CPU & Estimasi Biaya:**
   * **Resource Minimum:** 8 vCPU core, 32 GB RAM, 200 GB NVMe SSD.
   * **Pilihan VPS di Indonesia:** IDCloudHost / Niagahoster / Biznet GIO.
   * **Estimasi Biaya Sewa:** **Rp 450.000 – Rp 1.200.000 / bulan** (sangat hemat dibanding GPU).

5. **Optimasi Krusial Penghematan CPU: Smart Cache & Semantic Cache Matcher Agent:**
   * Menjalankan LLM di CPU membutuhkan waktu lama (~15–30 detik per jawaban). Jika 50 user bertanya bersamaan, CPU akan mengalami *bottleneck* parah. Untuk mengatasinya, sistem menerapkan mekanisme cache bertingkat menggunakan tabel database [`chat_response_cache`](file:///c:/Users/msazi/Work/BrilianAi/db/migrations/005_create_chat_response_cache.sql):
     * **Layer 1 — Exact Hash Match (Respons < 0.01 detik):**
       Jika ada pertanyaan yang teksnya persis sama dengan riwayat sebelumnya, sistem langsung mengembalikan jawaban dan sitasi sumber dari tabel `chat_response_cache` berdasarkan `cache_key`. CPU tidak bekerja sama sekali.
     * **Layer 2 — Semantic Cache Matcher Agent (Pencari Kemiripan Makna Pertanyaan):**
       Pengguna sering kali menanyakan hal yang sama dengan kalimat berbeda (contoh: *"Kapan batas pengajuan klaim?"* vs *"Batas klaim tanggal berapa ya?"*).
       * Sebelum memanggil Chatbot LLM utama yang berat, agen perantara (*Semantic Cache Agent*) yang sangat ringan bertugas memeriksa apakah ada pertanyaan di cache yang **memiliki maksud/jawaban yang sama**.
       * **Jika Ditemukan Kemiripan:** Langsung menyajikan jawaban dari cache.
       * **Jika Tidak Ditemukan:** Barulah query diteruskan ke AI Chatbot utama untuk penalaran RAG dokumen penuh, dan jawaban barunya otomatis disimpan ke cache untuk pertanyaan serupa berikutnya.
   * **Dampak Langsung ke Server:** Menghemat beban kerja CPU hingga **50% – 70%**, memangkas waktu tunggu user dari puluhan detik menjadi instan, dan menjaga server VPS tetap dingin serta stabil melayani 50 user.

