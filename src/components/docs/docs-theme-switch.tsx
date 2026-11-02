'use client';

import * as React from 'react';
import { ArrowLeftRight, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { DocsLanguage } from '@/lib/docs/source';

export function DocsThemeSwitch({
  language,
}: {
  language: DocsLanguage;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === 'dark' : false;

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const label = isDark ? 'Dark' : 'Light';
  const nextLabel = isDark ? 'Light' : 'Dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="docs-quick-action group flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm font-normal text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
      aria-label={
        language === 'id'
          ? `Ganti mode warna ke ${nextLabel}`
          : `Switch color mode to ${nextLabel}`
      }
    >
      <span className="flex items-center gap-2.5">
        {isDark ? (
          <Moon className="size-4 shrink-0 text-blue-400 group-hover:text-blue-300" />
        ) : (
          <Sun className="size-4 shrink-0 text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200" />
        )}
        <span className="text-sm font-normal text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">
          {label}
        </span>
      </span>
      <ArrowLeftRight className="size-3.5 shrink-0 text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300" />
    </button>
  );
}
