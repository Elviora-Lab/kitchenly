import { STORE_TIME_ZONE } from '@/utils/time';

/**
 * Pakistani rupees are typically displayed without paisa (cents) in retail.
 * Other currencies retain 2 decimal places by default.
 */
export function formatMoney(amount: number, currency = 'PKR', locale = 'en-PK'): string {
  const isPkr = currency === 'PKR';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: isPkr ? 0 : 2,
    maximumFractionDigits: isPkr ? 0 : 2,
  }).format(amount);
}

export function formatDate(
  value: string | number | Date,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  locale = 'en-PK',
): string {
  const { timeZone = STORE_TIME_ZONE, ...rest } = opts;
  return new Intl.DateTimeFormat(locale, { timeZone, ...rest }).format(new Date(value));
}

export function formatNumber(value: number, locale = 'en-PK'): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function truncate(str: string, max = 80): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + '…';
}
