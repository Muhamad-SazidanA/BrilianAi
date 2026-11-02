import { createSearchAPI } from 'fumadocs-core/search/server';
import { docsSource } from '@/lib/docs/source';

export const { GET } = createSearchAPI('advanced', {
  indexes: docsSource.getPages().map((page) => ({
    id: page.url,
    title: page.data.title ?? page.slugs.at(-1) ?? 'Help Center',
    description: page.data.description,
    url: page.url,
    structuredData: page.data.structuredData ?? {
      headings: [],
      contents: [],
    },
  })),
});
