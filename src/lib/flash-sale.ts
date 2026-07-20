/**
 * Flash sale — pure, client-safe rules shared by the storefront and the server.
 *
 * Same contract as `@/lib/promotions` and `@/lib/shipping`: the client renders
 * prices with these helpers and the server charges with them, so the two can
 * never disagree. The authoritative money path uses the Decimal twin in
 * `@/server/services/flash-sale.service` — keep the rounding rules identical.
 *
 * The discount is a whole percent off each VARIANT price, not an absolute
 * price, because a product can have several variants at different prices and
 * one absolute figure would be wrong for all but one of them.
 */

/** Hard cap on curated products in a single sale. Enforced server-side. */
export const MAX_FLASH_SALE_ITEMS = 16;

export const MIN_FLASH_DISCOUNT_PERCENT = 1;
export const MAX_FLASH_DISCOUNT_PERCENT = 90;

/**
 * Sale price for a base price, rounded to 2dp (matching Decimal(12,2) columns).
 * Returns the base price unchanged for an out-of-range percent, so a bad value
 * can never inflate a price or drive it negative.
 */
export function flashPrice(basePrice: number, discountPercent: number): number {
  if (
    !Number.isFinite(basePrice) ||
    basePrice <= 0 ||
    !Number.isFinite(discountPercent) ||
    discountPercent < MIN_FLASH_DISCOUNT_PERCENT ||
    discountPercent > MAX_FLASH_DISCOUNT_PERCENT
  ) {
    return basePrice;
  }
  return Math.round(basePrice * (100 - discountPercent)) / 100;
}

export type FlashSaleWindow = { startsAt: Date | string; endsAt: Date | string; isActive: boolean };

/**
 * Is the sale selling right now? Start is inclusive, end exclusive — so a sale
 * ending at 18:00 stops discounting exactly at 18:00, matching the countdown.
 */
export function isFlashSaleLive(sale: FlashSaleWindow, now: Date = new Date()): boolean {
  if (!sale.isActive) return false;
  const t = now.getTime();
  return t >= new Date(sale.startsAt).getTime() && t < new Date(sale.endsAt).getTime();
}

/** Whole seconds until the sale ends; 0 once it has. Drives the countdown. */
export function secondsRemaining(endsAt: Date | string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((new Date(endsAt).getTime() - now.getTime()) / 1000));
}
