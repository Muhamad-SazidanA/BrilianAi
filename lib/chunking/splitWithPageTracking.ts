import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export type PageText = {
  pageNumber: number;
  text: string;
};

export type ChunkWithPageRange = {
  content: string;
  sourcePageStart: number;
  sourcePageEnd: number;
};

interface PageOffset {
  pageNumber: number;
  startOffset: number;
  endOffset: number;
}

/**
 * Merges text from multiple pages, splits them using sliding window (RecursiveCharacterTextSplitter),
 * and tracks the source page range (sourcePageStart & sourcePageEnd) for each chunk.
 *
 * @param pages - Array of { pageNumber, text } objects
 * @param chunkSize - Maximum character size per chunk (default: 800)
 * @param chunkOverlap - Overlap character size between consecutive chunks (default: 150)
 * @returns Promise<ChunkWithPageRange[]> - Array of chunks with tracked source page ranges
 */
export async function chunkWithPageOffsets(
  pages: PageText[],
  chunkSize: number = 800,
  chunkOverlap: number = 150
): Promise<ChunkWithPageRange[]> {
  if (!pages || pages.length === 0) {
    return [];
  }

  // Filter out any invalid items
  const validPages = pages.filter((p) => typeof p.pageNumber === 'number');
  if (validPages.length === 0) {
    return [];
  }

  // 1. Build fullText and page offset table
  const pageOffsets: PageOffset[] = [];
  let fullText = '';

  for (let i = 0; i < validPages.length; i++) {
    const page = validPages[i];
    const text = page.text || '';
    const startOffset = fullText.length;
    fullText += text;
    const endOffset = fullText.length;

    pageOffsets.push({
      pageNumber: page.pageNumber,
      startOffset,
      endOffset,
    });

    if (i < validPages.length - 1) {
      fullText += '\n\n';
    }
  }

  if (!fullText.trim()) {
    return [];
  }

  // 2. Split fullText using RecursiveCharacterTextSplitter
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });

  const rawChunks = await splitter.splitText(fullText);
  if (!rawChunks || rawChunks.length === 0) {
    return [];
  }

  // 3 & 4. Map each chunk back to fullText with forward-moving search pointer
  const result: ChunkWithPageRange[] = [];
  let searchFromIndex = 0;

  for (let i = 0; i < rawChunks.length; i++) {
    const chunk = rawChunks[i];
    const trimmedChunk = chunk.trim();
    if (!trimmedChunk) continue;

    // Search forward from searchFromIndex to prevent matching identical repeated phrases on earlier pages
    let matchIndex = fullText.indexOf(chunk, searchFromIndex);

    if (matchIndex === -1) {
      matchIndex = fullText.indexOf(trimmedChunk, searchFromIndex);
    }

    // Fallback if not found forward (e.g. heavy normalization)
    if (matchIndex === -1) {
      matchIndex = fullText.indexOf(trimmedChunk, 0);
    }

    if (matchIndex === -1) {
      matchIndex = searchFromIndex;
    }

    const chunkStart = matchIndex;
    const chunkEnd = matchIndex + (chunk.length || trimmedChunk.length);

    // Update searchFromIndex for next chunk:
    // Move forward past the start of this chunk, leaving room for overlap
    searchFromIndex = Math.max(0, chunkStart + Math.max(1, chunk.length - chunkOverlap));

    // Find all pages overlapping with [chunkStart, chunkEnd]
    const overlappingPages = pageOffsets.filter((p) => {
      // If page text is empty, check if chunk boundary aligns
      if (p.startOffset === p.endOffset) {
        return chunkStart <= p.startOffset && p.endOffset <= chunkEnd;
      }
      // Standard interval intersection: [chunkStart, chunkEnd] overlaps [p.startOffset, p.endOffset]
      return Math.max(chunkStart, p.startOffset) < Math.min(chunkEnd, p.endOffset);
    });

    let sourcePageStart: number;
    let sourcePageEnd: number;

    if (overlappingPages.length > 0) {
      sourcePageStart = overlappingPages[0].pageNumber;
      sourcePageEnd = overlappingPages[overlappingPages.length - 1].pageNumber;
    } else {
      // Fallback to nearest page in offset table
      const nearest = pageOffsets.reduce((prev, curr) => {
        const prevDiff = Math.abs(prev.startOffset - chunkStart);
        const currDiff = Math.abs(curr.startOffset - chunkStart);
        return currDiff < prevDiff ? curr : prev;
      }, pageOffsets[0]);
      sourcePageStart = nearest.pageNumber;
      sourcePageEnd = nearest.pageNumber;
    }

    result.push({
      content: chunk,
      sourcePageStart,
      sourcePageEnd,
    });
  }

  return result;
}
