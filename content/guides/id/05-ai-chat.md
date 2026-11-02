---
title: "AI Assistant & Tanya Jawab RAG"
description: "Panduan berinteraksi dengan AI Assistant, pelacakan sitasi halaman asli, pemformatan tabel Markdown otomatis, dan ekspor percakapan."
---

Modul **AI Assistant** (`/chat`) adalah ruang kerja interaktif di mana pengguna dapat berdiskusi dan menggali wawasan dari seluruh dokumen aktif di repositori organisasi.

---

## 1. Memulai Sesi Percakapan

1. Buka menu **AI Assistant** (`/chat`).
2. Ketik pertanyaan Anda pada kolom input di bagian bawah layar (atau klik salah satu kartu rekomendasi pertanyaan cepat).
3. Tekan **Enter** atau klik tombol kirim.
4. AI Assistant akan melakukan pencarian semantik vektor ke pgvector, menyaring dokumen yang sesuai dengan hak akses Anda, dan menyusun jawaban akurat secara *streaming real-time*.

---

## 2. Sitasi & Drawer Verifikasi Sumber Asli

Setiap klaim data atau kutipan yang dihasilkan AI selalu disertai referensi transparan:
- Di bawah pesan AI, Anda akan melihat lencana sitasi dokumen (contoh: `📄 Laporan Keuangan 2025.pdf (Hal. 14)`).
- **Klik Sitasi:** Mengklik lencana sitasi akan membuka **Citation Drawer** di sebelah kanan layar, menampilkan kutipan teks asli dari dokumen dan nomor halaman sumber. Hal ini memungkinkan pengguna melakukan audit keabsahan data secara instan.

---

## 3. Pemformatan Otomatis Tabel Markdown

Saat jawaban AI menyangkut data terstruktur (rekap angka, perbandingan kebijakan, atau daftar aset):
- Sistem secara otomatis memaksa model untuk memformat data ke dalam **Markdown Table** yang rapi dengan header kolom dan perataan teks profesional.
- Tabel dapat disalin langsung (*Copy Table*) untuk digunakan di Microsoft Excel atau Word.

---

## 4. Ekspor & Bagikan Percakapan

- **Export Chat**: Klik ikon ekspor untuk mengunduh seluruh transkrip percakapan dalam format Markdown (`.md`) atau teks rapi untuk dokumentasi rapat.
- **Beri Masukan (Feedback)**: Klik ikon jempol ke atas (*thumbs up*) atau jempol ke bawah (*thumbs down*) pada pesan bot untuk membantu administrator mengevaluasi kualitas jawaban sistem.

