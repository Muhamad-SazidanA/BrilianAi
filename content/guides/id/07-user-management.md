---
title: "Manajemen Pengguna"
description: "Persetujuan pendaftaran akun baru, penonaktifan akun staf, dan penerbitan kredensial sementara oleh Super Administrator."
---

Modul **Kelola Pengguna** (`/users`) diperuntukkan bagi Super Administrator untuk mengatur akun staf dan siklus hidup kredensial di dalam workspace.

---

## 1. Alur Persetujuan Akun (Approval Workflow)

Saat pengguna baru mendaftar atau login pertama kali via Single Sign-On (Google / Korporat):
- Akun mereka otomatis masuk ke status **Menunggu Persetujuan (Pending Approval)**.
- Pengguna yang berstatus *Pending* tidak dapat membaca dokumen rahasia atau mengajukan kueri AI sebelum disetujui.
- **Menyetujui Akun:** Super Administrator cukup mengklik tombol **Setujui Akun (Approve)** pada tabel pengguna. Akun akan langsung aktif dan mendapatkan hak akses sesuai peran yang ditetapkan.

---

## 2. Mengubah Peran & Departemen

Administrator dapat memperbarui profil kewenangan pengguna kapan saja:
1. Klik tombol **Edit** pada baris pengguna yang dituju.
2. Pilih peran yang sesuai (misal: *Super Administrator, Knowledge Manager & Editor, Member / Viewer, Chat Only,* atau *Knowledge Only*).
3. Pilih departemen kerja (misal: *Keuangan, Hukum, Teknologi Informasi, Human Capital*).
4. Klik **Simpan Perubahan**. Hak akses baru langsung berlaku pada sesi pengguna berikutnya.

---

## 3. Penonaktifan Akun (Deactivate)

Jika seorang staf mengundurkan diri atau dinonaktifkan sementara:
- Klik tombol **Nonaktifkan Akun**.
- Akun berstatus *Inactive* otomatis ditolak saat mencoba login atau memanggil API, dan seluruh sesi aktifnya di database dicabut seketika.

