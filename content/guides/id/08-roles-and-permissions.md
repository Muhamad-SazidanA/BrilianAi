---
title: "Role & Matriks Hak Akses"
description: "Konfigurasi izin granular (RBAC), klasifikasi keamanan dokumen yang diizinkan (ABAC), dan manajemen peran sistem."
---

Modul **Role & Hak Akses** (`/roles`) mengatur matriks izin operasional sistem menggunakan kombinasi **Role-Based Access Control (RBAC)** dan **Attribute-Based Access Control (ABAC)**.

---

## 1. Peran Bawaan Sistem (System Roles)

Brilian.Ai menyediakan 5 peran standar yang siap digunakan:
1. **Super Administrator (`admin`)**: Akses penuh ke seluruh modul sistem, dokumen, kurasi AI, manajemen pengguna, dan audit log.
2. **Knowledge Manager & Editor (`editor`)**: Dapat mengunggah dokumen, mengelola repositori, menjalankan kurasi AI, dan berdiskusi dengan chatbot.
3. **Member / Viewer (`member`)**: Akses standar untuk membaca dokumen aktif yang diizinkan dan bertanya ke AI Assistant.
4. **Chatbot Specialist (`chat_only`)**: Akses terfokus hanya pada interaksi percakapan dengan AI Assistant.
5. **Knowledge Viewer (`knowledge_only`)**: Akses terfokus hanya untuk membaca dan meninjau repositori dokumen pengetahuan.

---

## 2. Matriks Izin Granular

Setiap peran dapat dikonfigurasi izinnya secara individual:
- **Dokumen**: `documents:read`, `documents:upload`, `documents:toggle_active`, `documents:delete`.
- **Kurasi AI**: `curation:trigger`, `curation:edit`, `curation:delete`.
- **AI Chat**: `chat:query`, `chat:export`.
- **Administrasi**: `users:manage`, `roles:manage`, `audit:read`.

---

## 3. Klasifikasi Dokumen yang Diizinkan (ABAC)

Selain izin tombol aksi, setiap peran memiliki daftar **Klasifikasi Dokumen yang Diizinkan**:
- Contoh: Role `member` hanya diberi izin `["Publik", "Internal"]`.
- Jika ada dokumen berlabel `Rahasia` atau `Sangat Rahasia`, dokumen tersebut tidak akan pernah muncul dalam hasil pencarian AI Assistant bagi pengguna ber-role `member`.

