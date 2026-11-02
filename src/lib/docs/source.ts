import { docs, meta } from '@/.source';
import { createMDXSource } from 'fumadocs-mdx';
import { loader } from 'fumadocs-core/source';
import type { PageTree } from 'fumadocs-core/server';

export const DOC_LANGUAGES = ['id', 'en'] as const;
export type DocsLanguage = (typeof DOC_LANGUAGES)[number];

export const docsSource = loader({
  baseUrl: '/docs',
  source: createMDXSource(docs, meta),
});

export function isDocsLanguage(value: string): value is DocsLanguage {
  return DOC_LANGUAGES.includes(value as DocsLanguage);
}

export function getDocsHome(language: DocsLanguage) {
  return `/docs/${language}/00-index`;
}

export function getLanguagePageTree(language: DocsLanguage): PageTree.Root {
  const tree = docsSource.pageTree;

  const languageFolder = tree.children.find((node) => {
    if (node.type !== 'folder') return false;
    const metaFile = (node as any).$ref?.metaFile?.replace(/\\/g, '/');
    if (metaFile?.startsWith(`${language}/`)) return true;
    const firstUrl = (node as any).children?.[0]?.url;
    if (firstUrl?.startsWith(`/docs/${language}/`)) return true;
    return false;
  });

  if (!languageFolder || languageFolder.type !== 'folder') {
    return tree;
  }

  return {
    name: languageFolder.name,
    children: languageFolder.children,
  };
}
