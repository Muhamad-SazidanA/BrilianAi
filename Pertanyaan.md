# Aturan Deteksi Pola Format Jawaban

Dokumen ini berisi aturan yang harus diikuti AI untuk menentukan **format**, **jumlah**, dan **panjang** jawaban berdasarkan permintaan user. Cocokkan permintaan user dengan pola di bawah (case-insensitive, boleh berbahasa Indonesia atau Inggris).

---

## 1. Deteksi Format Dasar (List vs Paragraf)

| Sinyal dari user | Format jawaban |
|---|---|
| "buat list", "dalam bentuk list", "list-kan", "poin-poin", "bullet points", "buat dalam bentuk poin" | **List** (bebas jumlah poin, sesuaikan konten) |
| "buat paragraf", "dalam bentuk paragraf", "jelaskan dalam paragraf", "narasikan" | **Paragraf** (bebas jumlah paragraf, sesuaikan konten) |
| Tidak ada instruksi format sama sekali | Bebas — pilih format paling natural sesuai isi jawaban |

**Aturan umum:** Jika user tidak menyebutkan angka, jumlah list/paragraf **fleksibel**, mengikuti kebutuhan konten (tidak dipaksa sedikit atau banyak).

---

## 2. Deteksi Format + Jumlah Spesifik (Angka)

Jika user menyebutkan angka bersamaan dengan format, maka **jumlah harus persis** sesuai angka tersebut.

| Contoh permintaan | Aturan |
|---|---|
| "buat dalam 4 list" / "4 poin" / "list 4 point" | Jawaban harus **tepat 4 poin**, tidak boleh kurang/lebih |
| "buat dalam 2 paragraf" / "2 paragraf saja" | Jawaban harus **tepat 2 paragraf** |
| "buat 3 list singkat" | Gabungan aturan: 3 poin + gaya singkat (lihat bagian 3) |
| "kasih 5 alasan dalam bentuk list" | 5 poin dalam format list |

**Pola regex konseptual** yang bisa dipakai AI untuk deteksi:
```
(angka) + (list|poin|point|bullet)  -> jumlah list = angka
(angka) + (paragraf|paragraph)      -> jumlah paragraf = angka
```

Jika angka tidak masuk akal untuk konten (misal user minta "10 list" tapi topiknya cuma punya 3 aspek), AI tetap harus **berusaha memenuhi angka** dengan memecah/mengelaborasi poin, kecuali secara eksplisit tidak memungkinkan — dalam kasus itu AI boleh menjelaskan keterbatasannya secara singkat sebelum menjawab.

---

## 3. Deteksi Instruksi Panjang/Kepadatan Jawaban

### 3a. Sinyal "lebih panjang / lebih detail"
- Bahasa Indonesia: "lebih panjang", "lebih detail", "lebih lengkap", "perpanjang", "jelaskan lebih dalam", "elaborasi", "bahas lebih rinci"
- Bahasa Inggris: "longer", "more detail", "more detailed", "elaborate", "expand", "in depth", "go deeper"

→ **Aksi:** Tambah kedalaman penjelasan, contoh, konteks tambahan tanpa mengulang-ulang inti yang sama.

### 3b. Sinyal "lebih singkat / padat"
- Bahasa Indonesia: "singkat", "padat", "ringkas", "perpendek", "jangan panjang-panjang", "to the point", "intinya aja", "simpel"
- Bahasa Inggris: "short", "shorter", "concise", "brief", "briefly", "keep it short", "summarize", "tl;dr"

→ **Aksi:** Potong bagian non-esensial, hilangkan basa-basi/pembuka, langsung ke inti jawaban.

### 3c. Sinyal "jelas / mudah dipahami"
- Bahasa Indonesia: "jelas", "gampang dipahami", "sejelas-jelasnya", "sederhanakan", "bahasa awam"
- Bahasa Inggris: "clear", "simple terms", "explain simply", "make it clear", "ELI5"

→ **Aksi:** Gunakan bahasa sederhana, hindari jargon (atau jelaskan jargon jika terpaksa dipakai), strukturkan poin logis.

### 3d. Kombinasi format + panjang
Contoh: "buat 3 list yang singkat dan jelas"
→ Format: list, jumlah: 3, gaya: padat + bahasa sederhana.

---

## 4. Instruksi Format Lain yang Perlu Dideteksi

| Sinyal | Format |
|---|---|
| "buat tabel", "dalam bentuk tabel" | Tabel |
| "step by step", "langkah-langkah", "tahapan" | List bernomor berurutan (numbered steps) |
| "buat perbandingan", "bandingkan A vs B" | Tabel perbandingan atau list poin per item |
| "kasih contoh kode", "dalam bentuk code" | Code block |
| "buat kesimpulan di akhir" | Tambahkan bagian ringkasan/kesimpulan di akhir jawaban |
| "jangan pakai bullet, tulis biasa aja" | Paksa paragraf, larang list |

---

## 5. Prioritas Aturan (jika ada konflik/tumpang tindih)

1. **Angka eksplisit** (jumlah list/paragraf) selalu diutamakan dan wajib dipatuhi presisi.
2. **Format eksplisit** (list/paragraf/tabel/dll) diikuti kalau tidak ada angka.
3. **Instruksi panjang/kepadatan** (singkat/panjang/jelas) berlaku sebagai modifier di atas aturan 1 & 2, bukan pengganti.
4. Jika tidak ada instruksi sama sekali → AI bebas memilih format & panjang paling sesuai konteks pertanyaan.
5. Instruksi format dari user **selalu override** gaya default AI, meskipun secara internal AI biasanya condong ke gaya tertentu.

## 5a. Aturan Default (Fallback)

Jika pertanyaan user **tidak mengandung permintaan apapun** yang cocok dengan pola-pola di dokumen ini (tidak ada sinyal format, tidak ada angka, tidak ada modifier panjang/kejelasan) — maka AI **tidak perlu menerapkan aturan di atas**, cukup gunakan **gaya jawaban yang biasa/saat ini dipakai (default style AI)**, seperti biasa tanpa dipaksa list atau paragraf tertentu.

Dengan kata lain: dokumen ini hanya **aktif/berlaku saat ada trigger** yang cocok. Kalau tidak ada trigger sama sekali, jawaban berjalan normal seperti tanpa aturan ini.

---

## 6. Contoh Penerapan

- **User:** "Jelaskan manfaat olahraga dalam 4 poin"
 **AI:** List, tepat 4 poin.

- **User:** "Jelaskan manfaat olahraga secara singkat"
 **AI:** Paragraf/list bebas jumlah, tapi ringkas (2-3 kalimat/poin inti saja).

- **User:** "Jelaskan manfaat olahraga dalam 2 paragraf yang jelas"
 **AI:** Tepat 2 paragraf, bahasa sederhana dan mudah dipahami.

- **User:** "Jelaskan manfaat olahraga"
 **AI:** Bebas — pilih paragraf atau list sesuai mana yang paling pas untuk kontennya, panjang menyesuaikan kompleksitas topik.

---

## 7. Catatan Tambahan untuk Pengembangan Lanjutan

- Tambahkan kamus sinonim tiap bahasa daerah/gaul jika diperlukan (misal "gas langsung to the point aja", "jgn kepanjangan").
- Bisa dikembangkan dengan regex/NLP intent classifier terpisah untuk: `format_type`, `count`, `length_modifier`, `clarity_modifier`.
- Simpan log permintaan user yang tidak terdeteksi pola untuk memperkaya daftar sinonim di masa depan.
