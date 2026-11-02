---
title: "Autentikasi & Keamanan Sesi"
description: "Panduan masuk ke sistem, ganti kata sandi mandiri, reset kata sandi oleh administrator, dan fitur auto-logout inactivity 30 menit."
---

Modul autentikasi Brilian.Ai dibangun dengan standar keamanan perbankan dan enterprise, menggunakan algoritma hashing memori-kuat `scrypt`, perlindungan brute-force IP rate-limiting, serta Inactivity Timeout otomatis.

---

## 1. Masuk ke Akun (Sign In)

1. Buka halaman login di `/login`.
2. Masukkan username atau alamat email terdaftar (contoh: `superadmin@brilian.ai`).
3. Masukkan kata sandi akun Anda, lalu klik **Sign in**.
4. Sistem akan mengarahkan Anda langsung ke modul utama (Dashboard, Knowledge Base, atau AI Assistant) sesuai hak akses peran Anda.

> **Perlindungan Brute-Force:** Percobaan login gagal berturut-turut hingga 5 kali dalam rentang 15 menit akan memicu penguncian sementara akun/IP untuk melindungi dari serangan penebakan kata sandi.

---

## 2. Lupa Kata Sandi (Forgot Password)

Sesuai kebijakan kepatuhan enterprise (*ISO 27001 & UU Perlindungan Data Pribadi*), reset kata sandi tidak dikirim lewat email publik tanpa verifikasi.
- Jika Anda lupa kata sandi akun, klik tombol **Forgot password?** di halaman login.
- Modal peringatan akan mengarahkan Anda untuk menghubungi **Super Administrator Workspace**. Administrator dapat menerbitkan kata sandi baru secara langsung melalui modul Kelola Pengguna.

---

## 3. Ganti Kata Sandi Mandiri (Self-Service Change Password)

Setiap pengguna yang telah login dapat mengganti kata sandi mereka sendiri kapan saja:
1. Klik avatar profil Anda di pojok kiri bawah navigasi sidebar.
2. Pilih menu **Change Password (Ganti Password)**.
3. Masukkan **Kata Sandi Saat Ini** untuk verifikasi identitas.
4. Masukkan **Kata Sandi Baru** (minimal 6 karakter) dan ketik ulang di kolom konfirmasi.
5. Klik **Simpan Kata Sandi Baru**. Kata sandi Anda akan langsung di-hash menggunakan algoritma `scrypt` bersalt unik di database.

---

## 4. Reset Kata Sandi oleh Administrator

Khusus pengguna dengan peran **Super Administrator**:
1. Buka menu **Kelola Pengguna** (`/users`).
2. Cari nama pengguna yang meminta reset pada tabel pengguna.
3. Klik tombol ikon kunci (**Reset Password**) di kolom aksi pengguna tersebut.
4. Anda dapat memilih:
   - **Buat Password Acak Aman Otomatis**: Sistem men-generate kata sandi sementara yang kuat.
   - **Tentukan Password Baru Langsung**: Masukkan kata sandi sementara secara manual.
5. Konfirmasi reset. Salin kata sandi sementara dan berikan kepada pengguna secara aman.

---

## 5. Inactivity Timeout (Auto-Logout 30 Menit)

Demi mencegah pembajakan sesi saat perangkat komputer ditinggalkan tanpa pengawasan (*shoulder surfing*):
- Sistem secara konstan mendeteksi interaksi pengguna (pergerakan mouse, ketikan keyboard, scroll, dan sentuhan layar).
- **Peringatan Pra-Timeout (2 Menit Sebelum Berakhir):** Jika tidak ada aktivitas selama 28 menit, modal peringatan akan muncul menampilkan sisa waktu *countdown* `MM:SS`. Pengguna dapat mengklik **Tetap Masuk** untuk memperpanjang sesi.
- **Auto-Logout (30 Menit):** Jika waktu habis, sistem otomatis mencabut token sesi database, membersihkan cookie aman, dan mengarahkan pengguna kembali ke halaman login dengan notifikasi bahwa sesi telah berakhir.
- **Sinkronisasi Multi-Tab:** Aktivitas di tab browser lain secara otomatis memperpanjang sesi di seluruh tab yang sedang terbuka.

