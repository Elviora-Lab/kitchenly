import 'server-only';

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import {
  flashPrice,
  MAX_FLASH_DISCOUNT_PERCENT,
  MIN_FLASH_DISCOUNT_PERCENT,
} from '@/lib/flash-sale';

import type { ProductCardData } from '@/design-system/patterns/product-card';

import { cache } from '@/server/cache';
import { flashSaleRepo } from '@/server/repositories/flash-sale.repo';

/**
 * Flash sale — server source of truth.
 *
 * Two distinct read paths, and the distinction matters:
 *
 * - **Display** (`liveForDisplay`) is cached. A few seconds of staleness on the
 *   homepage is harmless.
 * - **Money** (`discountsForProducts` / `applyToPrice`) is NEVER cached and is
 *   read through the caller's transaction client. A stale discount here would
 *   mis-charge a customer, so it always hits the DB.
 */

const DISPLAY_CACHE_KEY = 'flash-sale:live:display';
/** Short TTL: the section must disappear promptly when the window closes. */
const DISPLAY_TTL_SECONDS = 60;

export type FlashSaleProduct = ProductCardData & {
  /** Whole-percent discount, for the "-30%" badge. */
  discountPercent: number;
  /** True when every active variant is out of stock. */
  soldOut: boolean;
};

export type LiveFlashSale = {
  id: string;
  title: string;
  /** ISO strings — the client ticks the countdown against an absolute instant. */
  startsAt: string;
  endsAt: string;
  products: FlashSaleProduct[];
};

/**
 * The live sale reduced to "which products, at what percent, until when" —
 * everything a surface outside the homepage needs (PDP, cart, checkout) without
 * carrying 16 products' worth of card data.
 */
export type FlashSaleSummary = {
  title: string;
  endsAt: string;
  /** productId → whole-percent discount. */
  discounts: Record<string, number>;
};

export const flashSaleService = {
  /**
   * The live sale shaped for the homepage, or null. Cached; safe to call from a
   * server component on every render.
   */
  liveForDisplay(): Promise<LiveFlashSale | null> {
    return cache.wrap(DISPLAY_CACHE_KEY, DISPLAY_TTL_SECONDS, async () => {
      const sale = await flashSaleRepo.findLive();
      if (!sale || sale.items.length === 0) return null;

      const products = sale.items.map((item) => {
        const { product } = item;
        // Base the shown price on the cheapest active variant — that's what a
        // shopper can actually buy. Product.price is a display/master price and
        // is documented to drift from the chargeable variant price.
        const base =
          product.variants.length > 0
            ? Math.min(...product.variants.map((v) => Number(v.price)))
            : Number(product.price);

        return {
          id: product.id,
          slug: product.slug,
          name: product.name,
          imageUrl: product.images[0]?.imageUrl ?? '',
          hoverImageUrl: product.images[1]?.imageUrl ?? undefined,
          price: flashPrice(base, item.discountPercent),
          compareAt: base,
          currency: 'PKR',
          discountPercent: item.discountPercent,
          soldOut:
            product.variants.length > 0 && product.variants.every((v) => v.stockQuantity <= 0),
        } satisfies FlashSaleProduct;
      });

      return {
        id: sale.id,
        title: sale.title,
        startsAt: sale.startsAt.toISOString(),
        endsAt: sale.endsAt.toISOString(),
        products,
      };
    });
  },

  /**
   * Lightweight live-sale summary for the PDP, cart and checkout. Shares the
   * homepage's cache entry, so adding it costs no extra query.
   *
   * Display-only, like `liveForDisplay` — the charged price is still re-derived
   * inside the checkout transaction.
   */
  async liveSummary(): Promise<FlashSaleSummary | null> {
    const sale = await this.liveForDisplay();
    if (!sale) return null;
    return {
      title: sale.title,
      endsAt: sale.endsAt,
      discounts: Object.fromEntries(sale.products.map((p) => [p.id, p.discountPercent])),
    };
  },

  /** Drop the cached storefront sale after an admin edit. */
  invalidateDisplay(): Promise<void> {
    return cache.delete(DISPLAY_CACHE_KEY);
  },

  /**
   * Authoritative discount percent per product id for the sale running *now*.
   * Uncached by design. Pass the transaction client at checkout so the read
   * sees the same snapshot as the rest of the order.
   */
  discountsForProducts(
    productIds: string[],
    db: Prisma.TransactionClient = prisma,
    now: Date = new Date(),
  ): Promise<Map<string, number>> {
    return flashSaleRepo.liveDiscountsByProduct(productIds, now, db);
  },

  /**
   * Apply a discount to a chargeable price. Mirrors `flashPrice` in
   * `@/lib/flash-sale` exactly — multiply, round the integer product half-up,
   * then scale down — so the price a shopper is quoted is the price charged.
   * An out-of-range percent returns the price untouched.
   */
  applyToPrice(price: Prisma.Decimal | number | string, discountPercent: number): Prisma.Decimal {
    const base = new Prisma.Decimal(price);
    if (
      !Number.isInteger(discountPercent) ||
      discountPercent < MIN_FLASH_DISCOUNT_PERCENT ||
      discountPercent > MAX_FLASH_DISCOUNT_PERCENT ||
      base.lessThanOrEqualTo(0)
    ) {
      return base;
    }
    return base
      .mul(100 - discountPercent)
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
      .div(100);
  },

  /**
   * Effective unit price for a single variant right now — the helper the cart
   * add-path uses. Returns the variant price unchanged when no sale applies.
   */
  async priceForVariant(
    productId: string,
    variantPrice: Prisma.Decimal | number | string,
    db: Prisma.TransactionClient = prisma,
  ): Promise<Prisma.Decimal> {
    const discounts = await this.discountsForProducts([productId], db);
    const percent = discounts.get(productId);
    return percent === undefined
      ? new Prisma.Decimal(variantPrice)
      : this.applyToPrice(variantPrice, percent);
  },
};
