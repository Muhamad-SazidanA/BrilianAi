---
title: "Audit Logs & Kepatuhan Enterprise"
description: "Pelacakan jejak aktivitas sistem, pencatatan audit percakapan chat, dan ekspor riwayat keamanan (CSV/JSON)."
---

Modul **Audit Log** (`/logs`) mencatat setiap aksi kritis yang terjadi di dalam platform untuk keperluan kepatuhan regulasi (*compliance*), investigasi keamanan, dan audit forensik internal.

---

## 1. Kategori Jejak Audit yang Dicatat

Sistem mencatat 4 domain peristiwa utama secara otomatis:
1. **AUTH (Autentikasi)**: Percobaan login sukses/gagal, logout manual/timeout, pergantian kata sandi, dan reset kata sandi admin.
2. **DOCS (Dokumen & Pengetahuan)**: Pengunggahan berkas, aktivasi/deaktivasi status pengetahuan, perubahan klasifikasi privasi, dan penghapusan dokumen.
3. **CHAT (Percakapan & Query AI)**: Pertanyaan yang diajukan pengguna, token yang dikonsumsi, latensi respons AI, dan referensi dokumen yang diakses.
4. **ADMIN (Tata Kelola Pengguna & Peran)**: Pembuatan pengguna baru, persetujuan pendaftaran, perubahan peran, dan perubahan matriks hak akses.

---

## 2. Struktur Data Log

Setiap baris log menyimpan atribut detail:
- **Timestamp**: Waktu kejadian presisi milidetik berstandar UTC.
- **Actor**: Nama, email, dan ID pengguna pelaku aksi.
- **Client IP & User Agent**: Alamat IP jaringan dan peramban yang digunakan.
- **Resource**: ID dan nama objek yang dimanipulasi (misal: ID dokumen atau ID sesi chat).
- **Status**: Hasil eksekusi (`success` atau `failed`), disertai pesan kesalahan jika terjadi penolakan izin.

---

## 3. Filter Interaktif & Ekspor Laporan

- **Pencarian Cepat**: Saring rekaman log berdasarkan nama pengguna, kata kunci aksi, rentang tanggal, atau kategori peristiwa.
- **Ekspor Laporan (Export CSV)**: Unduh seluruh riwayat audit log dalam format CSV terstruktur untuk diserahkan ke auditor eksternal atau diintegrasikan ke SIEM perusahaan (*Splunk, Elastic, Datadog*).

