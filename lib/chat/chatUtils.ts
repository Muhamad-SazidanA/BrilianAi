/**
 * Mendeteksi apakah jawaban menyatakan bahwa data/informasi tidak ditemukan di dalam dokumen.
 * Jika ya, referensi halaman dokumen (sources) TIDAK BOLEH ditampilkan kepada pengguna
 * karena halaman-halaman tersebut tidak memuat jawaban yang dicari (bukan data riil).
 */
export function isDataNotFoundAnswer(answer: string): boolean {
  if (!answer || typeof answer !== 'string') return true;

  const text = answer.trim().toLowerCase();

  // Pola kalimat eksplisit penolakan atau data tidak ditemukan
  const notFoundPatterns = [
    /tidak (dapat |bisa )?ditemukan/i,
    /tidak (ada|terdapat|tersedia|memuat|mencantumkan|menyebutkan|menjelaskan) (informasi|data|catatan|keterangan|referensi|pembahasan|rincian|penjelasan|lokasi|alamat)/i,
    /dokumen (ini |tersebut |yang disediakan )?tidak (menyebutkan|mencantumkan|memuat|menjelaskan|berisi|memiliki)/i,
    /maaf,\s*(saya\s*)?tidak/i,
    /data tidak ditemukan/i,
    /informasi .* tidak ditemukan/i,
    /tidak tercantum (di|dalam)/i,
    /tidak terdapat (di|dalam) dokumen/i,
    /tidak ada catatan mengenai/i,
  ];

  const hasNegativePattern = notFoundPatterns.some((pattern) => pattern.test(text));
  if (!hasNegativePattern) {
    return false;
  }

  // Jika terdapat sub-bagian poin peluru (•) dan uraian cukup panjang (> 400 karakter),
  // kemungkinan besar ini jawaban positif dengan rincian yang hanya memuat catatan kecil di akhir.
  // Namun jika tidak ada poin peluru, atau teks ringkas (< 400 karakter),
  // maka ini murni respons penolakan / data tidak ditemukan di dokumen.
  const hasBulletPoints = text.includes('•') || text.includes('\n- ') || text.includes('\n* ');
  if (!hasBulletPoints) {
    return true;
  }

  if (text.length < 400) {
    return true;
  }

  return false;
}

/* ──────────────────────────────────────────────────────────────────────────
   Aturan Deteksi Pola Format Jawaban (Sesuai spesifikasi Pertanyaan.md)
   ────────────────────────────────────────────────────────────────────────── */

export interface FormattingInstruction {
  format?: 'list' | 'paragraph' | 'table' | 'steps' | 'comparison' | 'code' | null;
  count?: number | null;
  lengthModifier?: 'short' | 'long' | null;
  clarityModifier?: boolean;
  summaryAtEnd?: boolean;
  noBullets?: boolean;
  rawMatched?: string[];
}

const NUMBER_WORDS: Record<string, number> = {
  satu: 1, one: 1,
  dua: 2, two: 2,
  tiga: 3, three: 3,
  empat: 4, four: 4,
  lima: 5, five: 5,
  enam: 6, six: 6,
  tujuh: 7, seven: 7,
  delapan: 8, eight: 8,
  sembilan: 9, nine: 9,
  sepuluh: 10, ten: 10,
  sebelas: 11, eleven: 11,
  'dua belas': 12, twelve: 12,
  'tiga belas': 13, thirteen: 13,
  'empat belas': 14, fourteen: 14,
  'lima belas': 15, fifteen: 15,
  'enam belas': 16, sixteen: 16,
  'tujuh belas': 17, seventeen: 17,
  'delapan belas': 18, eighteen: 18,
  'sembilan belas': 19, nineteen: 19,
  'dua puluh': 20, twenty: 20,
};

function parseNumber(val: string): number | null {
  const num = parseInt(val, 10);
  if (!isNaN(num)) return num;
  return NUMBER_WORDS[val.toLowerCase().trim()] ?? null;
}

/**
 * Mendeteksi instruksi format, jumlah angka, panjang/kepadatan, dan kejelasan
 * dari pertanyaan pengguna berdasarkan aturan Pertanyaan.md.
 * Menerima angka baik dalam bentuk digit (1, 2, 3, 4, 5 dst) maupun ejaan kata (satu, dua, tiga, empat, lima dst).
 * Mengembalikan null jika pengguna tidak meminta format khusus (maka gunakan gaya default AI).
 */
export function parseUserFormattingInstruction(query: string): FormattingInstruction | null {
  if (!query || typeof query !== 'string') return null;

  const q = query.trim().toLowerCase();
  const matched: string[] = [];
  let format: FormattingInstruction['format'] = null;
  let count: number | null = null;
  let lengthModifier: FormattingInstruction['lengthModifier'] = null;
  let clarityModifier = false;
  let summaryAtEnd = false;
  let noBullets = false;

  const numPattern =
    '\\d+|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|dua\\s+belas|tiga\\s+belas|empat\\s+belas|lima\\s+belas|dua\\s+puluh|one|two|three|four|five|six|seven|eight|nine|ten';

  // 1. Deteksi Angka + Format (Prioritas Tertinggi)
  // Cocok untuk digit (1, 2, 3...) maupun kata (satu, dua, tiga, empat, lima...)
  // Contoh: "4 list", "empat poin", "list 4 point", "5 alasan", "tiga hal", "2 cara"
  const countListRegex = new RegExp(
    `(?:dalam\\s+)?(${numPattern})\\s*(?:buah\\s+)?(?:list|poin|point|bullet|butir|alasan|faktor|aspek|langkah|item|hal|cara|contoh|prinsip)`,
    'i'
  );
  const listCountRegex = new RegExp(
    `(?:list|poin|point|bullet)\\s*(${numPattern})`,
    'i'
  );

  // Contoh: "2 paragraf", "dua paragraf", "dalam tiga paragraf"
  const countParagraphRegex = new RegExp(
    `(?:dalam\\s+)?(${numPattern})\\s*(?:buah\\s+)?(?:paragraf|paragraph)`,
    'i'
  );
  const paragraphCountRegex = new RegExp(
    `(?:paragraf|paragraph)\\s*(${numPattern})`,
    'i'
  );

  const countListMatch = q.match(countListRegex) || q.match(listCountRegex);
  const countParaMatch = q.match(countParagraphRegex) || q.match(paragraphCountRegex);

  if (countListMatch) {
    count = parseNumber(countListMatch[1]);
    format = 'list';
    matched.push(`Jumlah list: ${count}`);
  } else if (countParaMatch) {
    count = parseNumber(countParaMatch[1]);
    format = 'paragraph';
    matched.push(`Jumlah paragraf: ${count}`);
  }

  // 2. Deteksi Format Khusus Lainnya jika belum ditentukan
  if (!format) {
    if (/(?:buat|dalam bentuk|bentuk)?\s*(?:tabel|table)/i.test(q)) {
      format = 'table';
      matched.push('Format tabel');
    } else if (/step by step|langkah-langkah|tahapan|langkah demi langkah/i.test(q)) {
      format = 'steps';
      matched.push('Format bernomor berurutan (numbered steps)');
    } else if (/(?:buat\s+)?perbandingan|bandingkan\b|compare\b/i.test(q)) {
      format = 'comparison';
      matched.push('Format perbandingan');
    } else if (/(?:contoh\s+)?(?:kode|kodingan)|code block|code snippet/i.test(q)) {
      format = 'code';
      matched.push('Format code block');
    } else if (/jangan (?:pakai|gunakan) (?:bullet|poin|list)|tulis biasa aja|tanpa (?:bullet|poin|list)/i.test(q)) {
      noBullets = true;
      format = 'paragraph';
      matched.push('Tulis biasa tanpa bullet points');
    } else if (/buat list|dalam bentuk list|list-kan|poin-poin|bullet points?|buat dalam bentuk poin|daftar poin/i.test(q)) {
      format = 'list';
      matched.push('Format list');
    } else if (/buat paragraf|dalam bentuk paragraf|jelaskan dalam paragraf|narasikan|dalam paragraf/i.test(q)) {
      format = 'paragraph';
      matched.push('Format paragraf');
    }
  }

  // 3. Deteksi Panjang / Kepadatan
  // 3a. Singkat / Padat
  if (
    /\b(?:singkat|padat|ringkas|perpendek|to the point|intinya aja|simpel|short|shorter|concise|brief|briefly|tl;?dr)\b/i.test(q) ||
    /jangan panjang-panjang|keep it short/i.test(q)
  ) {
    lengthModifier = 'short';
    matched.push('Gaya singkat / padat');
  } else if (
    // 3b. Lebih panjang / detail
    /\b(?:lebih panjang|lebih detail|lebih lengkap|perpanjang|jelaskan lebih dalam|elaborasi|bahas lebih rinci|longer|more detail|more detailed|elaborate|expand|in depth|go deeper)\b/i.test(q)
  ) {
    lengthModifier = 'long';
    matched.push('Gaya lebih detail / mendalam');
  }

  // 4. Deteksi Kejelasan / Bahasa Awam (3c: "jelas", "gampang dipahami", "clear", dll)
  if (
    /\b(?:jelas|sejelas-jelasnya|gampang dipahami|mudah dipahami|sederhanakan|bahasa awam|clear|simple terms|explain simply|make it clear|eli5)\b/i.test(q)
  ) {
    clarityModifier = true;
    matched.push('Bahasa sederhana dan mudah dipahami');
  }

  // 5. Deteksi Kesimpulan di Akhir
  if (/(?:buat|sertakan|tambahkan)\s+kesimpulan(?:\s+di\s+akhir)?|kesimpulan di akhir/i.test(q)) {
    summaryAtEnd = true;
    matched.push('Sertakan kesimpulan di akhir');
  }

  // Jika tidak ada satu pun instruksi format/panjang/kejelasan dari pengguna
  // (Aturan 5a: Default Fallback - tidak ada trigger)
  if (!format && !count && !lengthModifier && !clarityModifier && !summaryAtEnd && !noBullets) {
    return null;
  }

  return {
    format,
    count,
    lengthModifier,
    clarityModifier,
    summaryAtEnd,
    noBullets,
    rawMatched: matched,
  };
}

/**
 * Menghasilkan blok instruksi prompt yang tegas dan presisi untuk LLM
 * ketika pengguna meminta format khusus sesuai Pertanyaan.md.
 */
export function formatInstructionPrompt(inst: FormattingInstruction): string {
  const lines: string[] = [
    '=== INSTRUKSI FORMAT KHUSUS DARI PENGGUNA (WAJIB DIPATUHI SECARA PRESISI - OVERRIDE GAYA DEFAULT) ===',
  ];

  if (inst.count && inst.format === 'list') {
    lines.push(`• JUMLAH & FORMAT: Buat jawaban dalam TEPAT ${inst.count} POIN LIST. Jumlah poin WAJIB PERSIS ${inst.count}, tidak boleh kurang dan tidak boleh lebih.`);
  } else if (inst.count && inst.format === 'paragraph') {
    lines.push(`• JUMLAH & FORMAT: Buat jawaban dalam TEPAT ${inst.count} PARAGRAF. Jumlah paragraf WAJIB PERSIS ${inst.count}, pisahkan antar paragraf dengan baris kosong.`);
  } else if (inst.format === 'list') {
    lines.push('• FORMAT: Tampilkan jawaban dalam bentuk DAFTAR POIN (LIST).');
  } else if (inst.format === 'paragraph' || inst.noBullets) {
    lines.push('• FORMAT: Tuliskan jawaban dalam bentuk NARASI PARAGRAF BIASA. DILARANG menggunakan tanda bullet (•, -, *) atau angka bernomor.');
  } else if (inst.format === 'table') {
    lines.push('• FORMAT: Tampilkan jawaban dalam bentuk TABEL MARKDOWN lengkap dengan header kolom yang rapi.');
  } else if (inst.format === 'steps') {
    lines.push('• FORMAT: Tampilkan urutan proses langkah demi langkah menggunakan penomoran berurutan (1., 2., 3., dst).');
  } else if (inst.format === 'comparison') {
    lines.push('• FORMAT: Sajikan dalam format PERBANDINGAN yang jelas (bisa dalam tabel perbandingan atau perbandingan per poin).');
  } else if (inst.format === 'code') {
    lines.push('• FORMAT: Tampilkan contoh kode dalam blok kode markdown (```language ... ```).');
  }

  if (inst.lengthModifier === 'short') {
    lines.push('• KEPADATAN/PANJANG: Buat jawaban SINGKAT, PADAT, dan TO THE POINT. Hilangkan basa-basi atau penjelasan bertele-tele, langsung ke poin inti.');
  } else if (inst.lengthModifier === 'long') {
    lines.push('• KEPADATAN/PANJANG: Berikan penjelasan yang MENDALAM, ELABORATIF, dan LEBIH LENGKAP dengan rincian konteks yang luas dari dokumen.');
  }

  if (inst.clarityModifier) {
    lines.push('• KEJELASAN: Gunakan bahasa yang SEDERHANA, JELAS, dan MUDAH DIPAHAMI oleh orang awam (hindari atau jelaskan istilah teknis yang rumit).');
  }

  if (inst.summaryAtEnd) {
    lines.push('• KESIMPULAN: Tambahkan bagian ringkasan/kesimpulan singkat di baris paling akhir jawaban.');
  }

  lines.push('• PRIORITAS: Aturan format khusus di atas WAJIB MENGGANTIKAN (OVERRIDE) struktur sub-bagian standar.');
  lines.push('• ATURAN ANTI-HALUSINASI TETAP BERLAKU: Jika informasi tidak ditemukan di dokumen, JANGAN mengarang poin palsu! Tetap nyatakan jujur bahwa data tidak ditemukan.');
  lines.push('===============================================================================================');

  return lines.join('\n');
}
