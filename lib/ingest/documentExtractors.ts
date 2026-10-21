import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { extractPdfPagesTextHybrid, PageTextResult } from '../pdf/renderPages';

export type SupportedDocumentType = 'pdf' | 'docx' | 'doc' | 'xlsx' | 'xls' | 'csv' | 'unknown';

export interface DocumentExtractResult {
  pagesText: PageTextResult[];
  detectedType: SupportedDocumentType;
  metadata?: Record<string, any>;
}

export interface ExtractOptions {
  minDigitalTextLength?: number;
  rowsPerPage?: number;
  charsPerPage?: number;
}

// Magic byte signatures
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK.. (docx, xlsx)
const OLE2_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // doc, xls

/**
 * Mendeteksi jenis berkas berdasarkan kombinasi ekstensi nama file dan magic byte signature.
 */
export function detectDocumentType(buffer: Buffer, filename: string): SupportedDocumentType {
  const ext = (filename.split('.').pop() || '').toLowerCase();

  // 1. Check PDF signature
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(PDF_MAGIC)) {
    return 'pdf';
  }

  // 2. Check ZIP signature (DOCX or XLSX)
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(ZIP_MAGIC)) {
    if (ext === 'xlsx' || ext === 'xlsm') return 'xlsx';
    if (ext === 'docx') return 'docx';
    // Fallback based on extension
    return ext === 'xlsx' ? 'xlsx' : 'docx';
  }

  // 3. Check OLE2 signature (legacy DOC or XLS)
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(OLE2_MAGIC)) {
    if (ext === 'xls') return 'xls';
    if (ext === 'doc') return 'doc';
    return ext === 'xls' ? 'xls' : 'doc';
  }

  // 4. Extension checks for CSV and others
  if (ext === 'csv') return 'csv';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'xlsx' || ext === 'xls') return ext;
  if (ext === 'docx' || ext === 'doc') return ext;

  return 'unknown';
}

/**
 * Format baris data array menjadi tabel GitHub Flavored Markdown yang rapi dan aman.
 */
export function formatRowsToMarkdownTable(rows: any[][]): string {
  if (!rows || rows.length === 0) return '';

  // Filter out baris yang kosong semua
  const cleanRows = rows
    .map((row) => (Array.isArray(row) ? row.map((cell) => (cell !== null && cell !== undefined ? String(cell).trim() : '')) : []))
    .filter((row) => row.some((cell) => cell.length > 0));

  if (cleanRows.length === 0) return '';

  // Temukan jumlah kolom maksimum
  const maxCols = Math.max(...cleanRows.map((r) => r.length), 1);

  // Normalisasi seluruh baris agar memiliki panjang maxCols dan sanitasi karakter pipe/newline
  const normalizedRows = cleanRows.map((row) => {
    const padded = [...row];
    while (padded.length < maxCols) {
      padded.push('');
    }
    return padded.slice(0, maxCols).map((val) => val.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>'));
  });

  const headerRow = normalizedRows[0].map((h, i) => (h ? h : `Kolom_${i + 1}`));
  const dividerRow = headerRow.map(() => '---');

  const tableLines: string[] = [
    `| ${headerRow.join(' | ')} |`,
    `| ${dividerRow.join(' | ')} |`,
  ];

  for (let r = 1; r < normalizedRows.length; r++) {
    tableLines.push(`| ${normalizedRows[r].join(' | ')} |`);
  }

  return tableLines.join('\n');
}

/**
 * Mengekstrak dokumen Excel (.xlsx, .xls) menjadi halaman-halaman tabel Markdown.
 * Setiap lembar kerja (Sheet) diubah menjadi tabel terstruktur.
 * Jika sheet memiliki banyak baris (> rowsPerPage), sheet dipaginasi dengan header berulang.
 */
export async function extractExcelPages(
  fileBuffer: Buffer,
  filename: string,
  options?: ExtractOptions
): Promise<PageTextResult[]> {
  const rowsPerPage = options?.rowsPerPage ?? 50;
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const pages: PageTextResult[] = [];
  let pageNumber = 1;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    // Convert worksheet ke array 2D
    const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });

    // Filter baris kosong
    const cleanRows = rawRows.filter((row) => Array.isArray(row) && row.some((c) => c !== '' && c !== null && c !== undefined));

    if (cleanRows.length === 0) {
      pages.push({
        pageNumber: pageNumber++,
        text: `## Sheet: ${sheetName}\n\n*(Lembar kerja "${sheetName}" kosong atau tidak memiliki data)*`,
      });
      continue;
    }

    const header = cleanRows[0];
    const dataRows = cleanRows.slice(1);

    if (dataRows.length <= rowsPerPage) {
      // 1 halaman penuh untuk sheet ini
      const tableMd = formatRowsToMarkdownTable(cleanRows);
      pages.push({
        pageNumber: pageNumber++,
        text: `## Sheet: ${sheetName} (${cleanRows.length} Baris)\n\n${tableMd}`,
      });
    } else {
      // Paginasi baris per halaman agar RAG chunking optimal
      const totalPagesForSheet = Math.ceil(dataRows.length / rowsPerPage);
      for (let p = 0; p < totalPagesForSheet; p++) {
        const startIdx = p * rowsPerPage;
        const endIdx = Math.min(startIdx + rowsPerPage, dataRows.length);
        const chunkData = [header, ...dataRows.slice(startIdx, endIdx)];
        const tableMd = formatRowsToMarkdownTable(chunkData);

        pages.push({
          pageNumber: pageNumber++,
          text: `## Sheet: ${sheetName} (Baris ${startIdx + 1} - ${endIdx} dari ${dataRows.length})\n\n${tableMd}`,
        });
      }
    }
  }

  if (pages.length === 0) {
    pages.push({
      pageNumber: 1,
      text: `## Dokumen Excel: ${filename}\n\n*(Workbook tidak memiliki lembar kerja aktif)*`,
    });
  }

  return pages;
}

/**
 * Mengekstrak dokumen CSV (.csv) menjadi halaman-halaman tabel Markdown.
 */
export async function extractCsvPages(
  fileBuffer: Buffer,
  filename: string,
  options?: ExtractOptions
): Promise<PageTextResult[]> {
  const rowsPerPage = options?.rowsPerPage ?? 50;
  // Gunakan SheetJS untuk parsing CSV (otomatis mendeteksi koma/titik-koma/tab dan escape quotes)
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;

  if (!worksheet) {
    return [
      {
        pageNumber: 1,
        text: `## Dokumen CSV: ${filename}\n\n*(File CSV kosong)*`,
      },
    ];
  }

  const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });

  const cleanRows = rawRows.filter((row) => Array.isArray(row) && row.some((c) => c !== '' && c !== null && c !== undefined));

  if (cleanRows.length === 0) {
    return [
      {
        pageNumber: 1,
        text: `## Dokumen CSV: ${filename}\n\n*(File CSV kosong)*`,
      },
    ];
  }

  const header = cleanRows[0];
  const dataRows = cleanRows.slice(1);
  const pages: PageTextResult[] = [];

  if (dataRows.length <= rowsPerPage) {
    const tableMd = formatRowsToMarkdownTable(cleanRows);
    pages.push({
      pageNumber: 1,
      text: `## CSV: ${filename} (${cleanRows.length} Baris)\n\n${tableMd}`,
    });
  } else {
    const totalPages = Math.ceil(dataRows.length / rowsPerPage);
    for (let p = 0; p < totalPages; p++) {
      const startIdx = p * rowsPerPage;
      const endIdx = Math.min(startIdx + rowsPerPage, dataRows.length);
      const chunkData = [header, ...dataRows.slice(startIdx, endIdx)];
      const tableMd = formatRowsToMarkdownTable(chunkData);

      pages.push({
        pageNumber: p + 1,
        text: `## CSV: ${filename} (Baris ${startIdx + 1} - ${endIdx} dari ${dataRows.length})\n\n${tableMd}`,
      });
    }
  }

  return pages;
}

/**
 * Membagi teks dokumen Word yang panjang menjadi halaman virtual yang terstruktur.
 */
function splitTextIntoVirtualPages(
  text: string,
  docTitle: string,
  charsPerPage = 2000
): PageTextResult[] {
  const clean = text.trim();
  if (!clean) {
    return [{ pageNumber: 1, text: `## Dokumen: ${docTitle}\n\n*(Dokumen tidak memiliki isi teks)*` }];
  }

  if (clean.length <= charsPerPage) {
    return [{ pageNumber: 1, text: clean }];
  }

  // Pecah berdasarkan paragraf ganda (\n\n) atau heading
  const paragraphs = clean.split(/\n{2,}/);
  const pages: PageTextResult[] = [];
  let currentText = '';
  let pageNumber = 1;

  for (const para of paragraphs) {
    if (currentText.length + para.length > charsPerPage && currentText.trim().length > 0) {
      pages.push({
        pageNumber: pageNumber++,
        text: currentText.trim(),
      });
      currentText = '';
    }
    currentText += (currentText ? '\n\n' : '') + para;
  }

  if (currentText.trim().length > 0) {
    pages.push({
      pageNumber: pageNumber++,
      text: currentText.trim(),
    });
  }

  return pages;
}

/**
 * Mengekstrak dokumen Word (.docx) menjadi Markdown terstruktur.
 * Mempertahankan heading, tabel, bullet-point, dan format teks via Mammoth.
 */
export async function extractDocxPages(
  fileBuffer: Buffer,
  filename: string,
  options?: ExtractOptions
): Promise<PageTextResult[]> {
  try {
    const result = await (mammoth as any).convertToMarkdown({ buffer: fileBuffer });
    let markdown = (result.value || '').trim();

    // Fallback jika markdown kosong namun ada raw text
    if (!markdown) {
      const rawResult = await mammoth.extractRawText({ buffer: fileBuffer });
      markdown = (rawResult.value || '').trim();
    }

    return splitTextIntoVirtualPages(markdown, filename, options?.charsPerPage ?? 2000);
  } catch (error) {
    console.warn(`[extractDocxPages] Gagal konversi mammoth untuk ${filename}, mencoba fallback text:`, error);
    // Fallback ke raw text jika convertToMarkdown gagal
    try {
      const rawResult = await mammoth.extractRawText({ buffer: fileBuffer });
      return splitTextIntoVirtualPages(rawResult.value || '', filename, options?.charsPerPage ?? 2000);
    } catch (innerError) {
      throw new Error(`Gagal membaca berkas Word .docx "${filename}": ${innerError instanceof Error ? innerError.message : String(innerError)}`);
    }
  }
}

/**
 * Mengekstrak dokumen Word legacy (.doc) menggunakan word-extractor.
 */
export async function extractDocPages(
  fileBuffer: Buffer,
  filename: string,
  options?: ExtractOptions
): Promise<PageTextResult[]> {
  // Cek apakah sebenarnya ini berkas docx yang disimpan berekstensi .doc
  if (fileBuffer.length >= 4 && fileBuffer.subarray(0, 4).equals(ZIP_MAGIC)) {
    return await extractDocxPages(fileBuffer, filename, options);
  }

  try {
    // Dynamic import WordExtractor
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const WordExtractor = require('word-extractor');
    const extractor = new WordExtractor();
    const extracted = await extractor.extract(fileBuffer);
    const bodyText = (extracted.getBody() || '').trim();

    return splitTextIntoVirtualPages(bodyText, filename, options?.charsPerPage ?? 2000);
  } catch (err) {
    console.warn(`[extractDocPages] Gagal ekstraksi .doc dengan word-extractor untuk ${filename}:`, err);
    // Coba mammoth sebagai fallback terakhir
    try {
      return await extractDocxPages(fileBuffer, filename, options);
    } catch {
      throw new Error(`Gagal membaca berkas Word .doc "${filename}": Format tidak didukung atau berkas rusak.`);
    }
  }
}

/**
 * Dispatcher Terpadu: Mengekstrak teks dari berbagai format berkas (PDF, DOCX, DOC, XLSX, XLS, CSV).
 * Mengembalikan array { pageNumber, text } yang siap dikirim ke sliding-window chunker.
 */
export async function extractDocumentPages(
  fileBuffer: Buffer,
  filename: string,
  options?: ExtractOptions
): Promise<DocumentExtractResult> {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new Error('Buffer dokumen kosong atau tidak valid.');
  }

  const detectedType = detectDocumentType(fileBuffer, filename);

  switch (detectedType) {
    case 'pdf': {
      const pagesText = await extractPdfPagesTextHybrid(fileBuffer, {
        minDigitalTextLength: options?.minDigitalTextLength,
      });
      return { pagesText, detectedType: 'pdf' };
    }

    case 'xlsx':
    case 'xls': {
      const pagesText = await extractExcelPages(fileBuffer, filename, options);
      return { pagesText, detectedType };
    }

    case 'csv': {
      const pagesText = await extractCsvPages(fileBuffer, filename, options);
      return { pagesText, detectedType: 'csv' };
    }

    case 'docx': {
      const pagesText = await extractDocxPages(fileBuffer, filename, options);
      return { pagesText, detectedType: 'docx' };
    }

    case 'doc': {
      const pagesText = await extractDocPages(fileBuffer, filename, options);
      return { pagesText, detectedType: 'doc' };
    }

    default: {
      // Jika ekstensi teks polos (.txt, .md), baca sebagai string
      const ext = (filename.split('.').pop() || '').toLowerCase();
      if (['txt', 'text', 'markdown', 'md'].includes(ext)) {
        const text = fileBuffer.toString('utf-8');
        const pagesText = splitTextIntoVirtualPages(text, filename, options?.charsPerPage ?? 2000);
        return { pagesText, detectedType: 'unknown' };
      }

      throw new Error(
        `Format berkas "${filename}" tidak didukung. Sistem mendukung PDF (.pdf), Word (.docx, .doc), Excel (.xlsx, .xls), dan CSV (.csv).`
      );
    }
  }
}
