import React from 'react';
import Image from 'next/image';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { DocsAppLink } from '@/components/docs/docs-app-link';
import { DocsLanguageSwitch } from '@/components/docs/docs-language-switch';
import { DocsThemeSwitch } from '@/components/docs/docs-theme-switch';
import { getDocsHome, type DocsLanguage } from './source';

export function docsLayoutOptions(language: DocsLanguage): BaseLayoutProps {
  const isIndonesian = language === 'id';

  return {
    nav: {
      title: (
        <span className="flex items-center gap-2">
          <Image
            src="/images/BrilianLogo-Open-B.svg"
            alt="Brilian.Ai"
            width={112}
            height={28}
            className="h-7 w-auto dark:brightness-0 dark:invert"
          />
          <span className="hidden text-sm font-medium text-fd-muted-foreground sm:inline border-l border-fd-border pl-2.5">
            {isIndonesian ? 'Pusat Bantuan' : 'Help Center'}
          </span>
        </span>
      ),
      url: getDocsHome(language),
    },
    links: [],
    disableThemeSwitch: true,
  };
}

