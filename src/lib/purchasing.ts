import { Prisma } from '@prisma/client';

/**
 * Costing arithmetic for purchasing. Pure and Decimal-based — money must not
 * round-trip through floats, and these figures feed inventory valuation.
 */

const ONE = new Prisma.Decimal(1);
/** decimal.js rounding mode: half away from zero, i.e. 0.125 → 0.13. */
const HALF_UP = Prisma.Decimal.ROUND_HALF_UP;

export const dec = (value: Prisma.Decimal | number | string) => new Prisma.Decimal(value);

/**
 * Multiplier that spreads a purchase order's shipping, duty and other charges
 * across its lines in proportion to their value.
 *
 * Charges belong to the order, but stock is received a delivery at a time.
 * Scaling each line's cost by a single factor means a partial receipt takes
 * exactly its share, and the charges land in full once everything arrives —
 * no reconciliation step, no charge stranded on the last delivery.
 */
export function landedCostFactor(
  orderedValue: Prisma.Decimal,
  extraCharges: Prisma.Decimal,
): Prisma.Decimal {
  // Nothing to spread charges over — a free order, or one with no lines.
  if (orderedValue.lte(0)) return ONE;
  return ONE.plus(extraCharges.div(orderedValue));
}

/** A line's per-unit cost once its share of the order's charges is included. */
export function unitLandedCost(unitCost: Prisma.Decimal, factor: Prisma.Decimal): Prisma.Decimal {
  return unitCost.mul(factor).toDecimalPlaces(2, HALF_UP);
}

/**
 * Blend newly received units into a variant's average cost.
 *
 * Weighted by quantity, so a small delivery at an unusual price moves the
 * average only slightly. With no stock on hand (or no prior average) the
 * incoming cost simply becomes the new one — averaging against nothing, or
 * against negative stock from an oversell, would produce a nonsense figure.
 */
export function movingAverageCost(
  previousAvg: Prisma.Decimal | null,
  previousQuantity: number,
  incomingCost: Prisma.Decimal,
  incomingQuantity: number,
): Prisma.Decimal {
  if (incomingQuantity <= 0) return previousAvg ?? incomingCost;
  if (!previousAvg || previousQuantity <= 0) return incomingCost.toDecimalPlaces(2, HALF_UP);

  const total = previousAvg.mul(previousQuantity).plus(incomingCost.mul(incomingQuantity));
  return total.div(previousQuantity + incomingQuantity).toDecimalPlaces(2, HALF_UP);
}

/** Total value of what a purchase order asked for, before charges. */
export function orderedValue(
  items: ReadonlyArray<{ quantityOrdered: number; unitCost: Prisma.Decimal }>,
): Prisma.Decimal {
  return items.reduce((sum, item) => sum.plus(item.unitCost.mul(item.quantityOrdered)), dec(0));
}

/** Sum of the charges levied on the order rather than on individual lines. */
export function extraCharges(po: {
  shippingCost: Prisma.Decimal;
  dutyCost: Prisma.Decimal;
  otherCost: Prisma.Decimal;
}): Prisma.Decimal {
  return po.shippingCost.plus(po.dutyCost).plus(po.otherCost);
}

/**
 * Where a purchase order stands once a delivery has been posted. Fully
 * received closes it; anything less leaves it open for the next drop.
 */
export function statusAfterReceipt(
  items: ReadonlyArray<{ quantityOrdered: number; quantityReceived: number }>,
): 'RECEIVED' | 'PARTIALLY_RECEIVED' {
  const complete = items.every((item) => item.quantityReceived >= item.quantityOrdered);
  return complete ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
}
