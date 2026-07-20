import 'server-only';

import { type PaymentMethod, Prisma } from '@prisma/client';
import { customAlphabet } from 'nanoid';

import { prisma } from '@/lib/db';
import { computeCheckoutTotals } from '@/lib/shipping';

import { events } from '@/server/events';
import { BadRequestError, NotFoundError } from '@/server/http/errors';
import { cartRepo } from '@/server/repositories/cart.repo';
import { ordersRepo } from '@/server/repositories/orders.repo';
import { couponsService } from '@/server/services/coupons.service';
import { flashSaleService } from '@/server/services/flash-sale.service';
import { promotionsService } from '@/server/services/promotions.service';

const orderNumberAlphabet = customAlphabet('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 8);
const newOrderNumber = () => `ELV-${new Date().getFullYear()}-${orderNumberAlphabet()}`;

export const ordersService = {
  async listForUser(userId: string, page: number, pageSize: number) {
    const [items, total] = await ordersRepo.listForUser(userId, (page - 1) * pageSize, pageSize);
    return { items, total };
  },

  async getDetail(orderId: string, userId: string) {
    const order = await ordersRepo.findByIdForUser(orderId, userId);
    if (!order) throw new NotFoundError('Order not found');
    return order;
  },

  /** Guest-safe confirmation fetch — the order id is an unguessable UUID. */
  async getById(orderId: string) {
    const order = await ordersRepo.findById(orderId);
    if (!order) throw new NotFoundError('Order not found');
    return order;
  },

  /**
   * Create an order from a cart. Runs inside a single transaction so the cart
   * is cleared atomically with order creation — no risk of double-charge.
   * The shipping address is denormalized onto the order so the order remains
   * printable even if the customer later edits the source UserAddress.
   */
  async createFromCart(opts: {
    /** Null for a guest checkout. */
    userId: string | null;
    /** Guest cart owner — required to verify ownership when there's no userId. */
    sessionId?: string | null;
    cartId: string;
    /** Guest contact email (optional); used for the order-confirmation email. */
    email?: string | null;
    shippingAddress: {
      fullName: string;
      phone: string | null;
      country: string;
      city: string;
      area: string | null;
      addressLine1: string;
      addressLine2: string | null;
      postalCode: string | null;
    };
    currency?: string;
    notes?: string;
    couponCode?: string;
    /** Chosen payment method — COD adds the 4% COD tax. */
    paymentMethod: PaymentMethod;
    /** Last-touch marketing attribution captured at checkout (elv_utm cookie). */
    utm?: { source?: string | null; medium?: string | null; campaign?: string | null };
  }) {
    const runCheckoutTransaction = () =>
      prisma.$transaction(async (tx) => {
        // Lock the cart row first so concurrent checkout requests serialize.
        // The lock is acquired by the update; the second request blocks until the
        // first commits, at which point the cart items have already been deleted
        // and the second request sees an empty cart.
        const cart = await tx.cart.update({
          where: { id: opts.cartId },
          data: { updatedAt: new Date() },
          include: { items: { include: { product: true, variant: true } } },
        });
        if (!cart) throw new NotFoundError('Cart not found');
        // Ownership: a logged-in user owns by userId; a guest owns by sessionId.
        const owns = opts.userId
          ? cart.userId === opts.userId
          : Boolean(opts.sessionId) && cart.sessionId === opts.sessionId;
        if (!owns) throw new NotFoundError('Cart not found');
        if (cart.items.length === 0) throw new BadRequestError('Cart is empty');

        const currency = opts.currency ?? 'PKR';

        // Re-derive every line price from the live catalog + flash sale INSIDE
        // the transaction. `cart_items.price` is only a snapshot taken at
        // add-to-cart, and carts are long-lived (see cart-recovery.service), so
        // trusting it would charge the sale price after the sale ended and the
        // full price for an item added before it started. The variant price is
        // the chargeable one; Product.price is display-only.
        const flashDiscounts = await flashSaleService.discountsForProducts(
          cart.items.map((item) => item.productId),
          tx,
        );
        const linePrices = new Map<string, Prisma.Decimal>();
        for (const item of cart.items) {
          const base = item.variant
            ? new Prisma.Decimal(item.variant.price)
            : new Prisma.Decimal(item.price);
          const percent = flashDiscounts.get(item.productId);
          linePrices.set(
            item.id,
            percent === undefined ? base : flashSaleService.applyToPrice(base, percent),
          );
        }
        const priceFor = (itemId: string) => linePrices.get(itemId) ?? new Prisma.Decimal(0);

        // Accumulate money with Prisma.Decimal — never JS floats — so the stored
        // totals exactly match the sum of line prices.
        const subtotal = cart.items.reduce(
          (sum, item) => sum.add(priceFor(item.id).mul(item.quantity)),
          new Prisma.Decimal(0),
        );

        // Evaluate the coupon (if any) against the subtotal. Validation throws
        // a 400; the usage count is incremented atomically further below.
        let couponDiscount = new Prisma.Decimal(0);
        let appliedCoupon: { id: string; code: string } | null = null;
        if (opts.couponCode) {
          const evaluation = await couponsService.evaluate(opts.couponCode, subtotal, tx);
          couponDiscount = evaluation.discount;
          appliedCoupon = { id: evaluation.coupon.id, code: evaluation.coupon.code };
        }

        // Automatic "Spend & Save" tier discount for this subtotal, then apply
        // BEST-SINGLE-WINS: the larger of the tier vs the coupon (never both). A
        // coupon that loses is NOT redeemed, so it stays usable on a later order.
        const spendDiscount = new Prisma.Decimal(
          await promotionsService.computeDiscount(subtotal.toNumber(), tx),
        );
        let discount = new Prisma.Decimal(0);
        let discountLabel: string | null = null;
        if (spendDiscount.greaterThanOrEqualTo(couponDiscount) && spendDiscount.greaterThan(0)) {
          discount = spendDiscount;
          discountLabel = 'Spend & Save';
          appliedCoupon = null;
        } else if (couponDiscount.greaterThan(0)) {
          discount = couponDiscount;
          discountLabel = appliedCoupon?.code ?? null;
        }

        // Shipping + tax from the PostEx rate card. Same helper the checkout UI
        // uses, so the stored charge matches the quoted total exactly.
        const totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        const totals = computeCheckoutTotals({
          subtotal: subtotal.toNumber(),
          discount: discount.toNumber(),
          city: opts.shippingAddress.city,
          quantity: totalQuantity,
          paymentMethod: opts.paymentMethod,
        });
        const shippingFee = new Prisma.Decimal(totals.shippingFee);
        const taxAmount = new Prisma.Decimal(totals.taxAmount);
        const totalAmount = new Prisma.Decimal(totals.total);

        const order = await tx.order.create({
          data: {
            userId: opts.userId,
            orderNumber: newOrderNumber(),
            subtotal,
            shippingFee,
            taxAmount,
            discountAmount: discount,
            discountLabel,
            totalAmount,
            currency,
            notes: opts.notes,
            shippingFullName: opts.shippingAddress.fullName,
            shippingEmail: opts.email ?? null,
            shippingPhone: opts.shippingAddress.phone,
            shippingCountry: opts.shippingAddress.country,
            shippingCity: opts.shippingAddress.city,
            shippingArea: opts.shippingAddress.area,
            shippingAddressLine1: opts.shippingAddress.addressLine1,
            shippingAddressLine2: opts.shippingAddress.addressLine2,
            shippingPostalCode: opts.shippingAddress.postalCode,
            utmSource: opts.utm?.source ?? null,
            utmMedium: opts.utm?.medium ?? null,
            utmCampaign: opts.utm?.campaign ?? null,
            items: {
              create: cart.items.map((item) => ({
                productId: item.productId,
                variantId: item.variantId,
                productName: item.product.name,
                variantName: variantLabel(item.variant),
                quantity: item.quantity,
                unitPrice: priceFor(item.id),
                totalPrice: priceFor(item.id).mul(item.quantity),
              })),
            },
            statusHistory: { create: { status: 'PENDING' } },
          },
          include: { items: true },
        });

        // The PENDING payment row rides the order transaction — an order can
        // never exist without one. Stripe later stamps its PaymentIntent id as
        // transactionId; COD/bank rows are settled by an operator.
        await tx.payment.create({
          data: {
            orderId: order.id,
            paymentMethod: opts.paymentMethod,
            amount: order.totalAmount,
            paymentStatus: 'PENDING',
          },
        });

        // Decrement stock for each variant atomically. The `stockQuantity >=
        // quantity` guard is part of the WHERE clause, so two concurrent
        // checkouts of the last unit cannot both succeed — the loser's
        // updateMany affects 0 rows and we roll the whole transaction back.
        for (const item of cart.items) {
          if (item.variantId) {
            const { count } = await tx.productVariant.updateMany({
              where: { id: item.variantId, stockQuantity: { gte: item.quantity } },
              data: { stockQuantity: { decrement: item.quantity } },
            });
            if (count === 0) {
              throw new BadRequestError(`Insufficient stock for ${item.product.name}`);
            }
          }
        }

        // Redeem the coupon atomically. The column-comparison guard
        // (`used_count < usage_limit`) lives in the WHERE so concurrent
        // redemptions can't exceed the limit — if it affects 0 rows the coupon
        // was exhausted/deactivated between validation and now, and we roll back.
        if (appliedCoupon) {
          const affected = await tx.$executeRaw`
            UPDATE "coupons"
            SET "used_count" = "used_count" + 1
            WHERE "id" = ${appliedCoupon.id}::uuid
              AND "is_active" = true
              AND ("usage_limit" IS NULL OR "used_count" < "usage_limit")`;
          if (affected === 0) {
            throw new BadRequestError('This coupon is no longer available');
          }
          await tx.couponUsage.create({
            data: { couponId: appliedCoupon.id, userId: opts.userId, orderId: order.id },
          });
        }

        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

        return order;
      });

    // Retry on an order-number collision (8 chars over a 32-char alphabet —
    // rare, but material at volume). The whole transaction re-runs with a
    // fresh number; any other error propagates immediately.
    const MAX_ATTEMPTS = 3;
    let order: Awaited<ReturnType<typeof runCheckoutTransaction>> | undefined;
    for (let attempt = 1; ; attempt++) {
      try {
        order = await runCheckoutTransaction();
        break;
      } catch (err) {
        const isOrderNumberCollision =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          (err.meta?.target as string[] | undefined)?.some((t) => t.includes('order_number'));
        if (!isOrderNumberCollision || attempt >= MAX_ATTEMPTS) throw err;
      }
    }

    events.emit('order.created', {
      orderId: order.id,
      userId: opts.userId,
      total: Number(order.totalAmount),
      currency: order.currency,
    });
    return order;
  },
};

function variantLabel(
  v: { size: string | null; shade: string | null; fragrance: string | null } | null,
) {
  if (!v) return null;
  return [v.size, v.shade, v.fragrance].filter(Boolean).join(' · ') || null;
}

// Export cartRepo so checkout flows can pre-read cart (not used here directly).
export { cartRepo };
