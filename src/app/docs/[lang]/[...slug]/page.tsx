import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/page';
import { getDocsMdxComponents } from '@/components/docs/mdx-components';
import { DocsAppLink } from '@/components/docs/docs-app-link';
import { DocsLanguageSwitch } from '@/components/docs/docs-language-switch';
import { DocsThemeSwitch } from '@/components/docs/docs-theme-switch';
import { docsSource, isDocsLanguage, type DocsLanguage } from '@/lib/docs/source';

type DocumentationPageProps = {
  params: {
    lang: string;
    slug: string[];
  };
};

export default function DocumentationPage({ params }: DocumentationPageProps) {
  const { lang, slug } = params;

  if (!isDocsLanguage(lang)) {
    notFound();
  }

  const page = docsSource.getPage([lang, ...slug]);

  if (!page) {
    notFound();
  }

  const Content = page.data.body;

  return (
    <DocsPage
      toc={page.data.toc}
      tableOfContent={{
        header: (
          <div className="flex flex-col gap-1 pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
            <DocsLanguageSwitch language={lang as DocsLanguage} />
            <DocsThemeSwitch language={lang as DocsLanguage} />
            <DocsAppLink language={lang as DocsLanguage} />
          </div>
        ),
      }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      {page.data.description ? (
        <DocsDescription>{page.data.description}</DocsDescription>
      ) : null}
      <DocsBody>
        <Content components={getDocsMdxComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateMetadata({ params }: DocumentationPageProps): Metadata {
  const { lang, slug } = params;
  if (!isDocsLanguage(lang)) return {};

  const page = docsSource.getPage([lang, ...slug]);
  if (!page) return {};

  return {
    title: `${page.data.title} | Pusat Bantuan Brilian.Ai`,
    description: page.data.description,
  };
}

export function generateStaticParams() {
  return docsSource.getPages().map((page) => ({
    lang: page.slugs[0],
    slug: page.slugs.slice(1),
  }));
}
