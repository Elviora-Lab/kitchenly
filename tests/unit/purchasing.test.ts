import { type Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  dec,
  extraCharges,
  landedCostFactor,
  movingAverageCost,
  orderedValue,
  statusAfterReceipt,
  unitLandedCost,
} from '@/lib/purchasing';

const n = (d: Prisma.Decimal) => d.toNumber();

describe('landedCostFactor', () => {
  it('spreads charges in proportion to order value', () => {
    // 1,000 of shipping on a 5,000 order is 20% on top of every line.
    expect(n(landedCostFactor(dec(5000), dec(1000)))).toBe(1.2);
  });

  it('is a no-op when there are no charges', () => {
    expect(n(landedCostFactor(dec(5000), dec(0)))).toBe(1);
  });

  it('refuses to divide by an empty order', () => {
    expect(n(landedCostFactor(dec(0), dec(1000)))).toBe(1);
    expect(n(landedCostFactor(dec(-5), dec(1000)))).toBe(1);
  });
});

describe('unitLandedCost', () => {
  it('applies the factor and rounds to paisa', () => {
    const factor = landedCostFactor(dec(5000), dec(1000));
    expect(n(unitLandedCost(dec(100), factor))).toBe(120);
    expect(n(unitLandedCost(dec(400), factor))).toBe(480);
  });

  it('rounds half up rather than truncating', () => {
    // 33.333...% on 1.00 → 1.3333 → 1.33; on 3.00 → 4.00 exactly.
    const factor = landedCostFactor(dec(300), dec(100));
    expect(n(unitLandedCost(dec(1), factor))).toBe(1.33);
    expect(n(unitLandedCost(dec(3), factor))).toBe(4);
  });

  it('keeps precision that a float would lose', () => {
    const factor = landedCostFactor(dec(3), dec(0.6));
    expect(n(unitLandedCost(dec(0.1), factor))).toBe(0.12);
  });
});

describe('charges and order value', () => {
  it('totals the three order-level charges', () => {
    expect(
      n(extraCharges({ shippingCost: dec(500), dutyCost: dec(250.5), otherCost: dec(0) })),
    ).toBe(750.5);
  });

  it('values an order by quantity times unit cost', () => {
    expect(
      n(
        orderedValue([
          { quantityOrdered: 10, unitCost: dec(100) },
          { quantityOrdered: 10, unitCost: dec(400) },
        ]),
      ),
    ).toBe(5000);
  });

  it('values an empty order at zero', () => {
    expect(n(orderedValue([]))).toBe(0);
  });
});

describe('movingAverageCost', () => {
  it('weights the old and new stock by quantity', () => {
    // 10 units at 100 plus 10 at 200 averages 150.
    expect(n(movingAverageCost(dec(100), 10, dec(200), 10))).toBe(150);
    // 90 at 100 plus 10 at 200 barely moves it.
    expect(n(movingAverageCost(dec(100), 90, dec(200), 10))).toBe(110);
  });

  it('adopts the incoming cost when there is nothing to average against', () => {
    expect(n(movingAverageCost(null, 0, dec(250), 10))).toBe(250);
    expect(n(movingAverageCost(null, 50, dec(250), 10))).toBe(250);
    expect(n(movingAverageCost(dec(100), 0, dec(250), 10))).toBe(250);
  });

  it('ignores negative stock rather than producing a nonsense average', () => {
    // Oversold to -5 somehow; averaging against it would distort the cost.
    expect(n(movingAverageCost(dec(100), -5, dec(250), 10))).toBe(250);
  });

  it('leaves the average alone when nothing arrives', () => {
    expect(n(movingAverageCost(dec(100), 10, dec(250), 0))).toBe(100);
  });

  it('rounds to paisa', () => {
    // (100*1 + 175*2) / 3 = 150.
    expect(n(movingAverageCost(dec(100), 1, dec(175), 2))).toBe(150);
    // (100*1 + 101*2) / 3 = 100.666… → 100.67
    expect(n(movingAverageCost(dec(100), 1, dec(101), 2))).toBe(100.67);
  });
});

describe('statusAfterReceipt', () => {
  it('closes the order once every line is complete', () => {
    expect(
      statusAfterReceipt([
        { quantityOrdered: 10, quantityReceived: 10 },
        { quantityOrdered: 5, quantityReceived: 5 },
      ]),
    ).toBe('RECEIVED');
  });

  it('stays open while any line is outstanding', () => {
    expect(
      statusAfterReceipt([
        { quantityOrdered: 10, quantityReceived: 10 },
        { quantityOrdered: 5, quantityReceived: 4 },
      ]),
    ).toBe('PARTIALLY_RECEIVED');
  });
});
