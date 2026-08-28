import { describe, expect, it } from 'vitest';

import {
  cheapestShippingFrom,
  computeCheckoutTotals,
  FREE_SHIPPING_THRESHOLD,
} from '@/lib/shipping';

describe('shipping totals', () => {
  it('charges Rs 200 for Karachi with no extra tax', () => {
    const totals = computeCheckoutTotals({
      subtotal: 1000,
      city: 'Karachi',
      quantity: 1,
      paymentMethod: 'COD',
    });

    expect(totals.zone).toBe('within_city');
    expect(totals.shippingFee).toBe(200);
    expect(totals.gst).toBe(0);
    expect(totals.codTax).toBe(0);
    expect(totals.taxAmount).toBe(0);
    expect(totals.total).toBe(1200);
  });

  it('charges Rs 220 outside Sindh with no extra tax', () => {
    const totals = computeCheckoutTotals({
      subtotal: 1000,
      city: 'Gilgit',
      quantity: 1,
      paymentMethod: 'COD',
    });

    expect(totals.zone).toBe('province_to_province');
    expect(totals.shippingFee).toBe(220);
    expect(totals.gst).toBe(0);
    expect(totals.codTax).toBe(0);
    expect(totals.taxAmount).toBe(0);
    expect(totals.total).toBe(1220);
  });

  it('charges Rs 220 for Sindh cities outside Karachi', () => {
    const totals = computeCheckoutTotals({
      subtotal: 1000,
      city: 'Hyderabad',
      quantity: 2,
      paymentMethod: 'CARD',
    });

    expect(totals.zone).toBe('same_province');
    expect(totals.shippingFee).toBe(220);
    expect(totals.gst).toBe(0);
    expect(totals.codTax).toBe(0);
    expect(totals.taxAmount).toBe(0);
    expect(totals.total).toBe(1220);
  });

  it('keeps the free shipping threshold with no extra tax', () => {
    const totals = computeCheckoutTotals({
      subtotal: FREE_SHIPPING_THRESHOLD,
      city: 'Gilgit',
      quantity: 1,
      paymentMethod: 'COD',
    });

    expect(totals.freeShipping).toBe(true);
    expect(totals.shippingFee).toBe(0);
    expect(totals.gst).toBe(0);
    expect(totals.codTax).toBe(0);
    expect(totals.taxAmount).toBe(0);
    expect(totals.total).toBe(8000);
  });

  it('shows Karachi as the starting shipping rate', () => {
    expect(cheapestShippingFrom()).toBe(200);
  });
});
