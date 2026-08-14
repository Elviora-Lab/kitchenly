import { describe, expect, it } from 'vitest';

import { normalizeCurrencyCode } from '@/lib/currency';

describe('normalizeCurrencyCode', () => {
  it('keeps valid ISO currency codes uppercase', () => {
    expect(normalizeCurrencyCode('PKR')).toBe('PKR');
    expect(normalizeCurrencyCode('usd')).toBe('USD');
    expect(normalizeCurrencyCode(' eur ')).toBe('EUR');
  });

  it('falls back to PKR for empty or invalid values', () => {
    expect(normalizeCurrencyCode(undefined)).toBe('PKR');
    expect(normalizeCurrencyCode('')).toBe('PKR');
    expect(normalizeCurrencyCode('Rs.')).toBe('PKR');
    expect(normalizeCurrencyCode('ABC')).toBe('PKR');
  });
});
