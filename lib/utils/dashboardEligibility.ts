/**
 * Utility to determine whether an AI response text contains sufficient analytical/quantitative/structured
 * data to warrant generating an interactive dashboard.
 */

export interface DashboardEligibilityResult {
  eligible: boolean;
  score: number;
  reason?: string;
  hasTable: boolean;
  hasMetrics: boolean;
  hasLists: boolean;
}

export function checkDashboardEligibility(text: string | null | undefined): DashboardEligibilityResult {
  if (!text || typeof text !== 'string') {
    return {
      eligible: false,
      score: 0,
      reason: 'Teks kosong',
      hasTable: false,
      hasMetrics: false,
      hasLists: false,
    };
  }

  const trimmed = text.trim();

  // Check for Markdown Table syntax: header + divider + at least one data row
  const tableRegex = /\|[^\n\r]+\|[\r\n]+\|(?:\s*:?-+:?\s*\|)+\s*[\r\n]+\|[^\n\r]+\|/i;
  const hasTable = tableRegex.test(trimmed);

  // 1. Length check: Must be at least 80 characters unless it already contains a structured Markdown table
  if (trimmed.length < 80 && !hasTable) {
    return {
      eligible: false,
      score: 0,
      reason: 'Teks terlalu singkat untuk dijadikan dashboard (minimal 80 karakter).',
      hasTable,
      hasMetrics: false,
      hasLists: false,
    };
  }

  // 2. Negative checks (Common conversational / refusal / error patterns)
  const isGreetingOrCasual =
    /^(halo|hai|selamat (pagi|siang|sore|malam)|terima kasih|sama-sama|apakah ada yang bisa saya bantu)\b/i.test(trimmed) &&
    trimmed.length < 250;

  const isRefusalOrNoData =
    /(maaf,?\s*(saya\s*)?(tidak\s*menemukan|belum\s*dapat|tidak\s*ada|informasi\s*tidak\s*ditemukan)|tidak\s*ditemukan\s*dokumen|basis\s*pengetahuan\s*belum\s*memuat)/i.test(
      trimmed
    ) && trimmed.length < 300;

  if (isGreetingOrCasual || isRefusalOrNoData) {
    return {
      eligible: false,
      score: 0,
      reason: 'Pesan merupakan sapaan percakapan atau penolakan informasi tanpa data kuantitatif.',
      hasTable: false,
      hasMetrics: false,
      hasLists: false,
    };
  }

  let score = 0;

  // 3. Positive indicator A: Markdown Table
  if (hasTable) {
    score += 40; // Table is a strong indicator of structured dashboardable data
  }

  // 4. Positive indicator B: Metrics / Quantitative data
  const percentageMatches = trimmed.match(/\b\d+([.,]\d+)?\s*%/g) || [];
  const currencyMatches = trimmed.match(/\b(rp|idr|\$|€|usd)\s?[\d.,]+/gi) || [];
  const unitNumberMatches =
    trimmed.match(
      /\b\d+([.,]\d+)?\s*(orang|item|unit|dokumen|kasus|anggota|divisi|persen|juta|miliar|ribu|hari|bulan|tahun|kg|gb|mb|kali|transaksi|rekor|profil|user|pengguna)\b/gi
    ) || [];
  const numberCount = (trimmed.match(/\b\d+([.,]\d+)?\b/g) || []).length;

  const hasMetrics =
    percentageMatches.length > 0 ||
    currencyMatches.length > 0 ||
    unitNumberMatches.length > 0 ||
    numberCount >= 3;

  if (percentageMatches.length > 0) score += 20;
  if (currencyMatches.length > 0) score += 20;
  if (unitNumberMatches.length > 0) score += 20;
  if (numberCount >= 3) score += 15;

  // 5. Positive indicator C: Structured Lists (Bullet points / Numbered lists)
  const listMatches = trimmed.match(/(?:^|\n)\s*[-*•\d+[\.)]]\s+[^\n]+/g) || [];
  const hasLists = listMatches.length >= 3;
  if (hasLists) {
    score += Math.min(25, listMatches.length * 5);
  }

  // 6. Positive indicator D: Analytical / Comparative keywords
  const analyticalKeywords =
    /\b(total|rata-rata|rataan|distribusi|pertumbuhan|perbandingan|statistik|persentase|jumlah|terbanyak|tertinggi|terendah|kinerja|akumulasi|rekapitulasi|analisis)\b/gi;
  const keywordMatches = trimmed.match(analyticalKeywords) || [];
  if (keywordMatches.length >= 2) {
    score += 15;
  }

  // Eligibility Threshold:
  // Must score at least 30 points (e.g. Table, or Metrics + Lists, or Currency + Percentage)
  const eligible = score >= 30;

  return {
    eligible,
    score,
    reason: eligible
      ? 'Memuat data kuantitatif atau terstruktur yang layak divisualisasikan'
      : 'Konten tidak memuat cukup metrik, angka, tabel, atau list terstruktur untuk divisualisasikan.',
    hasTable,
    hasMetrics,
    hasLists,
  };
}
