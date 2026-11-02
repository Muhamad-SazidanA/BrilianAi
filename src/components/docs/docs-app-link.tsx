'use client';

import { LayoutGrid } from 'lucide-react';
import Link from 'next/link';

export function DocsAppLink({ language }: { language?: 'id' | 'en' }) {
  const label = language === 'en' ? 'Go to Apps' : 'Kembali ke Aplikasi';

  return (
    <Link
      href="/dashboard"
      className="docs-quick-action group flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm font-normal text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
    >
      <span className="flex items-center gap-2.5">
        <LayoutGrid className="size-4 shrink-0 text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200" aria-hidden="true" />
        <span className="text-sm font-normal text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">{label}</span>
      </span>
    </Link>
  );
}
