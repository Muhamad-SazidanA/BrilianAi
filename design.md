# BrilianAI Design System

Dokumen ini beda dari `desain.md` sebelumnya (yang isinya prompt untuk Google Stitch). Ini versi untuk **dikerjakan langsung di kode** — token, struktur komponen, dan kelas Tailwind, supaya tim (atau AI coding agent seperti Claude Code) implementasinya konsisten. Palet, tipografi, dan prinsip visualnya sama persis dengan brief sebelumnya: kertas putih, tinta gelap, satu warna aksen, tanpa gradient/glow.

**Asumsi stack:** Next.js (App Router) + TypeScript + Tailwind CSS v4. Kalau stack kamu beda (Pages Router, Tailwind v3, tanpa shadcn), bagian token & prinsip tetap berlaku — cuma sintaks setup di bagian 2 yang perlu disesuaikan.

---

## 1. Prinsip

1. **Dokumen dulu, chrome belakangan** — ini alat kerja untuk data & dokumen, layout harus tenang, bukan panel kontrol.
2. **Satu warna aksen** (`accent`), dipakai hemat — hanya tombol utama, tab aktif, link, focus ring.
3. **Border tipis, bukan shadow**, untuk kartu biasa. Shadow cuma untuk elemen yang benar-benar melayang (panel chat, dropdown, toast).
4. **Monospace untuk data teknis yang beneran teknis** — jumlah chunk, ID, persentase relevansi, timestamp. Judul & body pakai sans.
5. **Proses yang memang berurutan, tampil sebagai urutan bernomor** — jangan bullet list biasa untuk hal yang sebetulnya sequential (contoh: 4 tahap pipeline ingestion).
6. **Tanpa emoji sebagai ikon.** Pakai `lucide-react`.
7. **Sentence case** untuk semua label, tombol, judul. Tidak ada ALL CAPS.

---

## 2. Setup — Token & Font

### `app/globals.css`

```css
@import "tailwindcss";

@theme {
  /* Warna */
  --color-paper: #FFFFFF;
  --color-mist: #F6F6F4;
  --color-ink: #14161B;
  --color-slate: #6B7078;
  --color-accent: #2F5DFF;
  --color-accent-dark: #2447D6;
  --color-success: #1C8A5D;
  --color-warning: #B7791F;
  --color-danger: #D64545;
  --color-hairline: #E7E7E5;

  /* Font */
  --font-sans: var(--font-plex-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, "SFMono-Regular", monospace;

  /* Radius — dipakai bermakna, bukan seragam */
  --radius-sm: 4px;  /* tombol, input, chip */
  --radius-md: 8px;  /* kartu, panel */

  /* Shadow — hanya untuk elemen melayang */
  --shadow-float: 0 8px 24px rgba(20, 22, 27, 0.08);
}
```

> Skala spasi (4px base) sudah sama persis dengan skala default Tailwind — pakai `p-*`, `gap-*`, `m-*` bawaan (`gap-1`=4px, `gap-2`=8px, `gap-4`=16px, `gap-6`=24px, `gap-8`=32px, `gap-12`=48px, `gap-16`=64px), tidak perlu override.

### `app/layout.tsx`

```tsx
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="bg-paper text-ink font-sans antialiased">{children}</body>
    </html>
  );
}
```

Ini otomatis membuat utility class `bg-paper`, `text-ink`, `border-hairline`, `bg-accent`, `text-slate`, `shadow-float`, `rounded-sm`, `rounded-md`, dst — tinggal dipakai di semua komponen.

### Kalau pakai shadcn/ui

Token di atas bisa langsung dipetakan ke variabel shadcn di `globals.css` setelah `npx shadcn init`, jadi semua komponen shadcn (Button, Input, Tabs, Switch, Badge) otomatis ikut tema ini:

| Variabel shadcn | Nilai |
|---|---|
| `--background` | `var(--color-paper)` |
| `--foreground` | `var(--color-ink)` |
| `--card` | `var(--color-paper)` |
| `--primary` | `var(--color-accent)` |
| `--primary-foreground` | `#FFFFFF` |
| `--secondary` / `--muted` | `var(--color-mist)` |
| `--muted-foreground` | `var(--color-slate)` |
| `--border` / `--input` | `var(--color-hairline)` |
| `--ring` | `var(--color-accent)` |
| `--destructive` | `var(--color-danger)` |
| `--radius` | `0.5rem` (override per-komponen ke `--radius-sm` untuk tombol/input) |

---

## 3. Skala Tipografi

| Level | Kelas Tailwind | Font |
|---|---|---|
| Judul halaman | `text-[28px] leading-[34px] font-semibold text-ink` | sans |
| Judul section (h2) | `text-[18px] leading-6 font-semibold text-ink` | sans |
| Judul kartu (h3) | `text-[15px] leading-5 font-semibold text-ink` | sans |
| Body | `text-sm leading-[22px] text-ink` | sans |
| Meta / label kecil | `text-[13px] leading-[18px] text-slate` | sans |
| Data teknis (angka, ID, %, timestamp) | `text-[13px] leading-[18px] font-mono font-medium text-slate` | mono |

---

## 4. Struktur Folder yang Disarankan

```
app/
  layout.tsx
  globals.css
  (dashboard)/
    ingestion/
      page.tsx
components/
  ui/                     # primitive — dari shadcn atau bikin sendiri
    button.tsx
    input.tsx
    tabs.tsx
    switch.tsx
    icon-button.tsx
    stat-chip.tsx
    status-dot.tsx
  ingestion/
    upload-dropzone.tsx
    pipeline-steps.tsx
    document-list.tsx
    document-row.tsx
    knowledge-panel.tsx
    chunk-tabs.tsx
    chunk-list.tsx
    pagination.tsx
  chat/
    chat-panel.tsx
    chat-header.tsx
    chat-bubble.tsx
    page-reference-chip.tsx
    chat-input.tsx
    floating-chat-button.tsx
lib/
  icons.ts                # re-export ikon lucide yang dipakai, lihat bagian 6
```

---

## 5. Spesifikasi Komponen

### `<StatusDot />` — primitive
Dot 7px, `rounded-full`. Prop `variant: "neutral" | "active"` → `bg-slate` atau `bg-success`. Dipakai di header (status engine) dan badge model chatbot.

### `<StatChip />` — primitive
`border border-hairline rounded-sm px-2 py-0.5 text-[12px] font-mono text-slate`. Dipakai untuk jumlah halaman/chunk di daftar dokumen.

### `UploadDropzone`
- Container: `border border-dashed border-hairline bg-mist rounded-md p-9 text-center transition-colors`, state drag-over → `border-accent`.
- Ikon `UploadCloud` (lucide) 26px `text-slate`.
- Tombol di bawahnya: `<Button>` solid, `bg-accent hover:bg-accent-dark text-white rounded-sm font-semibold`, full width.

### `PipelineSteps`
- Bukan bullet list — grid 4 kolom (`grid grid-cols-4 gap-5`, di mobile `grid-cols-2`).
- Garis penghubung: elemen absolute `top-[11px] left-0 right-0 h-px bg-hairline` di belakang nomor.
- Tiap step: nomor bulat (`w-6 h-6 rounded-full border border-hairline flex items-center justify-center font-mono text-[11px] text-slate`), judul (`h3` style), deskripsi 1 baris (`meta` style).
- Data: props `steps: { number: string; title: string; description: string }[]` — isi awal: In-Memory, Vision OCR, Sliding Window, Dense Embedding.

### `DocumentList` / `DocumentRow`
- List, bukan card-in-card: tiap row `flex justify-between items-start py-4 border-b border-hairline last:border-b-0`.
- Kiri: ikon `FileText` + nama file (`h3` style) + tanggal upload (`meta` style, mono).
- Kanan: dua `<StatChip />` (halaman, chunk) + dua `<IconButton>` ghost (`Pencil`, `Trash2`) yang baru terlihat jelas saat hover baris (`opacity-0 group-hover:opacity-100`).
- Header panel: judul + `<Button variant="outline">` "Refresh" dengan ikon `RefreshCw`.

### `KnowledgePanel`
- Header: judul + total chunk (`text-[13px] font-mono text-slate`), bukan badge.
- Actions row: `Export` & `Import` = `<Button variant="outline">`; "Kurasi lagi (+N chunks)" = satu-satunya `<Button>` solid di panel ini.
- Status sukses: baris flex, ikon `CheckCircle2` 16px `text-success`, teks biasa — **bukan** kotak background hijau.
- `ChunkTabs`: dua tab underline, `border-b-2 border-transparent`, aktif → `border-accent text-ink font-semibold`. Count di tab pakai mono kecil.
- Search: `<Input>` dengan ikon `Search` di kiri, placeholder "Cari dalam chunks...".
- `Pagination`: teks info kiri, kontrol kanan — segmented button group untuk limit (`10/20/50/100/All`) pakai border tipis antar-item, prev/next pakai `<IconButton>` dengan `ChevronLeft`/`ChevronRight`.

### `FloatingChatButton`
- `fixed bottom-8 right-8 w-14 h-14 rounded-full bg-ink text-white flex items-center justify-center shadow-float`.
- Ikon `MessageCircle`. Aria-label wajib: "Buka chat".

### `ChatPanel`
- Container: `bg-paper rounded-md shadow-float border border-hairline` (satu-satunya panel yang boleh pakai shadow).
- `ChatHeader`: ikon bot dalam kotak border tipis + nama "BrilianAI Chatbot" + badge model (`text-[12px] font-mono` + `<StatusDot variant="active">`) + baris dokumen aktif (`FileText` + nama file, style meta).
- Toggle "Mode Ketat (Hanya Dokumen)": komponen `<Switch>` sungguhan (bukan ikon perisai + teks), checkbox "Data Publik" tetap `<Checkbox>` standar.
- `ChatBubble` (jawaban AI): `bg-mist rounded-md p-4`, bullet list di dalamnya (`list-disc pl-4 space-y-1.5 text-sm`). Baris sumber di bawahnya: `text-[12px] text-slate` — "Sumber: [Dokumen: ...]".
- `PageReferenceChip`: default `border border-hairline text-slate`; chip paling relevan (skor tertinggi) dapat `border-accent text-ink`. Persentase pakai `text-[11px] font-mono` di dalam chip.
- Timestamp: `text-[12px] text-slate`, rata kiri di bawah bubble.
- `ChatInput`: border-top hairline, `<Input>` polos + `<Button>` solid kecil "Kirim".
- Footer paging dokumen: `ChevronLeft` — `Hal {n}/{total}` (mono) — `ChevronRight`.
- Tombol tutup: satu ikon ghost `X` di pojok kanan atas panel saja — jangan duplikat tombol close di luar panel.

---

## 6. Ikon

```bash
npm install lucide-react
```

```tsx
import { UploadCloud, FileText, RefreshCw, Search, CheckCircle2,
  MessageCircle, Pencil, Trash2, ChevronLeft, ChevronRight,
  ArrowDownToLine, ArrowUpFromLine, X } from "lucide-react";
```

| Elemen | Ikon |
|---|---|
| Upload dropzone | `UploadCloud` |
| Dokumen / file | `FileText` |
| Refresh daftar dokumen | `RefreshCw` |
| Search chunks | `Search` |
| Status sukses kurasi | `CheckCircle2` |
| Tombol chat mengambang / header chat | `MessageCircle` |
| Edit dokumen | `Pencil` |
| Hapus dokumen | `Trash2` |
| Export | `ArrowDownToLine` |
| Import | `ArrowUpFromLine` |
| Pagination prev/next | `ChevronLeft` / `ChevronRight` |
| Tutup panel | `X` |

Ukuran default 18–20px, `strokeWidth={1.5}`. Semua ikon fungsional (edit, hapus, refresh, tutup) wajib punya `aria-label` di elemen tombolnya, jangan mengandalkan bentuk ikon saja.

---

## 7. Aksesibilitas & Motion

- Kontras: `text-ink` di atas `bg-paper`/`bg-mist` jauh di atas AA. `text-slate` untuk teks kecil (13px ke bawah) dicek manual kalau dipakai di atas `bg-mist`.
- Focus ring: `focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none` di semua elemen interaktif.
- Transisi buka/tutup `ChatPanel`: satu animasi slide+fade (~200ms), hormati `prefers-reduced-motion`. Tidak ada animasi hover di semua card sekaligus.
- Layout responsif: grid 2 kolom → 1 kolom di breakpoint `md`, `PipelineSteps` grid 4 → grid 2×2.

---

## 8. Checklist "Anti-AI-Slop" (buat code review)

- [ ] Tidak ada warna ungu atau gradient di mana pun.
- [ ] Tidak ada `shadow` di kartu biasa — hanya `border-hairline`. Shadow cuma di `ChatPanel`, dropdown, toast.
- [ ] Tidak ada emoji dipakai sebagai ikon — semua dari `lucide-react`.
- [ ] Label & judul pakai sentence case, bukan ALL CAPS.
- [ ] Warna aksen (`accent`) cuma dipakai di elemen yang benar-benar interaktif/utama, bukan dekorasi.
- [ ] Data teknis (angka, ID, %, timestamp) pakai `font-mono`; teks biasa tidak.
