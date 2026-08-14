export const DEFAULT_CURRENCY = 'PKR';

const ISO_CURRENCY_CODE = /^[A-Z]{3}$/;
const supportedCurrencies =
  (
    Intl as typeof Intl & {
      supportedValuesOf?: (key: 'currency') => string[];
    }
  ).supportedValuesOf?.('currency') ?? null;

export function normalizeCurrencyCode(
  currency: string | null | undefined,
  fallback = DEFAULT_CURRENCY,
): string {
  const code = currency?.trim().toUpperCase();
  if (!code || !ISO_CURRENCY_CODE.test(code)) return fallback;

  return supportedCurrencies?.includes(code) === false ? fallback : code;
}
