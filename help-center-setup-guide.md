# Panduan Lengkap: Membuat Help Center / Dokumentasi dengan Fumadocs di Next.js App Router

Panduan ini mendokumentasikan arsitektur dan langkah teknis untuk membangun sistem **Help Center / Pusat Bantuan** seperti yang ada di project Spensify menggunakan **[Fumadocs](https://fumadocs.vercel.app/)** di atas **Next.js (App Router)**.

---

## 📋 Daftar Isi
1. [Gambaran Arsitektur](#1-gambaran-arsitektur)
2. [Instalasi Dependensi](#2-instalasi-dependensi)
3. [Konfigurasi Next.js & CSS](#3-konfigurasi-nextjs--css)
4. [Struktur Folder Proyek](#4-struktur-folder-proyek)
5. [Setup Sumber Konten (Source Loader)](#5-setup-sumber-konten-source-loader)
6. [Setup Search API (Pencarian Instan Ctrl+K)](#6-setup-search-api-pencarian-instan-ctrlk)
7. [Setup Komponen UI & Provider](#7-setup-komponen-ui--provider)
8. [Setup Routing App Router](#8-setup-routing-app-router)
9. [Menulis Konten Markdown & Urutan Navigasi](#9-menulis-konten-markdown--urutan-navigasi)
10. [Menghubungkan Help Center ke Aplikasi Utama](#10-menghubungkan-help-center-ke-aplikasi-utama)
11. [Troubleshooting & Best Practices](#11-troubleshooting--best-practices)

---

## 1. Gambaran Arsitektur

Fitur Help Center ini memiliki keunggulan:
- **Konten Berbasis File**: Ditulis dalam format Markdown/MDX di folder `content/`.
- **Navigasi Dinamis**: Diatur lewat `meta.json` (urutan bab, judul grup, nesting).
- **Pencarian Cepat Bawaan**: Full-text search instan tanpa perlu database eksternal (Algolia/Elastic).
- **Multi-Bahasa (i18n)**: Mendukung rute bahasa seperti `/docs/id/...` dan `/docs/en/...`.
- **TOC (Table of Contents)**: Otomatis membaca heading `##` dan `###`.
- **Static Site Generation (SSG)**: Didukung `generateStaticParams` untuk performa SEO optimal.

---

## 2. Instalasi Dependensi

Jalankan perintah berikut pada project target:

### Menggunakan Bun:
```bash
bun add fumadocs-core fumadocs-ui fumadocs-mdx lucide-react
bun add -d @types/mdx
```

### Menggunakan NPM:
```bash
npm install fumadocs-core fumadocs-ui fumadocs-mdx lucide-react
npm install -D @types/mdx
```

### Menggunakan PNPM:
```bash
pnpm add fumadocs-core fumadocs-ui fumadocs-mdx lucide-react
pnpm add -D @types/mdx
```

---

## 3. Konfigurasi Next.js & CSS

### 3.1. `next.config.ts` (atau `next.config.mjs`)
Bungkus konfigurasi Next.js dengan fungsi `createMDX`:

```ts
import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const nextConfig: NextConfig = {
  // Opsi config Next.js Anda (misal: reactStrictMode, output, dll.)
};

const withMDX = createMDX();

export default withMDX(nextConfig);
```

### 3.2. `app/globals.css`
Tambahkan preset tema Fumadocs di file CSS global:

```css
@import "fumadocs-ui/css/neutral.css";
@import "fumadocs-ui/css/preset.css";

/* Style aplikasi Anda selanjutnya */
```

---

## 4. Struktur Folder Proyek

Pastikan struktur file di project Anda disiapkan seperti berikut:

```text
my-project/
├── content/
│   └── guides/
│       ├── id/
│       │   ├── meta.json
│       │   ├── 00-index.md
│       │   └── 01-fitur-utama.md
│       └── en/
│           ├── meta.json
│           ├── 00-index.md
│           └── 01-main-features.md
├── lib/
│   └── docs/
│       ├── source.ts          # Loader fumadocs & resolver tree
│       ├── layout.tsx         # Konfigurasi navbar & action link
│       └── translations.ts   # Terjemahan UI (search, TOC, sidebar)
├── components/
│   └── docs/
│       ├── docs-provider.tsx         # Wrapper RootProvider
│       ├── docs-language-switch.tsx  # Switcher ID <-> EN
│       ├── docs-app-link.tsx         # Tombol kembali ke Dashboard
│       └── mdx-components.tsx        # Custom renderer MDX
└── app/
    ├── api/
    │   └── search/
    │       └── route.ts              # Server search handler
    └── docs/
        ├── page.tsx                  # Redirect otomatis ke bahasa aktif
        └── [lang]/
            ├── layout.tsx            # DocsLayout (Sidebar + Navbar)
            └── [...slug]/
                └── page.tsx          # Renderer halaman konten & TOC
```

---

## 5. Setup Sumber Konten (Source Loader)

Buat file `lib/docs/source.ts` untuk memetakan konten dari folder `content/guides` dan mengelompokkannya per bahasa:

```ts
import { defineDocs } from "fumadocs-mdx/macro";
import {
  getSlugs,
  loader,
  type MetaData,
  type StaticSource,
} from "fumadocs-core/source";
import type { Root } from "fumadocs-core/page-tree";

export const DOC_LANGUAGES = ["id", "en"] as const;
export type DocsLanguage = (typeof DOC_LANGUAGES)[number];

// 1. Definisikan folder konten
const guideCollection = defineDocs({
  dir: "content/guides",
});

type GuideSource = ReturnType<typeof guideCollection.toFumadocsSource>;
type GuidePageData = Extract<
  GuideSource["files"][number],
  { type: "page" }
>["data"];

// 2. Prefix path agar terisolasi per folder section
function prefixSection(
  source: GuideSource,
  section: "guides",
): typeof source.files {
  const files: typeof source.files = [];

  for (const file of source.files) {
    const [language, ...pathSegments] = file.path.split("/");

    if (!isDocsLanguage(language) || pathSegments.length === 0) {
      continue;
    }

    const path = [language, section, ...pathSegments].join("/");

    if (file.type === "page") {
      files.push({
        ...file,
        path,
        slugs: getSlugs(path),
      } as (typeof source.files)[number]);
      continue;
    }

    files.push({
      ...file,
      path,
    } as (typeof source.files)[number]);
  }

  return files;
}

const languageRoots: Array<{
  type: "meta";
  path: string;
  data: MetaData;
}> = [
  {
    type: "meta",
    path: "id/meta.json",
    data: {
      title: "Bahasa Indonesia",
      pages: ["guides"],
    },
  },
  {
    type: "meta",
    path: "en/meta.json",
    data: {
      title: "English",
      pages: ["guides"],
    },
  },
];

const contentSource: StaticSource<{
  pageData: GuidePageData;
  metaData: MetaData;
}> = {
  files: [
    ...languageRoots,
    ...prefixSection(guideCollection.toFumadocsSource(), "guides"),
  ],
};

// 3. Ekspor loader utama
export const docsSource = loader({
  baseUrl: "/docs",
  source: contentSource,
});

export function isDocsLanguage(value: string): value is DocsLanguage {
  return DOC_LANGUAGES.includes(value as DocsLanguage);
}

export function getDocsHome(language: DocsLanguage) {
  return `/docs/${language}/guides/00-index`;
}

export function getLanguagePageTree(language: DocsLanguage): Root {
  const tree = docsSource.getPageTree();
  const languageFolder = tree.children.find(
    (node) => node.type === "folder" && node.$ref?.folder === language,
  );

  if (!languageFolder || languageFolder.type !== "folder") {
    return tree;
  }

  return {
    type: "root",
    $id: `docs:${language}`,
    name: languageFolder.name,
    description: languageFolder.description,
    children: languageFolder.children,
  };
}
```

---

## 6. Setup Search API (Pencarian Instan Ctrl+K)

Buat file `app/api/search/route.ts`. Endpoint ini otomatis digunakan oleh modal pencarian Fumadocs:

```ts
import { createSearchAPI } from "fumadocs-core/search/server";
import { docsSource } from "@/lib/docs/source";

export const { GET } = createSearchAPI("advanced", {
  localeFilter: true,
  indexes: docsSource.getPages().map((page) => ({
    id: page.url,
    title: page.data.title ?? page.slugs.at(-1) ?? "Help Center",
    description: page.data.description,
    url: page.url,
    locale: page.slugs[0],
    structuredData: page.data.structuredData ?? {
      headings: [],
      contents: [],
    },
  })),
});
```

---

## 7. Setup Komponen UI & Provider

### 7.1. Terjemahan UI (`lib/docs/translations.ts`)
```ts
import type { DocsLanguage } from "@/lib/docs/source";

const indonesianTranslations: Record<string, string> = {
  "Search(search trigger)": "Cari dokumentasi...",
  "Search(search dialog)": "Cari dokumentasi",
  "Open Search(search trigger)(aria-label)": "Buka pencarian",
  "Close Search(search dialog)(aria-label)": "Tutup pencarian",
  "No results found(search dialog)": "Tidak ada hasil ditemukan",
  "On this page(table of contents)": "Di halaman ini",
  "No Headings(table of contents)": "Tidak ada sub-bagian",
  "Previous Page(pagination)": "Sebelumnya",
  "Next Page(pagination)": "Berikutnya",
  "Open Sidebar(sidebar)(aria-label)": "Buka navigasi",
  "Close Sidebar(sidebar)(aria-label)": "Tutup navigasi",
};

export function getDocsTranslations(language: DocsLanguage) {
  return language === "id" ? indonesianTranslations : undefined;
}
```

### 7.2. Provider Komponen (`components/docs/docs-provider.tsx`)
```tsx
import { RootProvider } from "fumadocs-ui/provider/next";
import type { DocsLanguage } from "@/lib/docs/source";
import { getDocsTranslations } from "@/lib/docs/translations";

export function DocsProvider({
  children,
  language,
}: {
  children: React.ReactNode;
  language: DocsLanguage;
}) {
  return (
    <RootProvider
      i18n={{
        locale: language,
        translations: getDocsTranslations(language),
      }}
    >
      {children}
    </RootProvider>
  );
}
```

### 7.3. Switcher Bahasa (`components/docs/docs-language-switch.tsx`)
```tsx
"use client";

import { ArrowLeftRightIcon, LanguagesIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DocsLanguage } from "@/lib/docs/source";

export function DocsLanguageSwitch({ language }: { language: DocsLanguage }) {
  const pathname = usePathname();
  const nextLanguage = language === "id" ? "en" : "id";
  const href = pathname.replace(`/docs/${language}`, `/docs/${nextLanguage}`);

  return (
    <Link
      href={href}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground"
    >
      <LanguagesIcon className="size-4" />
      <span>{language === "id" ? "English" : "Indonesia"}</span>
      <ArrowLeftRightIcon className="ms-auto size-3.5 opacity-60" />
    </Link>
  );
}
```

### 7.4. Tombol Kembali ke Aplikasi (`components/docs/docs-app-link.tsx`)
```tsx
"use client";

import { LayoutDashboardIcon } from "lucide-react";
import Link from "next/link";

export function DocsAppLink() {
  return (
    <Link
      href="/dashboard"
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground"
    >
      <LayoutDashboardIcon className="size-4 shrink-0" />
      <span>Kembali ke Aplikasi</span>
    </Link>
  );
}
```

### 7.5. Opsi Layout Navbar (`lib/docs/layout.tsx`)
```tsx
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { DocsAppLink } from "@/components/docs/docs-app-link";
import { DocsLanguageSwitch } from "@/components/docs/docs-language-switch";
import { getDocsHome, type DocsLanguage } from "@/lib/docs/source";

export function docsLayoutOptions(language: DocsLanguage): BaseLayoutProps {
  const isIndonesian = language === "id";

  return {
    nav: {
      title: (
        <span className="flex items-center gap-2 font-bold text-lg">
          {/* Ganti dengan logo aplikasi Anda */}
          <span>🚀 AppName</span>
          <span className="text-sm font-normal text-fd-muted-foreground">
            {isIndonesian ? "Pusat Bantuan" : "Help Center"}
          </span>
        </span>
      ),
      url: getDocsHome(language),
    },
    links: [
      {
        type: "custom",
        secondary: true,
        children: <DocsLanguageSwitch language={language} />,
      },
      {
        type: "custom",
        secondary: true,
        children: <DocsAppLink />,
      },
    ],
  };
}
```

### 7.6. Custom MDX Components (`components/docs/mdx-components.tsx`)
```tsx
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

export function getDocsMdxComponents(
  components?: MDXComponents,
): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
  };
}
```

---

## 8. Setup Routing App Router

### 8.1. Redirect Index (`app/docs/page.tsx`)
Mengarahkan pengguna saat mengakses `/docs` langsung ke halaman awal dengan bahasa yang sesuai:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDocsHome } from "@/lib/docs/source";

export default async function DocsIndexPage() {
  const cookieStore = await cookies();
  const language =
    cookieStore.get("app-language")?.value === "en" ? "en" : "id";

  redirect(getDocsHome(language));
}
```

### 8.2. Layout Per Bahasa (`app/docs/[lang]/layout.tsx`)
```tsx
import { notFound } from "next/navigation";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsProvider } from "@/components/docs/docs-provider";
import { docsLayoutOptions } from "@/lib/docs/layout";
import { getLanguagePageTree, isDocsLanguage } from "@/lib/docs/source";

export default async function DocumentationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  if (!isDocsLanguage(lang)) {
    notFound();
  }

  return (
    <DocsProvider language={lang}>
      <DocsLayout
        {...docsLayoutOptions(lang)}
        tree={getLanguagePageTree(lang)}
        sidebar={{ defaultOpenLevel: 1 }}
      >
        {children}
      </DocsLayout>
    </DocsProvider>
  );
}
```

### 8.3. Halaman Konten Dinamis (`app/docs/[lang]/[...slug]/page.tsx`)
```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createRelativeLink } from "fumadocs-ui/mdx";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { getDocsMdxComponents } from "@/components/docs/mdx-components";
import { docsSource, isDocsLanguage } from "@/lib/docs/source";

type PageProps = {
  params: Promise<{
    lang: string;
    slug: string[];
  }>;
};

export default async function DocumentationPage({ params }: PageProps) {
  const { lang, slug } = await params;

  if (!isDocsLanguage(lang)) {
    notFound();
  }

  const page = docsSource.getPage([lang, ...slug]);

  if (!page) {
    notFound();
  }

  const Content = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      {page.data.description && (
        <DocsDescription>{page.data.description}</DocsDescription>
      )}
      <DocsBody>
        <Content
          components={getDocsMdxComponents({
            a: createRelativeLink(docsSource, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isDocsLanguage(lang)) return {};

  const page = docsSource.getPage([lang, ...slug]);
  if (!page) return {};

  return {
    title: `${page.data.title} | Help Center`,
    description: page.data.description,
  };
}

export function generateStaticParams() {
  return docsSource.getPages().map((page) => ({
    lang: page.slugs[0],
    slug: page.slugs.slice(1),
  }));
}
```

---

## 9. Menulis Konten Markdown & Urutan Navigasi

### 9.1. Mengatur Urutan Sidebar dengan `meta.json`
Buat file `content/guides/id/meta.json`:
```json
{
  "title": "Panduan Pengguna",
  "description": "Panduan lengkap penggunaan aplikasi.",
  "root": true,
  "pagesIndex": "00-index",
  "pages": [
    "00-index",
    "01-memulai",
    "02-fitur-utama"
  ]
}
```

### 9.2. Contoh File Konten (`content/guides/id/00-index.md`)
```markdown
---
title: "Memulai Aplikasi"
description: "Pengenalan dan langkah awal penggunaan sistem."
---

Selamat datang di Pusat Bantuan aplikasi!

## Alur Singkat
1. Daftarkan akun baru Anda.
2. Lengkapi profil dan preferensi.
3. Mulai gunakan fitur utama.

## Butuh Bantuan Tambahan?
Hubungi tim support kami melalui email atau chat.
```

---

## 10. Menghubungkan Help Center ke Aplikasi Utama

Di navbar atau menu profil pengguna (misalnya dropdown user), tambahkan tautan langsung menuju Help Center:

```tsx
<a
  href={language === "id" ? "/docs/id/guides/00-index" : "/docs/en/guides/00-index"}
  target="_blank"
  rel="noopener noreferrer"
  className="flex items-center gap-2 text-sm"
>
  <BookOpenIcon className="size-4" />
  <span>Pusat Bantuan</span>
</a>
```

---

## 11. Troubleshooting & Best Practices

1. **Halaman 404 pada Dokumentasi**:
   - Pastikan slug file markdown cocok dengan yang didaftarkan di `meta.json`.
   - Pastikan path `dir` di `defineDocs` sesuai dengan direktori tempat Anda menyimpan markdown.
2. **Search Dialog Tidak Menampilkan Hasil**:
   - Pastikan `app/api/search/route.ts` sudah dibuat.
   - Periksa bahwa `docsSource.getPages()` mengembalikan array halaman yang valid saat build/dev.
3. **Optimasi Build (SSG)**:
   - Fumadocs menggunakan `generateStaticParams()` yang membuat seluruh halaman MDX dirender statis saat `next build`, sehingga loading halaman dokumentasi instan dan ringan di server.
