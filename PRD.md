# PRD Utama: Brilian&#32;

*Active Knowledge Management System (KMS) internal. Status: Final**.** **Seluruh angka target bersifat usulan awal dan harus divalidasi dengan baseline operasional perusahaan.*

## 1. Visi, Tujuan, dan Ruang Lingkup

Brilian AI adalah KMS aktif yang menjadikan pengetahuan perusahaan mudah ditemukan, tepercaya, selalu mutakhir, dan aman diakses sesuai hak. Dokumen ini adalah **PRD Utama**: ia menetapkan mesin, tata kelola, dan keamanan; PRD turunan per bidang (HR, legal, logistik, dst.) dan PRD antarmuka dua portal mengacu padanya.

| # | Tujuan | Metrik | Target 6 bulan (usulan) |
| --- | --- | --- | --- |
| G1 | Pencarian jawaban lebih cepat | Waktu menemukan jawaban | Turun ≥ 60% dari baseline |
| G2 | Jawaban tepercaya | Jawaban dengan sitasi benar (set uji) | ≥ 90% |
| G3 | Pengetahuan selalu segar | Dokumen aktif berpemilik dan belum lewat tinjau | ≥ 85% |
| G4 | Kesenjangan pengetahuan tertutup | Pertanyaan gagal dijawab yang ditindaklanjuti | ≥ 70% per kuartal |
| G5 | Adopsi | Pengguna aktif mingguan dari target | ≥ 60% |
| G6 | Keamanan | Kebocoran lintas hak akses | 0 |

**Pengguna.** Staf operasional (SOP, troubleshooting), supervisor/manajer (kebijakan, referensi keputusan), eksekutif (ringkasan pengetahuan dan kesehatan KMS), **Pemilik Dokumen** (menjaga isi tetap benar), dan **Administrator KMS** (akses, konektor, kualitas), serta Pembuat Halaman terpilih (membuat dashboard dan halaman pengetahuan).

**Dalam lingkup:** ingestion dan kurasi dokumen, pencarian dan jawaban bersitasi, tata kelola siklus hidup, penangkapan pengetahuan tersirat, keterhubungan, analitik pengetahuan, dashboard dan halaman pengetahuan interaktif (hanya oleh Pembuat Halaman terpilih), konektor dan integrasi sumber data (dokumen, API, database read-only, MCP), onboarding, persona agent, RBAC, audit.

**Di luar lingkup:** eksekusi operasional (tiket, email massal, jadwal), query bebas ke tabel transaksi mentah, rekonsiliasi dokumen, generator laporan dan pitchdeck, dashboard dari data transaksi, bot yang bertindak atas nama pengguna. Slack/Teams hanya sebagai *kanal tanya-jawab*, dan konektor Drive/Notion/Gmail hanya sebagai *sumber dokumen* (read-only).

## 2. Fitur Inti

Prioritas: **MVP** = rilis awal, **P1** = rilis kedua, **P2** = lanjutan.

### A. Ingestion dan Kurasi Pengetahuan

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| A1 | Ingestion PDF, DOCX, XLSX, PPTX, TXT, dan email (EML). PDF diproses *in-memory* tanpa menulis file ke disk; teks dan tabel diambil dari lapisan teks digital lebih dulu (jalur cepat), sedangkan halaman pindaian atau berkualitas ekstraksi rendah dirender lalu dibaca model vision (lihat K4); header, footer, watermark, dan nomor halaman dibersihkan. | MVP |
| A2 | OCR Bahasa Indonesia dan Inggris untuk pindaian dan foto, dengan skor kepercayaan dan antrean verifikasi manual untuk skor rendah. | MVP |
| A3 | Chunking terstruktur (≈ 800 karakter, overlap ≈ 150) yang mencatat rentang halaman sumber; tabel dipertahankan sebagai Markdown. | MVP |
| A4 | Kurasi otomatis menjadi *insight*: judul, konten bersih, tingkat kepentingan (high/medium/low), kategori, dan tag; hasil kurasi dapat diedit pemilik. | MVP |
| A5 | Metadata wajib saat unggah: pemilik, divisi, klasifikasi (Publik/Internal/Rahasia/Sangat Rahasia), tanggal berlaku, tanggal tinjau. | MVP |
| A6 | Antrean pemrosesan latar belakang dengan progres dan percobaan ulang untuk dokumen tebal. | MVP |

### B. Pencarian dan Jawaban Bersitasi

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| B1 | Pencarian hibrida (semantik + kata kunci) dengan *reranker*, agar kode part dan nomor dokumen tetap akurat. | MVP |
| B2 | Jawaban hanya dari dokumen aktif yang berhak diakses; bila bukti kurang, jawab "tidak ditemukan" dan catat sebagai kesenjangan. | MVP |
| B3 | Sitasi: nama file, versi, halaman awal-akhir; **viewer sitasi** membuka halaman asli dengan teks tersorot. | MVP |
| B4 | Kutipan pasal dan klausul tidak diubah maknanya dan urutan katanya. | MVP |
| B5 | Kepatuhan format permintaan (jumlah poin/paragraf, ringkas/detail, tabel perbandingan). | P1 |
| B6 | **Glosarium dan sinonim perusahaan**: singkatan dan istilah internal dipetakan ke istilah baku. | P1 |
| B7 | **Smart Cache aman**: kunci cache mencakup kelompok hak akses dan versi dokumen; kedaluwarsa otomatis saat dokumen berubah; SHA-256 untuk hash; ambang kemiripan dan syarat tambahan mengikuti K6. | P1 |
| B8 | Tombol umpan balik per jawaban (berguna, salah, dokumen usang) masuk antrean perbaikan. | P1 |

### C. Tata Kelola Siklus Hidup Pengetahuan

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| C1 | **Pemilik dokumen** dan tanggal tinjau ulang; pengingat otomatis bila mendekati kedaluwarsa, dan dokumen lewat tinjau diberi tanda basi. | MVP |
| C2 | **Alur status**: Draft, Review, Aktif, Superseded, Arsip, dengan persetujuan pemilik/admin; hanya status Aktif yang dirujuk jawaban. | MVP |
| C3 | Deteksi duplikasi dan revisi; versi lama tetap dapat ditelusuri. | MVP |
| C4 | **Perbandingan versi (diff)** antara revisi lama dan baru, dengan ringkasan perubahan. | P1 |
| C5 | **Baca-dan-setuju**: pengguna terdampak diberi tahu revisi SOP dan mengonfirmasi sudah membaca; tercatat di audit log. | P1 |

### D. Akses dan Keamanan

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| D1 | RBAC (Superadmin, Admin, Member) **ditambah ABAC**: akses per divisi dan klasifikasi dokumen. Filter diterapkan pada tahap retrieval, sebelum konten masuk ke model. | MVP |
| D2 | Mode deployment dan model AI: tahap pengujian saat ini memakai mode Cloud (model cloud, hanya data uji atau non-sensitif); pelanggan yang menginginkan data sepenuhnya di infrastruktur sendiri memakai mode On-premise (model lokal via Ollama); VPC privat milik perusahaan (misalnya AWS) tersedia sebagai opsi hosting model. Data produksi berklasifikasi Rahasia ke atas hanya diproses di On-premise atau VPC privat, tanpa jalur internet publik, tanpa retensi, dan tanpa pelatihan atas data; model cloud publik hanya untuk klasifikasi rendah, dengan perjanjian *zero data retention*. Fallback bertingkat antar model dalam mode yang sama dan circuit breaker. | MVP |
| D3 | SSO internal (JWT asimetris, cookie HttpOnly lintas portal), MFA, enkripsi saat transit dan tersimpan, kata sandi bcrypt/argon2. | MVP |
| D4 | Audit log tak dapat diubah (login, unggah, ubah status, akses dokumen Rahasia, ekspor, berbagi chat) dengan ekspor CSV. | MVP |
| D5 | **Share Chat aman**: masa berlaku, pencabutan, hanya tautan internal secara default, publik hanya dengan persetujuan admin dan masking data sensitif. | P1 |
| D6 | Perlindungan prompt injection: isi dokumen diperlakukan sebagai data, bukan instruksi. | MVP |
| D7 | Masking data pribadi (NIK, rekening) dan kepatuhan UU PDP No. 27 Tahun 2022. | P1 |
| D8 | Konsistensi embedding: satu model embedding per instalasi (mode Cloud: text-embedding-3-small diatur ke 1024 dimensi; mode On-premise: BGE-M3, 1024 dimensi). Vektor dari model berbeda tidak dicampur dalam satu indeks; versi embedding tercatat per dokumen, dan pindah mode atau model memerlukan index ulang. | MVP |

## 3. Fitur Lanjutan

### E. Menangkap Pengetahuan Tersirat

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| E1 | **Jawaban terverifikasi pakar** (*golden answer*): jawaban yang disetujui ahli diprioritaskan di atas hasil otomatis. | P1 |
| E2 | **Tanya pakar**: bila AI tidak menemukan jawaban, pertanyaan diteruskan ke pemilik topik; jawaban yang disetujui masuk ke basis pengetahuan. | P1 |
| E3 | **Lessons learned**: logbook, catatan insiden, dan notulen diubah menjadi artikel pengetahuan yang dapat dicari, untuk mengurangi kehilangan pengetahuan saat karyawan berganti. | P2 |

### F. Keterhubungan dan Analitik Pengetahuan

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| F1 | Dokumen terkait dan koleksi/bookmark per pengguna atau tim. | P1 |
| F2 | **Knowledge graph ringan**: relasi mesin, part, vendor, SOP, dan insiden. | P2 |
| F3 | **Laporan kesenjangan pengetahuan**: pertanyaan yang gagal dijawab, diurutkan frekuensi. | P1 |
| F4 | **Knowledge Health Score**: persentase dokumen segar, berpemilik, dan terpakai; daftar dokumen tak pernah diakses sebagai kandidat arsip. | P1 |
| F5 | **Evaluasi otomatis**: set pertanyaan uji dijalankan tiap perubahan model atau korpus, dengan skor akurasi sitasi. | MVP |

### G. Onboarding Berbasis Pengetahuan

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| G1 | Jalur belajar per peran: rangkaian dokumen wajib untuk karyawan baru. | P2 |
| G2 | Kuis otomatis dari SOP untuk memastikan pemahaman. | P2 |

### H. Personalisasi Agent dan Dua Portal

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| H1 | **Custom Agent Persona** per pengguna: nama, tone (profesional, santai, socratic, analitis), detail\_level (short, medium, comprehensive), peran, bahasa. Dapat diatur lewat perintah "Atur Agent" di chat atau berkas `/.brilian-config/Agent.md` (YAML frontmatter + instruksi) dengan sinkronisasi dua arah. Persona hanya mengubah gaya, **tidak boleh** melonggarkan aturan sitasi, hak akses, atau anti-halusinasi. | P1 |
| H2 | **Portal Agent Studio** (Superadmin dan Admin): manajemen basis pengetahuan, kurasi, Agent Builder (prompt inti dan pilihan model per agen), serta System & Security (akun SSO, audit, observabilitas token). | MVP |
| H3 | **Portal Assistant** (semua peran): chat dengan streaming dan Markdown, pemilih agen, riwayat sesi, dan share chat. App Switcher tanpa login ulang. | MVP |
| H4 | Akun dibuat admin dengan status `pending_activation`; pengguna menetapkan kata sandi lewat tautan email. | MVP |

### I. Dashboard dan Halaman Pengetahuan Interaktif

Pengguna dapat meminta Brilian AI mengubah hasil chat atau analitik pengetahuan menjadi **dashboard** atau **halaman pengetahuan (landing page) interaktif** yang dapat diatur dan diubah. **Hanya pengguna terpilih (peran Pembuat Halaman) yang boleh membuat, mengubah, dan menerbitkannya.** Pengguna lain hanya membuka halaman terbit dan memakai filter.

| Peran | Hak |
| --- | --- |
| Pembuat Halaman (dipilih Administrator) | Membuat dari chat, menyunting, menyimpan draf, dan menerbitkan sesuai cakupan izinnya |
| Administrator | Menetapkan dan mencabut izin Pembuat, menyetujui terbit untuk audiens luas atau klasifikasi Rahasia ke atas |
| Pembaca (semua peran, sesuai hak akses) | Membuka halaman terbit dan memakai filter; tidak dapat mengubah struktur |
| Member tanpa izin Pembuat | Tombol "Jadikan dashboard" tidak tampil; bila diminta lewat chat, sistem menjelaskan batasnya dan menawarkan meneruskan permintaan ke Pembuat Halaman |

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| I1 | **Izin Pembuat Halaman**: diberikan Administrator per pengguna atau grup, dengan cakupan divisi dan batas klasifikasi data yang boleh dipakai; dapat dicabut atau kedaluwarsa; pemberian dan pencabutan tercatat di audit log. | P1 |
| I2 | **Dari chat ke dashboard**: Pembuat meminta lewat chat atau tombol, dan sistem menyusun draf dari hasil analitik (kesenjangan pengetahuan, Health Score, kepatuhan baca-dan-setuju, penggunaan) atau dari dokumen aktif. | P1 |
| I3 | **Penyuntingan interaktif**: ubah jenis grafik, filter (divisi, periode, klasifikasi), judul, urutan, dan tata letak widget lewat klik atau perintah chat (misalnya "ubah jadi bar per divisi"); undo dan riwayat versi. | P1 |
| I4 | **Halaman pengetahuan per tim atau bidang**: dirakit dari SOP aktif, FAQ terverifikasi, koleksi dokumen, dan widget, memakai templat yang disetujui perusahaan. | P1 |
| I5 | **Siklus terbit**: Draft, Review, Terbit, Arsip. Terbit ke audiens dalam cakupan izin Pembuat boleh langsung; terbit ke audiens lebih luas atau berisi data Rahasia ke atas wajib persetujuan Administrator. | P1 |
| I6 | **Hak akses pembaca dievaluasi saat dibuka**: widget yang di luar hak pembaca tampil sebagai "tidak tersedia"; Pembuat tidak dapat memberi akses melebihi hak pembaca. | P1 |
| I7 | **Sumber dan kesegaran data**: tiap widget menampilkan sumber dan waktu pembaruan terakhir; angka dari dokumen bersitasi; sumber hanya data KMS (metadata dokumen, log penggunaan, kepatuhan, isi dokumen berhak akses, dan view database terkurasi dari J3), bukan tabel transaksi mentah. | P1 |
| I8 | **Berbagi aman**: internal secara default; tautan publik hanya dengan persetujuan Administrator, masa berlaku, masking data sensitif, dan dapat dicabut (selaras D5). | P1 |
| I9 | **Pembaruan otomatis**: data diperbarui terjadwal; halaman yang merujuk dokumen berubah status diberi tanda "perlu ditinjau". | P2 |
| I10 | **Tata kelola halaman**: setiap halaman berpemilik dan bertanggal tinjau (selaras C1), dengan batas jumlah halaman per Pembuat dan audit log pembuatan, perubahan, terbit, dan pencabutan. | P1 |

I1, I6, dan I7 wajib ada sebelum fitur I lain dirilis. Metrik usulan: ≥ 80% halaman terbit berpemilik dan bersumber jelas; 0 kebocoran lintas hak akses pada uji pembaca; waktu dari permintaan chat ke draf ≤ 2 menit.

### J. Konektor dan Integrasi Sumber Data

Brilian AI mengambil pengetahuan dari empat jalur: unggah manual (A1-A6), konektor dokumen, API, dan database read-only; serta dapat dihubungkan ke aplikasi AI lain lewat MCP. Semua jalur bersifat **hanya baca**, mewarisi hak akses dan klasifikasi, dan diatur lewat tata kelola konektor (J5).

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| J1 | **Konektor dokumen read-only** (Google Drive, SharePoint, Notion, Confluence, email): sinkronisasi terjadwal; mewarisi izin sumber; metadata (pemilik, divisi, klasifikasi) dipetakan otomatis atau ditandai untuk dilengkapi; perubahan di sumber memicu versi baru. | P1 |
| J2 | **API ingestion**: endpoint REST untuk unggah, cek status, dan hapus, plus webhook status pemrosesan; autentikasi per layanan (OAuth atau API key berlingkup), rate limit, batas ukuran; sistem internal (DMS, ERP) dapat mengirim dokumen dengan metadata wajib dari A5. | P1 |
| J3 | **Konektor database read-only** (PostgreSQL, MySQL): lewat *read replica* dan akun read-only; hanya tabel atau view terkurasi (*allowlist*) yang disetujui Pemilik Data; batas baris dan waktu; kolom sensitif dimasking. Dipakai untuk data referensi (daftar mesin, vendor, struktur organisasi) sebagai pengetahuan terstruktur dan sumber widget dashboard (I7). Tidak ada pembacaan bebas atas tabel transaksi mentah; setiap kueri tercatat di audit log. | P1 |
| J4 | **MCP**: (a) *server*: mengekspos pencarian bersitasi dan baca dokumen (hanya baca) ke aplikasi AI lain, dengan token berlingkup per pengguna, hak akses pengguna pemanggil, rate limit, dan audit log; (b) *klien*: memakai alat hanya-baca dari server MCP yang disetujui Administrator (*allowlist*), dengan hasil diperlakukan sebagai data tidak tepercaya. Aksi tulis di luar lingkup. | P2 |
| J5 | **Tata kelola konektor**: registri konektor; persetujuan Administrator dan Pemilik Data sebelum aktif; status dan kesehatan sinkronisasi; kuota; kredensial di secret manager dan tidak pernah terlihat oleh model; pencabutan seketika; audit log; perlindungan prompt injection pada semua data yang ditarik (selaras D6). | P1 |

J5 wajib ada sebelum J1-J4 dirilis. Metrik usulan: ≥ 95% sinkronisasi berhasil; 0 data di luar *allowlist* terbaca pada uji; dokumen dari konektor terindeks ≤ 15 menit setelah berubah.

### K. Efisiensi AI (Mesin Dahulu, AI Bila Perlu)

Tugas yang dapat diselesaikan kode deterministik tidak memanggil AI. AI dipakai untuk embedding, penyusunan jawaban, pembacaan dokumen pindaian, dan reranker. Tujuannya jawaban lebih cepat, biaya lebih rendah, dan sistem lebih stabil **tanpa menurunkan kualitas dan keamanan**. Angka penghematan adalah hipotesis yang divalidasi dengan benchmark pada dokumen dan kueri nyata.

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| K1 | **Router dan guardrail berlapis**: aturan deterministik lebih dulu (sapaan murni, perintah "Atur Agent", instruksi format seperti jumlah poin atau tabel, dan pola prompt injection yang dikenal). Sapaan dikenali hanya bila seluruh pesan berupa sapaan, agar "halo, bagaimana prosedur X?" tetap diproses sebagai pertanyaan. AI atau klasifikator ringan hanya untuk kasus ambigu. Pola injeksi bukan satu-satunya pertahanan (selaras D6 dan J5). | MVP |
| K2 | **Evaluator keluaran bertingkat**: pemeriksaan deterministik pada setiap jawaban (sitasi harus berasal dari potongan yang diambil, deteksi jawaban "tidak ditemukan", penyensoran NIK, kartu kredit, dan API key selaras D7, serta kecocokan angka dan nama kunci dengan sumber). Evaluator AI berjalan secara sampel dan offline (F5). Evaluator AI inline dapat diwajibkan per bidang berisiko tinggi (kesehatan, perbankan, legal). | MVP (inline AI per bidang: P1) |
| K3 | **Sitasi dari metadata**: baris sumber (nama file, versi, halaman) disusun oleh kode dari metadata potongan, bukan dihasilkan AI. | MVP |
| K4 | **Jalur cepat ingestion**: teks dan tabel diambil dari lapisan teks digital PDF lebih dulu; skor kualitas ekstraksi (kepadatan karakter, rasio karakter tak wajar, struktur tabel) menentukan apakah halaman perlu OCR atau model vision. Hanya halaman pindaian atau berkualitas rendah memakai AI vision. | MVP |
| K5 | **Kurasi hibrida**: judul, kategori, dan tag dari aturan dan kamus (heading, glosarium B6, pencocokan kata kunci). AI dipakai per dokumen untuk ringkasan, dan per potongan hanya untuk potongan penting atau ambigu, diproses dalam batch. Hasilnya dibandingkan dengan kurasi AI penuh pada sampel dokumen sebelum dijadikan default. | P1 |
| K6 | **Smart Cache ketat**: cache dipakai hanya bila kelompok akses, versi dokumen, serta entitas dan angka dalam pertanyaan sama. Ambang kemiripan semantik dapat dikonfigurasi (usulan awal ≥ 0,97, divalidasi dengan set uji karena pertanyaan mirip bisa berjawaban beda). | P1 |
| K7 | **Batching embedding**: ukuran batch dapat dikonfigurasi (usulan awal 100) mengikuti batas penyedia atau Ollama, dengan percobaan ulang per batch. | P1 |
| K8 | **Observabilitas biaya dan latensi**: pencatatan panggilan AI, token, waktu, dan cache hit per kueri dan per dokumen di Agent Studio, dengan anggaran per bidang. Target usulan: sapaan dan perintah sistem 0 panggilan AI; jawaban tanpa cache 1 panggilan AI generatif; cache hit 0. | P1 |

Metrik usulan: median latensi jawaban tanpa cache ≤ 5 detik dengan token pertama ≤ 2 detik; biaya AI per jawaban dan per dokumen turun terhadap baseline hasil benchmark; sitasi benar tetap ≥ 90%.

## 4. Arsitektur, Data, dan Non-Fungsional

**Lapisan sistem (dari bawah ke atas):**

1. **Data**: PostgreSQL + pgvector (embedding 1024 dimensi, indeks HNSW cosine), Redis + BullMQ untuk antrean.
2. **Ingestion**: mupdf (render halaman in-memory), model vision, OCR, chunking LangChain.js, kurasi.
3. **Pengetahuan**: vektor + indeks kata kunci + metadata hak akses, status, dan versi.
4. **AI**: orkestrasi multi-agent (Guardrail/Router dan Evaluator berbasis aturan lebih dulu, Retrieval, Synthesizer; lihat bagian K) dengan model sesuai mode deployment (Cloud, On-premise, atau VPC privat; lihat tabel di bawah), pilihan model per agen dari Agent Builder, dan fallback bertingkat antar model dalam mode yang sama.
5. **Aplikasi**: Next.js + TypeScript, dua portal, SSO internal.
6. **Lintas lapisan**: RBAC/ABAC, audit log, observabilitas.

**Mode deployment dan model AI:**

| Mode | Kapan dipakai | Chat | Vision dan OCR | Embedding | Data yang boleh |
| --- | --- | --- | --- | --- | --- |
| Cloud | Tahap pengujian saat ini | DeepSeek-V3, GPT-4o-mini, Gemini 2.0 Flash Lite | GPT-4o-mini atau Gemini 2.0 Flash Lite (multimodal) | text-embedding-3-small (1024 dimensi) | Data uji atau non-sensitif |
| On-premise | Pelanggan yang membeli dan ingin data di infrastruktur sendiri | Llama 3.2 atau Qwen2.5 via Ollama | Qwen2.5-VL via Ollama | BGE-M3 (1024 dimensi) | Seluruh klasifikasi |
| VPC privat (opsi hosting) | Pelanggan yang memilih cloud privat, misalnya AWS | Model terpilih yang dijalankan di akun dan VPC milik perusahaan | Model terpilih di VPC yang sama | Satu model per instalasi (BGE-M3 atau text-embedding-3-small) | Sesuai kontrol akses yang disepakati |

Satu instalasi memakai satu model embedding, dan pindah mode berarti index ulang seluruh dokumen. Fallback bertingkat terjadi antar model dalam mode yang sama (misalnya antar penyedia pada mode Cloud). Nama dan versi model mengikuti PRD sebelumnya dan diverifikasi ulang saat implementasi.

**Perubahan skema dibanding rancangan awal:**

| Tabel | Penambahan |
| --- | --- |
| `upload_batches` | `owner_id`, `division_id`, `classification`, `status`, `version`, `supersedes_id`, `effective_date`, `review_due_date` |
| `chat_response_cache` | `access_group_id`, `corpus_version`; hash SHA-256 |
| `shared_chats` | `expires_at`, `revoked_at`, `requires_approval` |
| Baru | `answer_feedback`, `knowledge_gaps`, `expert_answers`, `acknowledgments`, `glossary_terms`, `review_reminders` |
| Baru (bagian I) | page\_creator\_grants, pages, page\_versions, page\_widgets, page\_publications |
| Baru (bagian J) | connector\_sources, connector\_credential\_refs, sync\_runs, db\_view\_allowlist, mcp\_clients, mcp\_tokens |
| Baru (konfigurasi model) | model\_configs (mode, peran, penyedia, nama\_model, prioritas); kolom embedding\_model dan embedding\_dim pada document\_chunks dan curated\_insights |

**Kebutuhan non-fungsional (usulan):**

| Aspek | Target |
| --- | --- |
| Latensi jawaban | Median ≤ 5 detik; cache hit ≤ 50 ms |
| Ketersediaan | ≥ 99,5% jam kerja |
| Akurasi OCR (dokumen bersih) | ≥ 95% pada field kunci |
| Sitasi benar | ≥ 90% (set uji internal) |
| Indeks dokumen baru | ≤ 15 menit setelah unggah |
| Skala awal | 100 pengguna aktif, 100 ribu dokumen |
| Rahasia | Kunci dan kata sandi awal lewat secret manager, bukan berkas `.env` biasa |
| Pindah mode atau model embedding | Index ulang dijalankan sebagai pekerjaan antrean tanpa menghentikan layanan |

## 5. Roadmap, Risiko, dan Turunan PRD

| Fase | Durasi | Cakupan |
| --- | --- | --- |
| 0. Discovery | 4 minggu | Inventaris dokumen, klasifikasi data, pemilik, baseline metrik, pilihan model dan infrastruktur |
| 1. MVP | 3 bulan | A1-A6, B1-B4, C1-C3, D1-D4 dan D6, F5, H2-H4, K1-K4; pilot satu divisi |
| 2. P1 | 3 bulan | B5-B8, C4-C5, D5 dan D7, E1-E2, F1 dan F3-F4, H1, I1-I8 dan I10, J1-J3 dan J5, K5-K8 |
| 3. Skala | Berkelanjutan | E3, F2, G1-G2, I9, J4, perluasan divisi dan optimasi biaya |

| Risiko | Mitigasi |
| --- | --- |
| Jawaban salah atau halusinasi | Sitasi wajib, penolakan saat bukti kurang, evaluasi otomatis, umpan balik |
| Dokumen basi atau ganda | Pemilik, tanggal tinjau, alur status, diff |
| Kebocoran lintas hak akses | Filter di retrieval, cache per kelompok akses, uji penetrasi |
| Kebocoran lewat model cloud atau tautan publik | Data Rahasia hanya di On-premise atau VPC privat; mode Cloud hanya untuk data uji; zero retention; share chat berkedaluwarsa |
| Kualitas OCR rendah | Skor kepercayaan dan verifikasi manual |
| Adopsi rendah | Pilot dengan juara internal, pelatihan, laporan kesenjangan |
| Pemilik tidak aktif merawat dokumen | Pengingat, eskalasi ke atasan, Health Score di dashboard eksekutif |
| Halaman interaktif membuka data di luar hak atau tersebar tanpa kontrol | Pembuat Halaman terpilih, hak akses dievaluasi pada pembaca, persetujuan terbit, audit log |
| Konektor atau MCP menarik data berisi instruksi berbahaya, kredensial bocor, atau akses berlebih | Least privilege, allowlist, kredensial di secret manager, perlindungan prompt injection, rate limit, audit log |
| Pindah model atau mode merusak hasil pencarian karena embedding berbeda | Satu model embedding per instalasi, versi embedding tercatat, index ulang terjadwal |
| Penghematan AI menurunkan kualitas jawaban atau keamanan | Aturan mesin sebagai lapisan pertama, bukan satu-satunya; evaluator sampel dan set uji (F5); mode ketat untuk bidang berisiko tinggi; benchmark sebelum dan sesudah |

**Definisi selesai MVP:** seluruh kebutuhan MVP lolos uji penerimaan; tidak ada kebocoran pada skenario uji hak akses; sitasi benar ≥ 90% pada minimal 200 pertanyaan uji bersama pemilik domain; pilot satu divisi minimal 4 minggu.

**PRD turunan (berikutnya):**

1. **PRD Penerapan per Bidang**: fitur tambahan, taksonomi dokumen, aturan akses, glosarium, dan metrik untuk tiap bidang (misalnya HR, legal, logistik/gudang, keuangan, produksi, IT).
2. **PRD Portal Assistant** dan **PRD Portal Agent Studio**: antarmuka dan pengalaman pengguna.

**Pertanyaan terbuka:** lokasi data dan infrastruktur (on-premise, atau private cloud/VPC seperti AWS dengan wilayah dan kontrol akses yang disepakati), kebijakan retensi dan klasifikasi yang berlaku, kapan pelanggan berpindah dari mode Cloud ke On-premise (termasuk jadwal index ulang), bidang pertama yang dipilih untuk pilot, serta product owner dan perwakilan keamanan.
