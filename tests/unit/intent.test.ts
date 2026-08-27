import { describe, expect, it } from 'vitest';

import { productIntentScore, productIntentSignal, rate } from '@/lib/analytics/intent';

describe('product intent scoring', () => {
  it('marks proven converting products as scale winners', () => {
    expect(productIntentSignal({ views: 40, carts: 10, purchases: 4 })).toBe('Scale winner');
  });

  it('flags high-view products with weak cart rate as PDP fixes', () => {
    expect(productIntentSignal({ views: 100, carts: 2, purchases: 0 })).toBe('Fix PDP');
  });

  it('flags cart-heavy products with weak order rate as checkout or offer fixes', () => {
    expect(productIntentSignal({ views: 40, carts: 8, purchases: 1 })).toBe('Fix checkout/offer');
  });

  it('keeps rates and scores finite when there is no denominator', () => {
    expect(rate(2, 0)).toBe(0);
    expect(productIntentScore({ views: 0, carts: 0, purchases: 0 })).toBe(0);
  });
});
