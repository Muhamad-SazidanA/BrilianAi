/**
 * Master Divisi Perusahaan Standar (Enterprise Divisions)
 * Digunakan secara sinkron di seluruh form Pengguna, Role, dan Upload Dokumen.
 */
export const ENTERPRISE_DIVISIONS = [
  'General',
  'Direksi',
  'Manajemen Eksekutif',
  'HRD',
  'Legal & Compliance',
  'Keuangan (Finance)',
  'Operasional',
  'IT & Engineering',
  'Marketing & Bisnis',
] as const;

export type EnterpriseDivision = typeof ENTERPRISE_DIVISIONS[number] | string;
