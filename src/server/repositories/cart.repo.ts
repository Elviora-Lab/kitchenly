import 'server-only';

import { prisma } from '@/lib/db';

export const cartRepo = {
  /**
   * Resolve the current shopper's cart, creating one if needed.
   *
   * The carts table has unique constraints on BOTH `user_id` and `session_id`.
   * That means a logged-in user with a lingering guest cart (same session
   * cookie from before sign-in) would hit a P2002 on insert if we naively
   * created `(userId, sessionId)`.
   *
   * Resolution order, wrapped in a transaction:
   *   1. Logged in → look for the user's existing cart, return it.
   *   2. Logged in + no user cart yet → look for a guest cart on this session
   *      and CLAIM it (assign userId, null out sessionId). Items carry over.
   *   3. Logged in + no carts at all → create a fresh user cart.
   *   4. Guest → look up by sessionId, create if missing.
   */
  async findOrCreate(opts: { userId?: string; sessionId?: string }) {
    if (!opts.userId && !opts.sessionId) {
      throw new Error('cartRepo.findOrCreate requires userId or sessionId');
    }

    // Fast path: in the steady state the cart already exists, so resolve it
    // with a single SELECT and skip the transaction — an interactive
    // $transaction costs BEGIN + COMMIT round trips and pins a pooled
    // connection on every cart read otherwise. The transaction below only
    // needs to close the create/claim race for first-time carts.
    const existing = await prisma.cart.findFirst({
      where: opts.userId ? { userId: opts.userId } : { sessionId: opts.sessionId },
      include: cartInclude,
    });
    if (existing) return existing;

    return prisma.$transaction(async (tx) => {
      if (opts.userId) {
        const userCart = await tx.cart.findFirst({
          where: { userId: opts.userId },
          include: cartInclude,
        });
        if (userCart) return userCart;

        // Claim a pre-login guest cart, if any.
        if (opts.sessionId) {
          const guestCart = await tx.cart.findFirst({
            where: { sessionId: opts.sessionId, userId: null },
          });
          if (guestCart) {
            return tx.cart.update({
              where: { id: guestCart.id },
              data: { userId: opts.userId, sessionId: null },
              include: cartInclude,
            });
          }
        }

        // Brand-new user. Create a cart keyed by userId only — leave
        // sessionId null to avoid future collisions with this browser.
        return tx.cart.create({
          data: { userId: opts.userId },
          include: cartInclude,
        });
      }

      // Guest flow — keyed by sessionId only.
      const guestCart = await tx.cart.findFirst({
        where: { sessionId: opts.sessionId },
        include: cartInclude,
      });
      if (guestCart) return guestCart;

      return tx.cart.create({
        data: { sessionId: opts.sessionId },
        include: cartInclude,
      });
    });
  },

  findById(id: string) {
    return prisma.cart.findUnique({ where: { id }, include: cartInclude });
  },

  /**
   * Claim a guest cart for a user at login, without creating anything. Used
   * before the guest cookie is rotated (session-fixation defense) so the
   * pre-login cart isn't orphaned under the old guest id. No-ops when the user
   * already has a cart (uq_user_active_cart) or there is no guest cart.
   */
  async claimGuestCart(userId: string, sessionId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const userCart = await tx.cart.findFirst({ where: { userId }, select: { id: true } });
      if (userCart) return;
      await tx.cart.updateMany({
        where: { sessionId, userId: null },
        data: { userId, sessionId: null },
      });
    });
  },

  async upsertLine(
    cartId: string,
    payload: {
      productId: string;
      variantId: string | null;
      quantity: number;
      price: number;
    },
  ) {
    // Prisma compound uniques don't match nullable parts, so we do
    // find → update | create explicitly, inside a transaction to close the
    // race between the SELECT and INSERT.
    return prisma.$transaction(async (tx) => {
      const existing = await tx.cartItem.findFirst({
        where: {
          cartId,
          productId: payload.productId,
          variantId: payload.variantId,
        },
        select: { id: true },
      });
      if (existing) {
        return tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: { increment: payload.quantity }, price: payload.price },
        });
      }
      return tx.cartItem.create({ data: { cartId, ...payload } });
    });
  },

  /**
   * Update a line's quantity, scoped to the owning cart. Uses `updateMany`/
   * `deleteMany` with a `cartId` filter so a caller can never mutate a line
   * that belongs to another shopper's cart (IDOR). Returns the affected count
   * so the service can 404 when the line isn't in the caller's cart.
   */
  async updateLineQuantity(cartId: string, lineId: string, quantity: number) {
    if (quantity <= 0) {
      const { count } = await prisma.cartItem.deleteMany({ where: { id: lineId, cartId } });
      return count;
    }
    const { count } = await prisma.cartItem.updateMany({
      where: { id: lineId, cartId },
      data: { quantity },
    });
    return count;
  },

  async removeLine(cartId: string, lineId: string) {
    const { count } = await prisma.cartItem.deleteMany({ where: { id: lineId, cartId } });
    return count;
  },

  clear(cartId: string) {
    return prisma.cartItem.deleteMany({ where: { cartId } });
  },

  applyCoupon(cartId: string, _code: string) {
    // Note: schema stores couponCode on `coupon_usages` (post-order). For the
    // pre-order cart hint, we'd add a `couponCode` column on `carts` in a future
    // migration. For now this is a no-op placeholder.
    return prisma.cart.findUnique({ where: { id: cartId }, include: cartInclude });
  },
};

const cartInclude = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          images: { where: { isPrimary: true }, take: 1 },
        },
      },
      // `price` is needed so the cart can re-derive live line prices rather
      // than trusting the add-to-cart snapshot in `cart_items.price` — see
      // `serializeCart`.
      variant: {
        select: { id: true, sku: true, size: true, shade: true, fragrance: true, price: true },
      },
    },
  },
} as const;
