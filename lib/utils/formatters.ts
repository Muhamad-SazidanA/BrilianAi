/**
 * Unified formatting utilities for dates, times, and numbers.
 * Centralizes duplicate formatting logic across the application (DRY principle).
 */

export type SupportedLocale = 'en' | 'id';

/**
 * Format date and time string consistently according to language locale.
 * Default format: "17 Sep 2026, 09:15"
 */
export function formatDateTime(
  dateInput: string | number | Date | null | undefined,
  language: SupportedLocale = 'id',
  customOptions?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '-';

    const locale = language === 'en' ? 'en-US' : 'id-ID';
    const defaultOptions: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };

    return d.toLocaleDateString(locale, customOptions || defaultOptions);
  } catch {
    return String(dateInput);
  }
}

/**
 * Format date only (e.g. "17 Sep 2026" / "Sep 17, 2026").
 */
export function formatDateOnly(
  dateInput: string | number | Date | null | undefined,
  language: SupportedLocale = 'id'
): string {
  return formatDateTime(dateInput, language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format time only (e.g. "09:15").
 */
export function formatTimeOnly(
  dateInput: string | number | Date | null | undefined,
  language: SupportedLocale = 'id'
): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '-';
    const locale = language === 'en' ? 'en-US' : 'id-ID';
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
}

/**
 * Format localized numbers with thousands separators.
 */
export function formatNumber(
  value: number | null | undefined,
  language: SupportedLocale = 'id'
): string {
  if (value === null || value === undefined || isNaN(value)) return '0';
  const locale = language === 'en' ? 'en-US' : 'id-ID';
  return new Intl.NumberFormat(locale).format(value);
}
