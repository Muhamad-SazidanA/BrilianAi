'use client';

import React from 'react';
import { RootProvider } from 'fumadocs-ui/provider';
import { I18nProvider } from 'fumadocs-ui/i18n';
import type { DocsLanguage } from '@/lib/docs/source';
import { getDocsTranslations } from '@/lib/docs/translations';
import { DocsSearchDialog } from './docs-search-dialog';

export function DocsProvider({
  children,
  language,
}: {
  children: React.ReactNode;
  language: DocsLanguage;
}) {
  return (
    <I18nProvider
      locale={language}
      translations={getDocsTranslations(language)}
    >
      <RootProvider
        theme={{
          enabled: true,
          attribute: 'class',
          defaultTheme: 'light',
          enableSystem: false,
        }}
        search={{
          enabled: true,
          SearchDialog: DocsSearchDialog,
        }}
      >
        {children}
      </RootProvider>
    </I18nProvider>
  );
}
