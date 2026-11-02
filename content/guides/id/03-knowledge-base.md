---
title: "Repositori Knowledge Base"
description: "Pengelolaan status dokumen aktif (Active Knowledge), klasifikasi hak akses keamanan, penamaan arsip, dan penghapusan data."
---

Modul **Knowledge Base** (`/documents`) adalah pusat kendali repositori pengetahuan organisasi. Di sinilah administrator dan editor menentukan dokumen mana yang boleh dijadikan bahan acuan oleh AI Assistant.

---

## 1. Status Active Knowledge (Aktif / Nonaktif)

Tidak semua dokumen yang diunggah harus langsung dijawab oleh AI:
- **Dokumen Aktif (Active Knowledge = True)**: Potongan teks dari dokumen ini akan disertakan dalam pencarian semantik vektor saat pengguna berdiskusi di AI Assistant.
- **Dokumen Nonaktif (Active Knowledge = False)**: Dokumen tetap tersimpan di database, tetapi diabaikan saat pencarian AI berjalan. Fitur ini sangat berguna untuk dokumen usang, draft regulasi, atau arsip lama yang belum disahkan.

> **Cara Mengubah Status:** Cukup klik tombol toggle di kolom **Status Pengetahuan** pada tabel dokumen. Perubahan berlaku seketika tanpa perlu proses re-ingest ulang.

---

## 2. Klasifikasi Kerahasiaan Dokumen

Setiap dokumen memiliki label klasifikasi privasi untuk mencegah kebocoran informasi:
- **Publik**: Dapat dibaca oleh seluruh staf dan anggota organisasi.
- **Internal**: Hanya untuk operasional internal perusahaan.
- **Rahasia (Confidential)**: Terbatas pada peran staf senior, manajer, dan editor.
- **Sangat Rahasia (Top Secret)**: Hanya dapat diakses oleh Super Administrator dan direksi.

Saat pengguna bertanya pada chatbot, sistem secara ketat memfilter hasil pencarian pgvector hanya pada dokumen yang diizinkan untuk peran pengguna tersebut.

---

## 3. Rename & Hapus Dokumen

- **Mengubah Nama Dokumen**: Klik ikon pensil untuk mengubah nama tampilan arsip agar lebih mudah dikenali oleh tim kerja.
- **Menghapus Dokumen**: Klik ikon tempat sampah untuk menghapus berkas. Sistem akan menghapus seluruh data batch, riwayat chunk teks, embedding vektor pgvector, serta insight kurasi terkait secara permanen (*cascade delete*).

