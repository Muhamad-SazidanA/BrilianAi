# Panduan Setup BrilianAi: Cloud GPU (VPS GPU)

Dokumen ini khusus membahas implementasi **Cloud GPU (Sewa VPS GPU)** untuk sistem BrilianAi. Pendekatan ini cocok untuk deployment produksi tanpa perlu membeli dan merawat server fisik sendiri.

---

## 1. Pilihan Instance Cloud GPU & Estimasi Harga di Indonesia

Pilihan GPU dari penyedia infrastruktur cloud lokal / regional:

| Opsi Instance | Spesifikasi GPU & Server | Harga Sewa per Jam | Estimasi Biaya / Bulan (24/7) | Strategi Pemakaian (Hemat) |
|---|---|---|---|---|
| **vGPU L40S (24GB)** | 24GB vGPU L40S, 8 vCPU, 32GB RAM | **Rp 18.000 / jam** | ~Rp 12.960.000 / bln | Cocok untuk masa uji coba / staging (Shared vGPU). |
| **MIG H100 (20GB)** | 20GB MIG H100 SXM5, 8 vCPU, 32GB RAM | **Rp 24.500 / jam** | ~Rp 17.640.000 / bln | **Rekomendasi Utama Produksi** (Bandwidth memori 2TB/s, isolasi dedicated). |
| **Dedicated L40S (48GB)**| 48GB 1 GPU L40S, 8 vCPU, 128GB RAM | **Rp 34.500 / jam** | ~Rp 24.840.000 / bln | Untuk kapasitas >100 user aktif atau model besar. |
| **Dedicated H100 (80GB)**| 80GB 1 GPU H100 SXM5, 8 vCPU, 128GB RAM | **Rp 79.000 / jam** | ~Rp 56.880.000 / bln | Enterprise level (Overkill untuk 50 user). |

> 💡 **Trik Hemat (Scale to Zero / Jam Kerja):**
> Jika VPS Cloud GPU hanya dinyalakan saat jam operasional kerja (Senin–Jumat, 08:00 – 17:00 = ~9 jam/hari × 22 hari = ~198 jam):
> * **Biaya H100 MIG 20GB:** 198 jam × Rp 24.500 = **~Rp 4.851.000 / bulan**.

---

## 2. Karakteristik & Kelebihan Cloud GPU

* **Tanpa Modal Awal (Zero CapEx):** Tidak perlu mengeluarkan puluhan juta rupiah di awal untuk beli PC/server.
* **Performa Enterprise:** Mendapatkan akses ke chip akselerator data center (NVIDIA SXM5 H100 / L40S) yang tidak dijual bebas untuk komputer desktop rumahan.
* **Jaringan & Uptime:** Terhubung langsung dengan koneksi internet Data Center Tier-3 (1 Gbps - 10 Gbps low latency).
* **Fleksibilitas:** Bisa *upgrade* atau *downgrade* spesifikasi GPU kapan saja sesuai pertumbuhan user.

---

## 3. Langkah-Langkah Deployment di Cloud GPU

### Langkah 1: Verifikasi Akses Driver GPU di Instance Cloud
Sebagian besar Cloud GPU sudah menyertakan NVIDIA Driver. Cukup verifikasi via SSH:

```bash
# Cek apakah GPU sudah terdeteksi
nvidia-smi
```

Jika NVIDIA Container Toolkit belum terpasang di VM:
```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt update
sudo apt install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

---

### Langkah 2: Konfigurasi `docker-compose.yml` untuk Cloud GPU

Pastikan container Ollama mengaktifkan driver NVIDIA:

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    container_name: brilian_ollama
    restart: unless-stopped
    environment:
      - OLLAMA_KEEP_ALIVE=24h
      - OLLAMA_NUM_PARALLEL=2          # 2 request concurrent sekaligus
      - OLLAMA_FLASH_ATTENTION=1       # Efisiensi VRAM dan kecepatan inference
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    networks:
      - brilian_internal
```

---

### Langkah 3: Menjalankan Container & Mengunduh Model

1. Jalankan aplikasi:
   ```bash
   docker compose up -d
   ```

2. Unduh model ke dalam instance Ollama:
   ```bash
   docker exec -it brilian_ollama ollama pull qwen2.5vl:3b
   docker exec -it brilian_ollama ollama pull llama3.2:3b
   docker exec -it brilian_ollama ollama pull bge-m3
   ```

3. Pantau pemakaian memori VRAM:
   ```bash
   watch -n 1 nvidia-smi
   ```

---

## 4. Opsi Hybrid (Paling Direkomendasikan untuk Efisiensi)

Jika biaya Cloud GPU 24 jam masih terasa berat, pisahkan arsitektur menjadi **Hybrid Cloud**:
1. **VPS Reguler (Non-GPU) - Rp 500rb/bulan:** Menjalankan Next.js, PostgreSQL pgvector, dan Redis 24 jam non-stop.
2. **Cloud GPU Instance - Rp 24.500/jam:** Hanya menjalankan Ollama, dinyalakan sesuai kebutuhan batch ingestion atau jam kerja.

---

## 5. Rekomendasi Konfigurasi AI Terbaik (The Best Tier)

1. **Ingestion Dokumen (AI Vision):**
   * Gunakan **`qwen2.5vl:7b`** (~6 GB VRAM).
   * **Alasan:** Model vision *open-source* terbaik di dunia saat ini (setara GPT-4o Vision). Sangat presisi membaca tata letak dokumen rumit, tabel bergaris rapat, teks multi-kolom, dan tahan terhadap dokumen hasil *scan* yang miring/buram. Data yang masuk ke database dijamin bersih dan akurat.

2. **Pencarian (Embedding Vector):**
   * Gunakan **`bge-m3`** (~1.5 GB VRAM, dimensi 1024).
   * **Alasan:** Standar emas model embedding *multilingual* untuk bahasa Indonesia dan Inggris. Mampu menangkap konteks semantik dokumen secara mendalam dengan waktu pemrosesan sangat cepat di GPU (~5–10 milidetik per chunk).

3. **Chat Interaktif & RAG:**
   * Gunakan **`qwen2.5:7b-instruct`** (~5.5 GB VRAM).
   * **Alasan:** Memiliki pemahaman tata bahasa Indonesia yang jauh lebih natural dibanding model 3B, penalaran (*reasoning*) RAG yang kuat tanpa halusinasi, dan *context window* besar sehingga tidak akan lupa pada isi dokumen yang panjang saat menjawab 50 user.

4. **GPU yang Disesuaikan & Estimasi Biaya:**
   * **Total Kebutuhan VRAM:** ~6 GB + ~1.5 GB + ~5.5 GB + ~3.5 GB (KV Cache antrean user) = **~16.5 GB VRAM**.
   * **GPU Terpilih:** **NVIDIA H100 MIG 20GB** *(SXM5, 8 vCPU, 32 GB RAM Sistem)* — **Rp 24.500 / jam**.
   * **Estimasi Biaya Sewa di Indonesia:**
     * **Opsi Hemat Jam Kerja (08:00 – 17:00 / 22 hari kerja):** **~Rp 4.850.000 / bulan**.
     * **Opsi Standby Penuh (24 Jam / 7 Hari Non-stop):** **~Rp 17.640.000 / bulan**.
   * **Nilai Tambah:** Seluruh data dokumen rahasia perusahaan 100% aman di server lokal Anda sendiri, tanpa ada satu byte pun data yang dikirim ke server asing.


