import type { DocsLanguage } from './source';

const indonesianTranslations: Record<string, string> = {
  'Search(search trigger)': 'Cari dokumentasi...',
  'Search(search dialog)': 'Cari dokumentasi',
  'Open Search(search trigger)(aria-label)': 'Buka pencarian',
  'Close Search(search dialog)(aria-label)': 'Tutup pencarian',
  'No results found(search dialog)': 'Tidak ada hasil ditemukan',
  'On this page(table of contents)': 'Di halaman ini',
  'No Headings(table of contents)': 'Tidak ada sub-bagian',
  'Previous Page(pagination)': 'Sebelumnya',
  'Next Page(pagination)': 'Berikutnya',
  'Open Sidebar(sidebar)(aria-label)': 'Buka navigasi',
  'Close Sidebar(sidebar)(aria-label)': 'Tutup navigasi',
};

export function getDocsTranslations(language: DocsLanguage) {
  return language === 'id' ? indonesianTranslations : undefined;
}

