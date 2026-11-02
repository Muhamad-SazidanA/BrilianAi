import React from 'react';
import { notFound } from 'next/navigation';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { DocsProvider } from '@/components/docs/docs-provider';
import { docsLayoutOptions } from '@/lib/docs/layout';
import { getLanguagePageTree, isDocsLanguage, DOC_LANGUAGES } from '@/lib/docs/source';

export function generateStaticParams() {
  return DOC_LANGUAGES.map((lang) => ({ lang }));
}

export default function DocumentationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  const { lang } = params;

  if (!isDocsLanguage(lang)) {
    notFound();
  }

  const tree = getLanguagePageTree(lang);

  return (
    <DocsProvider language={lang}>
      <DocsLayout
        {...docsLayoutOptions(lang)}
        tree={tree}
        sidebar={{ defaultOpenLevel: 1 }}
      >
        {children}
      </DocsLayout>
    </DocsProvider>
  );
}
