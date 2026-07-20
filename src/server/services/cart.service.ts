import 'server-only';

import { prisma } from '@/lib/db';
import { flashPrice } from '@/lib/flash-sale';

import { events } from '@/server/events';
import { BadRequestError, NotFoundError } from '@/server/http/errors';
import { cartRepo } from '@/server/repositories/cart.repo';
import { flashSaleService } from '@/server/services/flash-sale.service';

export const cartService = {
  async getCart(opts: { userId: string | null; sessionId: string }) {
    const cart = await cartRepo.findOrCreate({
      userId: opts.userId ?? undefined,
      sessionId: opts.sessionId,
    });
    return serializeCart(cart);
  },

  async addLine(
    opts: { userId: string | null; sessionId: string },
    payload: { variantId: string; quantity: number },
  ) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: payload.variantId },
      include: { product: true },
    });
    if (!variant || !variant.isActive) throw new NotFoundError('Variant not found');

    const cart = await cartRepo.findOrCreate({
      userId: opts.userId ?? undefined,
      sessionId: opts.sessionId,
    });

    const existing = cart.items.find(
      (i) => i.variantId === payload.variantId && i.productId === variant.productId,
    );
    const totalQuantity = (existing?.quantity ?? 0) + payload.quantity;
    if (variant.stockQuantity < totalQuantity) {
      throw new BadRequestError('Requested quantity exceeds stock');
    }

    // Snapshot the flash-sale price if a sale is running. This is only the
    // price the shopper SEES in the cart — checkout re-derives it from scratch
    // (`ordersService.createFromCart`), so a sale that starts or ends while the
    // item sits in the cart still bills correctly.
    const unitPrice = await flashSaleService.priceForVariant(variant.productId, variant.price);

    await cartRepo.upsertLine(cart.id, {
      productId: variant.productId,
      variantId: variant.id,
      quantity: payload.quantity,
      price: unitPrice.toNumber(),
    });

    events.emit('cart.line.added', {
      userId: opts.userId,
      productId: variant.productId,
      variantId: variant.id,
    });

    const refreshed = await cartRepo.findById(cart.id);
    return refreshed ? serializeCart(refreshed) : null;
  },

  async updateLineQuantity(
    opts: { userId: string | null; sessionId: string },
    payload: { lineId: string; quantity: number },
  ) {
    const cart = await cartRepo.findOrCreate({
      userId: opts.userId ?? undefined,
      sessionId: opts.sessionId,
    });

    // Re-validate stock on quantity increase — `addLine` checks stock, but the
    // line could otherwise be bumped to any quantity here, bypassing that gate.
    const line = cart.items.find((i) => i.id === payload.lineId);
    if (!line) throw new NotFoundError('Cart line not found');
    if (payload.quantity > 0 && line.variantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: line.variantId },
        select: { stockQuantity: true, isActive: true },
      });
      if (!variant || !variant.isActive) throw new NotFoundError('Variant not found');
      if (variant.stockQuantity < payload.quantity) {
        throw new BadRequestError('Requested quantity exceeds stock');
      }
    }

    const affected = await cartRepo.updateLineQuantity(cart.id, payload.lineId, payload.quantity);
    if (affected === 0) throw new NotFoundError('Cart line not found');

    const refreshed = await cartRepo.findById(cart.id);
    return refreshed ? serializeCart(refreshed) : null;
  },

  async removeLine(opts: { userId: string | null; sessionId: string }, lineId: string) {
    const cart = await cartRepo.findOrCreate({
      userId: opts.userId ?? undefined,
      sessionId: opts.sessionId,
    });
    const affected = await cartRepo.removeLine(cart.id, lineId);
    if (affected === 0) throw new NotFoundError('Cart line not found');

    const refreshed = await cartRepo.findById(cart.id);
    return refreshed ? serializeCart(refreshed) : null;
  },
};

/**
 * Shape the cart for the client.
 *
 * Line prices are RE-DERIVED from the live variant price and the live flash
 * sale — deliberately not read from the `cart_items.price` snapshot. That
 * snapshot is written once at add-to-cart, but checkout recomputes prices
 * inside its transaction (`ordersService.createFromCart`), so displaying the
 * snapshot would show a shopper one number and bill another whenever a sale
 * starts or ends while the item sits in their bag.
 *
 * Async because the sale lookup is a DB read; every caller already awaits.
 */
async function serializeCart(cart: Awaited<ReturnType<typeof cartRepo.findOrCreate>>) {
  const flashDiscounts = await flashSaleService.discountsForProducts(
    cart.items.map((item) => item.productId),
  );

  const lines = cart.items.map((item) => {
    // Fall back to the snapshot only when the variant is gone (a deleted
    // variant leaves the line orphaned rather than mispriced).
    const base = item.variant ? Number(item.variant.price) : Number(item.price);
    const percent = flashDiscounts.get(item.productId);
    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      slug: item.product.slug,
      name: item.product.name,
      imageUrl: item.product.images[0]?.imageUrl ?? '',
      unitPrice: percent === undefined ? base : flashPrice(base, percent),
      /** Pre-sale price, set only when this line is discounted right now. */
      originalPrice: percent === undefined ? undefined : base,
      quantity: item.quantity,
      currency: 'PKR',
    };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  // Sale metadata for the cart/checkout countdown — only when a line is
  // actually discounted, so an unrelated sale doesn't put a clock on the page.
  const summary = flashDiscounts.size > 0 ? await flashSaleService.liveSummary() : null;

  return {
    id: cart.id,
    lines,
    subtotal,
    discountTotal: 0,
    shippingTotal: 0,
    taxTotal: 0,
    total: subtotal,
    currency: 'PKR',
    couponCode: null as string | null,
    flashSale: summary ? { title: summary.title, endsAt: summary.endsAt } : null,
  };
}
