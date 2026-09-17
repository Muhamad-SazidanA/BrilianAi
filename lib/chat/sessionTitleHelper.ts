/**
 * Generate judul sesi dari query pertama user.
 * Maks 50 karakter — jika lebih dipotong dengan ellipsis.
 */
export function generateSessionTitle(firstQuery: string): string {
  const clean = firstQuery.trim().replace(/\s+/g, ' ');
  if (clean.length <= 50) return clean;
  return `${clean.slice(0, 47)}...`;
}
