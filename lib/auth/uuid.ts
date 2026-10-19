/**
 * Checks if a string is a valid UUID (v1-v5) or valid standard alphanumeric identifier.
 * Uses flexible matching to support all standard PostgreSQL UUID variants and legacy IDs.
 */
export function isUuidV4(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  // Standard 36-char hyphenated UUID (v1 to v5)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return true;
  }
  // 32-char hex UUID without hyphens
  if (/^[0-9a-f]{32}$/i.test(trimmed)) {
    return true;
  }
  // URL-safe alphanumeric IDs (8 to 64 chars)
  return /^[a-zA-Z0-9_-]{8,64}$/.test(trimmed);
}

export const isValidChatSessionId = isUuidV4;

