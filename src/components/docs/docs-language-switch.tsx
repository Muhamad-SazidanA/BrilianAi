'use client';

import * as React from 'react';
import { ArrowLeftRight, Languages, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { DocsLanguage } from '@/lib/docs/source';

export function DocsLanguageSwitch({ language }: { language: DocsLanguage }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const nextLanguage: DocsLanguage = language === 'id' ? 'en' : 'id';
  const href = pathname.replace(`/docs/${language}`, `/docs/${nextLanguage}`);
  const label = language === 'id' ? 'English' : 'Indonesia';

  // Aggressively prefetch the target language route
  React.useEffect(() => {
    router.prefetch(href);
  }, [router, href]);

  // Reset loading state when pathname changes
  React.useEffect(() => {
    setIsPending(false);
  }, [pathname]);

  return (
    <Link
      href={href}
      prefetch={true}
      onMouseEnter={() => router.prefetch(href)}
      onTouchStart={() => router.prefetch(href)}
      onClick={() => setIsPending(true)}
      className="docs-quick-action group flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm font-normal text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
      aria-label={
        language === 'id'
          ? 'Switch documentation to English'
          : 'Ganti dokumentasi ke Bahasa Indonesia'
      }
    >
      <span className="flex items-center gap-2.5">
        <Languages className="size-4 shrink-0 text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200" />
        <span className="text-sm font-normal text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">
          {label}
        </span>
      </span>
      {isPending ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-blue-500" />
      ) : (
        <ArrowLeftRight className="size-3.5 shrink-0 text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300" />
      )}
    </Link>
  );
}
