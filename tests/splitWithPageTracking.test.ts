import { describe, it, expect } from 'vitest';
import { chunkWithPageOffsets, PageText } from '../lib/chunking/splitWithPageTracking';

describe('chunkWithPageOffsets (Sliding-Window Chunking with Page Tracking)', () => {
  it('1. should span across multiple pages (sourcePageStart !== sourcePageEnd) when pages have short text', async () => {
    const pages: PageText[] = [
      { pageNumber: 1, text: 'Halaman 1 berisi pendahuluan ringkas sistem AI data enterprise.' },
      { pageNumber: 2, text: 'Halaman 2 melanjutkan pembahasan modul ingestion dokumen dan arsitektur database.' },
      { pageNumber: 3, text: 'Halaman 3 menyimpulkan seluruh evaluasi kinerja dan metrik pencarian vektor.' },
    ];

    // With chunkSize 400, all 3 short pages merge into 1 chunk covering pages 1 to 3
    const chunks = await chunkWithPageOffsets(pages, 400, 50);

    expect(chunks.length).toBeGreaterThan(0);
    const multiPageChunk = chunks.find((c) => c.sourcePageStart !== c.sourcePageEnd);
    expect(multiPageChunk).toBeDefined();
    expect(multiPageChunk?.sourcePageStart).toBe(1);
    expect(multiPageChunk?.sourcePageEnd).toBe(3);
  });

  it('2. should assign sourcePageStart === sourcePageEnd === pageNumber for all chunks when 1 page has very long text', async () => {
    // Generate a long text of ~2500 characters
    const paragraph = 'Dokumen ini membahas secara mendalam sistem indexing dokumen berukuran besar dengan sliding window. ';
    const longText = paragraph.repeat(25); // ~2500 chars

    const pages: PageText[] = [
      { pageNumber: 42, text: longText },
    ];

    const chunks = await chunkWithPageOffsets(pages, 500, 100);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.sourcePageStart).toBe(42);
      expect(chunk.sourcePageEnd).toBe(42);
    }
  });

  it('3. CRITICAL CASE: should correctly assign identical repeated phrases to their corresponding page without falsely matching the first occurrence', async () => {
    // Both page 1 and page 2 contain identical distinct phrase "Purnama26"
    // We create enough surrounding content so that page 1 and page 2 split into distinct chunks
    const paddingPage1 = 'Bagian awal laporan departemen riset teknologi. '.repeat(10);
    const paddingPage2 = 'Bagian lanjutan laporan departemen operasional. '.repeat(10);

    const pages: PageText[] = [
      {
        pageNumber: 1,
        text: `${paddingPage1} Kode otentikasi utama adalah Purnama26 untuk akses riset.`,
      },
      {
        pageNumber: 2,
        text: `${paddingPage2} Kode otentikasi cadangan adalah Purnama26 untuk akses operasional.`,
      },
    ];

    const chunks = await chunkWithPageOffsets(pages, 300, 50);

    // Find chunks containing "Purnama26"
    const purnamaChunks = chunks.filter((c) => c.content.includes('Purnama26'));
    expect(purnamaChunks.length).toBeGreaterThanOrEqual(2);

    // First occurrence must belong to page 1
    expect(purnamaChunks[0].sourcePageStart).toBe(1);

    // Last occurrence must belong to page 2 (NOT page 1!)
    const lastPurnamaChunk = purnamaChunks[purnamaChunks.length - 1];
    expect(lastPurnamaChunk.sourcePageStart).toBe(2);
    expect(lastPurnamaChunk.sourcePageEnd).toBe(2);
    expect(lastPurnamaChunk.content).toContain('akses operasional');
  });

  it('4. should verify chunk overlap occurs between consecutive chunks when chunkOverlap > 0', async () => {
    const text1 = 'Kalimat pertama menjelaskan fondasi arsitektur sistem. ';
    const text2 = 'Kalimat kedua membahas integrasi database pgvector. ';
    const text3 = 'Kalimat ketiga membahas pipeline BullMQ dan antrean job. ';
    const text4 = 'Kalimat keempat membahas inferensi AI Vision multimodal. ';
    const text5 = 'Kalimat kelima membahas optimasi cosine similarity index HNSW. ';

    const pages: PageText[] = [
      { pageNumber: 1, text: text1 + text2 + text3 + text4 + text5 },
    ];

    const chunkSize = 120;
    const chunkOverlap = 40;
    const chunks = await chunkWithPageOffsets(pages, chunkSize, chunkOverlap);

    expect(chunks.length).toBeGreaterThan(1);

    // Verify that consecutive chunks share overlapping words/substrings
    let foundOverlap = false;
    for (let i = 0; i < chunks.length - 1; i++) {
      const currentChunk = chunks[i].content;
      const nextChunk = chunks[i + 1].content;

      // Extract trailing substring of current chunk
      const tail = currentChunk.slice(-20).trim();
      if (nextChunk.includes(tail)) {
        foundOverlap = true;
        break;
      }
    }

    expect(foundOverlap).toBe(true);
  });

  it('5. should return an empty array without crashing when pages input is empty or has no content', async () => {
    expect(await chunkWithPageOffsets([])).toEqual([]);
    expect(await chunkWithPageOffsets([{ pageNumber: 1, text: '' }])).toEqual([]);
    expect(await chunkWithPageOffsets([{ pageNumber: 1, text: '   ' }])).toEqual([]);
  });
});
