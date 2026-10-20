# Panduan & Daftar Pertanyaan Lanjutan Validasi Arsitektur AWS (Bedrock, S3, & Cloud Compute)

Dokumen ini disusun sebagai panduan strategis dan teknis untuk memvalidasi rencana migrasi kecerdasan buatan dan penyimpanan sistem **BrilianAi** ke ekosistem **Amazon Web Services (AWS)**.

Setiap pertanyaan dilengkapi dengan **Rasional / Alasan Mengapa Wajib Ditanyakan**, **Risiko Jika Tidak Divalidasi**, dan **Target Jawaban Ideal dari Tim AWS**.

---

## DAFTAR ISI
1. [Kategori 1: Arsitektur Model, Latensi & Throughput RAG](#kategori-1-arsitektur-model-latensi--throughput-rag)
2. [Kategori 2: Keamanan Data, Kepatuhan & Isolasi Jaringan](#kategori-2-keamanan-data-kepatuhan--isolasi-jaringan)
3. [Kategori 3: Rekayasa Biaya, Efisiensi Token & Skalabilitas](#kategori-3-rekayasa-biaya-efisiensi-token--skalabilitas)
4. [Kategori 4: Ekstraksi Dokumen Kompleks (OCR & Ingestion Pipeline)](#kategori-4-ekstraksi-dokumen-kompleks-ocr--ingestion-pipeline)
5. [Kategori 5: Ketersediaan Tinggi, SLA & Failover Otomatis](#kategori-5-ketersediaan-tinggi-sla--failover-otomatis)
6. [Matriks Penilaian Jawaban Tim AWS](#matriks-penilaian-jawaban-tim-aws)

---

## KATEGORI 1: Arsitektur Model, Latensi & Throughput RAG

### Pertanyaan 1.1: Latensi Respon Pertama (*Time-to-First-Token* / TTFT) pada Streaming SSE
> **Pertanyaan ke AWS:**  
> *"Sistem chat BrilianAi menggunakan streaming Server-Sent Events (SSE) token-demi-token melalui Next.js. Pada model **Anthropic Claude 3.5 Haiku** di AWS Bedrock (Region Singapore / cross-region), berapa rata-rata latensi **Time-to-First-Token (TTFT)** untuk prompt berukuran ~2.500 token input? Apakah ada perbedaan latensi signifikan dibanding model **Meta Llama 3.3 70B**?"*

* **Kenapa Harus Menanyakan Ini:**
  Pengalaman pengguna (*User Experience*) dalam aplikasi chat sangat bergantung pada seberapa cepat kata pertama muncul di layar setelah tombol kirim ditekan. Jika TTFT lambat (> 2.5 detik), pengguna akan mengira sistem mengalami hang atau error.
* **Risiko Jika Tidak Ditanyakan:**
  Arsitektur server di-deploy tanpa optimasi streaming buffer, menyebabkan request sering *time out* di reverse proxy (Nginx) ketika antrean GPU AWS sedang padat.
* **Target Jawaban Ideal dari AWS:**
  TTFT untuk Claude 3.5 Haiku rata-rata di bawah **400 – 700 ms** (sub-detik) untuk 2.500 token input di region Singapore (`ap-southeast-1`).

---

### Pertanyaan 1.2: Kompatibilitas Matrik Jarak Vektor Titan Embeddings V2 di PostgreSQL `pgvector`
> **Pertanyaan ke AWS:**  
> *"Kami menggunakan ekstensi **`pgvector`** di PostgreSQL untuk pencarian semantik similarity. Untuk model **Amazon Titan Text Embeddings V2 (dimensi 1024)**, operator jarak mana yang secara matematis direkomendasikan oleh AWS: **Cosine Distance (`<=>`)**, **Negative Inner Product (`<#>`)**, atau **L2 Euclidean Distance (`<->`)**? Apakah vektor output Titan V2 sudah ternormalisasi (*unit length*) secara default?"*

* **Kenapa Harus Menanyakan Ini:**
  Jika vektor output sudah ternormalisasi ke panjang 1 (*L2 normalized*), operasi Inner Product (`<#>`) jauh lebih cepat diproses oleh CPU/RAM PostgreSQL daripada Cosine Distance, tanpa mengurangi akurasi sama sekali.
* **Risiko Jika Tidak Ditanyakan:**
  Salah memilih operator metrik indeks di database menyebabkan hasil pencarian potongan dokumen tidak relevan (*misaligned*), atau query pencarian database menjadi lambat saat data dokumen mencapai puluhan ribu chunks.
* **Target Jawaban Ideal dari AWS:**
  Titan Embeddings V2 sudah ternormalisasi secara default, sehingga query dapat menggunakan Inner Product (`<#>`) untuk performa tercepat pada indeks HNSW atau IVFFlat.

---

### Pertanyaan 1.3: Kapasitas Konteks Efektif vs *Lost in the Middle*
> **Pertanyaan ke AWS:**  
> *"Claude 3.5 Haiku memiliki context window hingga 200.000 token. Dalam skenario RAG kami, apakah AWS menyarankan tetap menggunakan teknik chunking kecil (Top 4 chunks @ 800 token) atau langsung menyuntikkan dokumen utuh (misal 50.000 token) ke dalam prompt? Bagaimana degradasi akurasi nalar model (*needle-in-a-haystack*) pada Claude Haiku jika konteks diperbesar?"*

* **Kenapa Harus Menanyakan Ini:**
  Memasukkan dokumen utuh memang terdengar mudah, tetapi biaya input token akan membengkak drastis (50.000 token = 20x lipat lebih mahal per chat). Kita perlu validasi apakah chunking RAG tetap merupakan praktik terbaik yang disarankan arsitek AWS.
* **Risiko Jika Tidak Ditanyakan:**
  Tim tergoda membuang pipeline RAG dan memasukkan seluruh file, yang berakibat tagihan token bulanan meledak tanpa peningkatan akurasi jawaban yang signifikan.
* **Target Jawaban Ideal dari AWS:**
  Tetap menyarankan pendekatan RAG modular (chunking 500 – 1.000 token dengan Top-K retrieval) untuk menyeimbangkan akurasi presisi, latensi cepat, dan efisiensi biaya terendah.

---

## KATEGORI 2: Keamanan Data, Kepatuhan & Isolasi Jaringan

### Pertanyaan 2.1: Enkripsi End-to-End dengan AWS KMS (Customer Managed Keys)
> **Pertanyaan ke AWS:**  
> *"Untuk master dokumen di **Amazon S3** dan indeks vektor di database, apakah kami dapat menerapkan enkripsi menggunakan **AWS KMS Customer Managed Keys (CMK)** di mana kunci enkripsi dikontrol sepenuhnya oleh perusahaan kami? Apakah AWS Bedrock dapat mengakses objek terenkripsi CMK di S3 secara *seamless* tanpa mengekspos plaintext ke jaringan publik?"*

* **Kenapa Harus Menanyakan Ini:**
  Untuk dokumen korporat rahasia (SOP internal, data finansial, data SDM), auditor keamanan perusahaan sering kali mewajibkan enkripsi yang kuncinya dipegang sendiri (*Bring Your Own Key* / CMK), bukan kunci default AWS.
* **Risiko Jika Tidak Ditanyakan:**
  Sistem gagal lolos audit keamanan TI internal perusahaan karena enkripsi dianggap masih dipegang penuh oleh pihak ketiga.
* **Target Jawaban Ideal dari AWS:**
  Mendukung integrasi penuh AWS KMS CMK untuk S3 dan Bedrock invocation roles dengan kontrol IAM policy berbasis role granular.

---

### Pertanyaan 2.2: Isolasi Jalur Komunikasi via AWS PrivateLink / VPC Endpoints
> **Pertanyaan ke AWS:**  
> *"Jika server aplikasi BrilianAi kami berada di dalam VPC (Virtual Private Cloud) AWS, apakah komunikasi menuju **Amazon Bedrock API** dan **Amazon S3** dapat menggunakan **VPC Interface Endpoints (AWS PrivateLink)** sehingga trafik data tidak pernah keluar ke jaringan internet publik sama sekali?"*

* **Kenapa Harus Menanyakan Ini:**
  Dokumen internal yang dikirim ke AI tidak boleh melewati jalur internet publik untuk mencegah risiko penyadapan (*man-in-the-middle*) dan kebocoran data.
* **Risiko Jika Tidak Ditanyakan:**
  Trafik API melintasi public internet gateway, menambah latensi jaringan dan meningkatkan celah keamanan jaringan.
* **Target Jawaban Ideal dari AWS:**
  Tersedia VPC Endpoints untuk S3 (Gateway Endpoint, gratis) dan Bedrock (Interface Endpoint via PrivateLink) sehingga seluruh aliran data 100% berada di jaringan privat AWS.

---

### Pertanyaan 2.3: Jaminan Kontrak Tertulis Perlindungan Data (Zero Data Training)
> **Pertanyaan ke AWS:**  
> *"Di mana klausul resmi dalam AWS Service Terms yang menyatakan secara eksplisit bahwa input teks, gambar, dan output di Amazon Bedrock tidak akan pernah digunakan oleh AWS maupun mitra penyedia model (Anthropic / Meta) untuk melatih model dasar (*base foundation models*) mereka?"*

* **Kenapa Harus Menanyakan Ini:**
  Pihak legal dan pimpinan direksi membutuhkan bukti klausul kontrak resmi hitam-di-atas-putih sebelum memberikan izin upload dokumen kantor ke cloud.
* **Risiko Jika Tidak Ditanyakan:**
  Proyek terhenti di tahap persetujuan legalitas (*legal roadblock*) karena ketidakjelasan klausul hak kekayaan intelektual (*IP Protection*).
* **Target Jawaban Ideal dari AWS:**
  AWS menyediakan dokumentasi resmi *Bedrock Data Protection & Privacy FAQ* dan klausul *AWS Customer Agreement Section 50.1* yang menjamin kerahasiaan penuh.

---

## KATEGORI 3: Rekayasa Biaya, Efisiensi Token & Skalabilitas

### Pertanyaan 3.1: Batasan Minimum & Efisiensi Fitur "Prompt Caching"
> **Pertanyaan ke AWS:**  
> *"Terkait fitur **Prompt Caching** di Amazon Bedrock untuk model Claude: berapa batas minimum token agar cache dapat terpicu (misal apakah wajib > 1.024 token)? Berapa lama waktu *Time-to-Live (TTL)* cache tersebut bertahan (misal 5 menit), dan apakah ada biaya penyimpanan cache terpisah?"*

* **Kenapa Harus Menanyakan Ini:**
  Prompt Caching memotong biaya input token hingga 90% (dari $0.80 menjadi $0.08 per 1M token). Namun fitur ini memiliki syarat teknis minimum token. Kita harus menyesuaikan arsitektur prompt kita agar selalu memenuhi batas minimum tersebut.
* **Risiko Jika Tidak Ditanyakan:**
  Kita berekspektasi mendapat diskon 90%, namun ternyata prompt kita tidak memenuhi syarat minimum token cache sehingga tetap ditagih tarif penuh.
* **Target Jawaban Ideal dari AWS:**
  Batas minimum cache adalah 1.024 token, TTL default 5 menit (diperbarui otomatis setiap ada request baru), dengan diskon biaya input token hingga 90%.

---

### Pertanyaan 3.2: Analisa Biaya Request Amazon S3 (API Calls: PUT, GET, LIST)
> **Pertanyaan ke AWS:**  
> *"Dalam arsitektur RAG, selain biaya penyimpanan storage per GB ($0.023/GB), Amazon S3 juga menagih per request API (Tier 1 PUT/POST: $0.005 per 1.000 req; Tier 2 GET: $0.0004 per 1.000 req). Jika ribuan user membaca dokumen secara simultan, bagaimana rekomendasi AWS untuk mengoptimalkan frekuensi pemanggilan S3 agar biaya request tidak membengkak?"*

* **Kenapa Harus Menanyakan Ini:**
  Biaya storage S3 biasanya sangat murah, tetapi jika sistem salah arsitektur (misal membaca file master PDF dari S3 setiap kali ada pertanyaan chat, alih-alih membaca teks chunk di database), biaya request API S3 bisa lebih mahal dari biaya sewa storage-nya.
* **Risiko Jika Tidak Ditanyakan:**
  Muncul tagihan tidak terduga pada item penagihan *S3 API Requests Tier 1 / Tier 2*.
* **Target Jawaban Ideal dari AWS:**
  Menyimpan master file di S3 hanya saat proses upload awal, sedangkan teks hasil ekstraksi disimpan langsung di PostgreSQL/Redis untuk melayani chat harian, sehingga panggilan GET ke S3 hampir nol saat sesi tanya-jawab.

---

### Pertanyaan 3.3: Ambang Batas Beralih dari On-Demand ke Provisioned Throughput
> **Pertanyaan ke AWS:**  
> *"Kapan sebuah sistem enterprise disarankan beralih dari model **On-Demand Pay-per-Token** ke **Provisioned Throughput (Model Units / MU)** di Bedrock? Berapa estimasi volume pertanyaan chat harian di mana model langganan komitmen (1 bulan / 6 bulan) menjadi lebih ekonomis dibanding bayar per token?"*

* **Kenapa Harus Menanyakan Ini:**
  Mengetahui rencana jangka panjang (*roadmap scaling*). Saat pengguna bertambah dari 50 ke 5.000 orang, kita perlu tahu titik transisi anggaran yang paling menguntungkan perusahaan.
* **Risiko Jika Tidak Ditanyakan:**
  Terlambat melakukan komitmen saat traffic tinggi (membayar On-Demand terlalu mahal), atau sebaliknya terlalu cepat membeli Provisioned Throughput saat traffic masih rendah (rugi membayar kapasitas nganggur).
* **Target Jawaban Ideal dari AWS:**
  On-Demand jauh lebih hemat untuk volume di bawah puluhan juta token per hari. Provisioned Throughput hanya disarankan jika membutuhkan jaminan kapasitas mutlak tanpa batas throttling.

---

## KATEGORI 4: Ekstraksi Dokumen Kompleks (OCR & Ingestion Pipeline)

### Pertanyaan 4.1: Penanganan Batasan Ukuran Payload Sinkron (Sync vs Async Ingestion)
> **Pertanyaan ke AWS:**  
> *"API pemanggilan sinkron Bedrock dan Amazon Textract memiliki batas ukuran file maksimum (biasanya 5 MB hingga 10 MB per request). Jika pengguna kami mengunggah dokumen PDF laporan tebal berukuran 50 MB hingga 150 MB (misal 100 halaman), arsitektur pemrosesan asinkron apa yang direkomendasikan AWS (misal: S3 Event Notification $\rightarrow$ AWS Lambda / SQS $\rightarrow$ Background Worker)?"*

* **Kenapa Harus Menanyakan Ini:**
  Aplikasi web Next.js memiliki batas timeout request (biasanya 30 – 60 detik). Mengunggah PDF tebal tidak mungkin diproses langsung secara sinkron dalam 1 request HTTP.
* **Risiko Jika Tidak Ditanyakan:**
  Aplikasi mengalami error HTTP 504 Gateway Timeout dan crash saat pengguna mengunggah dokumen berukuran besar.
* **Target Jawaban Ideal dari AWS:**
  Gunakan arsitektur asinkron berbasis antrean (di BrilianAi sudah ada BullMQ & Redis, dapat diintegrasikan dengan worker pemecah halaman PDF).

---

### Pertanyaan 4.2: Evaluasi Akurasi Tabel Kompleks: Textract vs Claude Multimodal Vision
> **Pertanyaan ke AWS:**  
> *"Untuk dokumen keuangan atau laporan teknis Indonesia yang memiliki tabel bertingkat (*merged cells*) dan scan beresolusi rendah, apakah fitur **Amazon Textract Tables Feature ($0.015/halaman)** menghasilkan struktur Markdown/JSON yang lebih akurat dibandingkan langsung memproses gambar halaman via **Claude 3.5 Haiku Vision**?"*

* **Kenapa Harus Menanyakan Ini:**
  Tabel adalah bagian paling rentan salah baca dalam sistem RAG. Jika angka kolom tertukar barisnya, AI akan memberikan jawaban finansial yang fatal dan menyesatkan.
* **Risiko Jika Tidak Ditanyakan:**
  Salah memilih teknologi ekstraksi yang mengakibatkan data angka di dalam tabel dokumen tidak terbaca dengan benar oleh AI.
* **Target Jawaban Ideal dari AWS:**
  Penjelasan komparatif kapan harus memakai Textract Layout/Table analysis dan kapan cukup memakai Vision LLM.

---

## KATEGORI 5: Ketersediaan Tinggi, SLA & Failover Otomatis

### Pertanyaan 5.1: Fitur Cross-Region Inference untuk Mengatasi Antrean GPU
> **Pertanyaan ke AWS:**  
> *"AWS Bedrock menyediakan fitur **Cross-Region Inference Profile** (misal `us.anthropic.claude-3-5-haiku...` atau `apac.anthropic.claude...`). Apakah fitur ini tersedia untuk wilayah Asia Pasifik? Apakah ada biaya tambahan jika trafik dialihkan secara dinamis ke datacenter AWS lain saat region utama sedang mengalami lonjakan beban?"*

* **Kenapa Harus Menanyakan Ini:**
  Fitur Cross-Region Inference dari AWS memungkinkan request chat diarahkan secara cerdas ke datacenter yang sedang longgar tanpa biaya tambahan, menghilangkan error *throttling* saat jam sibuk kantor.
* **Risiko Jika Tidak Ditanyakan:**
  Aplikasi terkena dampak saat terjadi gangguan sementara atau antrean GPU di satu region AWS tertentu.
* **Target Jawaban Ideal dari AWS:**
  Cross-Region Inference tidak dikenakan biaya tambahan (harga per token sama persis) dan sangat disarankan untuk meningkatkan ketersediaan (*availability*).

---

### Pertanyaan 5.2: Kebijakan SLA & Prosedur Eskalasi Insiden Kritis
> **Pertanyaan ke AWS:**  
> *"Berapa SLA ketersediaan resmi untuk Amazon Bedrock dan Amazon S3 (apakah 99.9% atau 99.99%)? Jika terjadi penurunan performa atau error tak terduga di lingkungan produksi, paket dukungan teknis (*AWS Support Plan: Developer, Business, atau Enterprise*) level apa yang wajib kami miliki untuk mendapatkan respon di bawah 1 jam?"*

* **Kenapa Harus Menanyakan Ini:**
  Menentukan paket langganan support AWS yang perlu dianggarkan perusahaan agar jika terjadi kendala teknis darurat, tim engineer AWS segera membantu investigasi.
* **Risiko Jika Tidak Ditanyakan:**
  Saat ada gangguan di hari kerja, tiket bantuan hanya direspon 24 – 48 jam kemudian karena hanya menggunakan akun free basic support.
* **Target Jawaban Ideal dari AWS:**
  SLA Bedrock adalah 99.9%. Untuk respon teknis cepat di bawah 1 jam pada jam operasional, disarankan memiliki minimal *AWS Business Support*.

---

## MATRIKS PENILAIAN JAWABAN TIM AWS

Gunakan tabel centang berikut saat meeting atau menerima email balasan dari tim AWS:

| Kriteria Penilaian | Indikator Baik (Lanjut Implementasi) | Indikator Perlu Perhatian (Mitigasi Risiko) |
| :--- | :--- | :--- |
| **Ketersediaan Region** | Model Claude 3.5 Haiku sudah ada di Singapore (`ap-southeast-1`) dengan latensi < 100ms ke Indonesia. | Model hanya ada di US (`us-east-1`), perlu antisipasi latensi jaringan ~200ms. |
| **Biaya Tersembunyi** | Murni hanya token input & output, in-region S3 transfer gratis. | Ada biaya minimum commit bulanan yang memberatkan budget awal. |
| **Kedaulatan Data** | Ada jaminan tertulis *Zero Data Retention & No Training*. | Kebijakan log data ambigu atau tidak ada kepastian tertulis. |
| **Dukungan PoC** | Diberikan AWS Activate Credits / PoC Credits ($500 – $2.000). | Tidak ada program kredit uji coba sama sekali. |
| **Penagihan Lokal** | Bisa terbit IDR dan Faktur Pajak PPN 11% via PT AWS Indonesia. | Hanya bisa USD via kartu kredit internasional. |

---
*Dokumen ini dapat digunakan sebagai lampiran diskusi teknis (*Technical Request for Information / RFI*) bersama tim arsitek solusi AWS.*
