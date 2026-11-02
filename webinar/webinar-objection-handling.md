# 🛡️ Brilian.Ai — Objection Handling Sheet
### *Panduan Q&A Webinar — Jawaban untuk Pertanyaan Sulit*

---

## ❓ OBJECTION #1 — "Bedanya dengan Gemini / ChatGPT apa? Cuma keamanan aja?"

> [!IMPORTANT]
> **Jangan jawab "iya, lebih aman"** — itu langsung bunuh minat. Jawab dengan 5 dimensi ini.

### Jawaban Lengkap:

**1. 🧠 Gemini/GPT tidak tahu dokumen ANDA**

Gemini tahu semua hal di internet — tapi dia tidak pernah baca SOP HR perusahaan Anda, laporan Q3 Anda, atau kontrak vendor Anda. Setiap kali mau tanya, Anda harus paste manual. Brilian.Ai **sudah membaca semua dokumen internal Anda** — sekali upload, selamanya bisa ditanya.

**2. 📄 Gemini/GPT tidak bisa citasi dokumen internal Anda**

Tanya GPT soal kebijakan lembur perusahaan Anda → dia *mengarang* berdasarkan aturan umum. Brilian.Ai jawab dari **SOP asli Anda, halaman 12, paragraph 3** — bisa diklik, bisa diverifikasi langsung.

**3. 📊 Gemini/GPT tidak bisa buat dashboard dari data Anda**

Copilot biasa = chat box. Brilian.Ai = **platform analitik + AI dalam satu**. Upload Excel → langsung jadi dashboard interaktif, chart morphing, bisa di-share ke tim. GPT tidak bisa drag-resize card penjualan Anda.

**4. 🔐 Access Control per dokumen — ini bukan "sekedar aman"**

Ini bukan cuma "data tidak keluar". Maksudnya: **user A bisa tanya soal dokumen X, tapi user B tidak bisa** — karena dokumen X adalah Top Secret dan B tidak punya akses. GPT tidak punya konsep ini sama sekali. Critical untuk perusahaan multi-departemen.

**5. 💰 Zero-Token untuk tabular data — beda arsitektur**

Kirim 10.000 baris Excel ke GPT → habiskan ribuan token → biaya besar. Brilian.Ai proses Excel/CSV **tanpa memanggil AI sama sekali** saat ingestion. AI baru dipanggil saat Anda bertanya. Ini beda arsitektur, bukan sekedar beda UI.

### 🎤 Script Jawaban Singkat (untuk dipake langsung):
> *"Pertanyaan bagus. Analoginya: Gemini itu seperti Google Search — dia tahu semua hal di dunia, tapi dia tidak tahu isi laci meja kantor Anda. Brilian.Ai adalah asisten yang sudah membaca semua dokumen internal perusahaan Anda, tahu siapa boleh akses apa, bisa buat laporan dari data Anda, dan semua itu tidak pernah keluar dari server Anda. Itu bukan fitur tambahan — itu use case yang sama sekali berbeda."*

---

## ❓ OBJECTION #2 — "Harganya pasti mahal"

### Jawaban:
> *"Mari kita hitung balik. Jika satu karyawan kehilangan 2 jam per hari hanya untuk mencari informasi, dan gaji rata-rata Rp 8 juta/bulan — itu artinya perusahaan Anda kehilangan sekitar Rp 2 juta per orang per bulan hanya dari waktu yang terbuang. Untuk tim 20 orang, itu Rp 40 juta per bulan. Brilian.Ai harganya jauh di bawah angka itu."*

> [!TIP]
> Jangan sebut harga dulu — buat mereka hitung sendiri kerugian yang sudah terjadi.

---

## ❓ OBJECTION #3 — "Kami sudah pakai SharePoint / Google Drive"

### Jawaban:
> *"SharePoint dan Google Drive itu tempat menyimpan dokumen — bukan tempat bertanya. Anda masih harus buka file satu per satu, scroll, cari sendiri. Brilian.Ai duduk di atas storage Anda — Anda bisa tetap simpan dokumen di mana saja, tapi sekarang bisa tanya ke semua dokumen itu sekaligus dalam satu kalimat."*

---

## ❓ OBJECTION #4 — "IT kami tidak akan approve solusi baru"

### Jawaban:
> *"Justru tim IT yang biasanya paling suka Brilian.Ai — karena deployment-nya di server Anda sendiri. Mereka yang pegang kontrolnya. Tidak ada data yang keluar ke cloud pihak ketiga. Audit log lengkap. Dan stack-nya standard: Docker, PostgreSQL, Redis — bukan teknologi eksotis yang susah di-maintain."*

---

## ❓ OBJECTION #5 — "Bagaimana kalau AI-nya salah jawab?"

### Jawaban:
> *"Pertanyaan yang sangat relevan. Brilian.Ai dirancang dengan prinsip 'AI tidak boleh mengarang'. Setiap jawaban disertai sitasi — halaman berapa, dari dokumen mana. Jika AI tidak menemukan jawabannya di dokumen yang ada, dia akan bilang 'tidak ditemukan' — bukan mengarang. Ini yang membedakan dari GPT biasa."*

---

## ❓ OBJECTION #6 — "Kami perusahaan kecil, belum butuh"

### Jawaban:
> *"Justru perusahaan kecil yang paling diuntungkan — karena tidak punya tim data science, tidak punya analis khusus. Satu orang di tim Anda bisa mengerjakan pekerjaan yang biasanya butuh 3 orang. Dan semakin cepat Anda adopsi, semakin cepat keunggulan kompetitifnya terasa."*

---

## 📋 Quick Reference Card

| Objection | Kunci Jawaban |
|-----------|---------------|
| "Sama kayak GPT" | 5 dimensi: konteks internal, sitasi, dashboard, RBAC, zero-token |
| "Mahal" | Hitung ROI dari waktu yang terbuang dulu |
| "Sudah ada SharePoint" | Storage ≠ Intelligence. Brilian.Ai duduk di atas storage Anda |
| "IT tidak approve" | Self-hosted = IT tetap pegang kontrol. Stack standar |
| "AI bisa salah" | Sitasi wajib + fallback "tidak ditemukan" bukan mengarang |
| "Perusahaan kecil" | Justru multiplier effect paling terasa di tim kecil |

---

> [!NOTE]
> **Prinsip umum Q&A**: Validasi dulu pertanyaannya (*"Pertanyaan bagus"* / *"Relevan sekali"*), baru jawab. Jangan defensif. Objection = tanda mereka serius mempertimbangkan.
