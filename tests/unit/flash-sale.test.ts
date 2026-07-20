import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  flashPrice,
  isFlashSaleLive,
  MAX_FLASH_DISCOUNT_PERCENT,
  MAX_FLASH_SALE_ITEMS,
  secondsRemaining,
} from '@/lib/flash-sale';

import { flashSaleService } from '@/server/services/flash-sale.service';

/** The charging function, unwrapped to a plain number for comparison. */
const charged = (price: number, percent: number) =>
  flashSaleService.applyToPrice(new Prisma.Decimal(price), percent).toNumber();

describe('flashPrice', () => {
  it('applies a whole-percent discount', () => {
    expect(flashPrice(4200, 30)).toBe(2940);
    expect(flashPrice(1000, 50)).toBe(500);
    expect(flashPrice(8900, 15)).toBe(7565);
  });

  it('keeps paisa-level precision without float drift', () => {
    expect(flashPrice(1999.99, 25)).toBe(1499.99);
    expect(flashPrice(0.1 + 0.2, 10)).toBeCloseTo(0.27, 2);
  });

  it('refuses out-of-range percentages rather than corrupting the price', () => {
    expect(flashPrice(1000, 0)).toBe(1000);
    expect(flashPrice(1000, -20)).toBe(1000);
    expect(flashPrice(1000, MAX_FLASH_DISCOUNT_PERCENT + 1)).toBe(1000);
    expect(flashPrice(1000, Number.NaN)).toBe(1000);
  });

  it('never returns a negative or inflated price across the valid range', () => {
    for (let percent = 1; percent <= MAX_FLASH_DISCOUNT_PERCENT; percent++) {
      const result = flashPrice(3499, percent);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(3499);
    }
  });
});

describe('display and charge parity', () => {
  // The whole feature rests on this: what the homepage shows is what checkout
  // bills. `flashPrice` (float, client) and `applyToPrice` (Decimal, server)
  // are separate implementations and must never disagree.
  it('matches across a broad sweep of prices and percentages', () => {
    const prices = [99, 349, 1000, 1999.99, 2450.5, 3499, 8900, 12345.67, 99999.99];
    for (const price of prices) {
      for (let percent = 1; percent <= MAX_FLASH_DISCOUNT_PERCENT; percent++) {
        expect(charged(price, percent)).toBe(flashPrice(price, percent));
      }
    }
  });

  it('leaves the price untouched for an out-of-range percent, like the client', () => {
    expect(charged(1000, 0)).toBe(1000);
    expect(charged(1000, MAX_FLASH_DISCOUNT_PERCENT + 1)).toBe(1000);
    // A fractional percent can't come from the schema (Int column) but could
    // arrive from a hand-rolled payload — it must not silently half-apply.
    expect(charged(1000, 12.5)).toBe(1000);
  });
});

describe('isFlashSaleLive', () => {
  const window = {
    startsAt: '2026-07-20T10:00:00.000Z',
    endsAt: '2026-07-20T18:00:00.000Z',
    isActive: true,
  };

  it('is live inside the window', () => {
    expect(isFlashSaleLive(window, new Date('2026-07-20T14:00:00.000Z'))).toBe(true);
  });

  it('includes the start instant and excludes the end instant', () => {
    expect(isFlashSaleLive(window, new Date('2026-07-20T10:00:00.000Z'))).toBe(true);
    // Exclusive end — the discount stops exactly when the countdown does.
    expect(isFlashSaleLive(window, new Date('2026-07-20T18:00:00.000Z'))).toBe(false);
  });

  it('is dead outside the window and whenever inactive', () => {
    expect(isFlashSaleLive(window, new Date('2026-07-20T09:59:59.000Z'))).toBe(false);
    expect(isFlashSaleLive(window, new Date('2026-07-21T00:00:00.000Z'))).toBe(false);
    expect(
      isFlashSaleLive({ ...window, isActive: false }, new Date('2026-07-20T14:00:00.000Z')),
    ).toBe(false);
  });
});

describe('secondsRemaining', () => {
  it('counts down and floors at zero', () => {
    const end = '2026-07-20T18:00:00.000Z';
    expect(secondsRemaining(end, new Date('2026-07-20T17:59:00.000Z'))).toBe(60);
    expect(secondsRemaining(end, new Date('2026-07-20T18:00:00.000Z'))).toBe(0);
    // Never negative — a stale ISR render must not produce a growing clock.
    expect(secondsRemaining(end, new Date('2026-07-21T00:00:00.000Z'))).toBe(0);
  });
});

describe('item cap', () => {
  it('is the 16 the homepage grid is built around', () => {
    expect(MAX_FLASH_SALE_ITEMS).toBe(16);
  });
});
