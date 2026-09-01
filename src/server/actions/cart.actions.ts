'use server';

import { revalidateTag } from 'next/cache';

import { withAction } from './_with-action';

import { getSession } from '@/server/auth/get-session';
import { getOrCreateGuestId } from '@/server/auth/guest-session';
import { clientIpFromAction, enforceRateLimit } from '@/server/http/rate-limit';
import { cartService } from '@/server/services/cart.service';
import { couponsService } from '@/server/services/coupons.service';
import { addLineBody, applyCouponBody, updateLineBody } from '@/server/validators/cart.schema';

export const addToCart = withAction(async (input: { variantId: string; quantity?: number }) => {
  const body = addLineBody.parse({ variantId: input.variantId, quantity: input.quantity ?? 1 });
  const session = await getSession();
  const sessionId = await getOrCreateGuestId();
  const cart = await cartService.addLine({ userId: session?.sub ?? null, sessionId }, body);
  revalidateTag('cart', 'max');
  return cart;
});

export const updateCartLine = withAction(async (input: { lineId: string; quantity: number }) => {
  const body = updateLineBody.parse({ quantity: input.quantity });
  const session = await getSession();
  const sessionId = await getOrCreateGuestId();
  const cart = await cartService.updateLineQuantity(
    { userId: session?.sub ?? null, sessionId },
    { lineId: input.lineId, quantity: body.quantity },
  );
  revalidateTag('cart', 'max');
  return cart;
});

export const applyCoupon = withAction(async (input: { code: string }) => {
  // Same brute-force guard as /api/v1/coupons/validate — codes are guessable.
  await enforceRateLimit({
    key: `coupon-validate:${await clientIpFromAction()}`,
    limit: 10,
    windowSeconds: 60,
  });

  const body = applyCouponBody.parse(input);
  const session = await getSession();
  const sessionId = await getOrCreateGuestId();

  // Validate against the caller's current cart subtotal. Throws a 400 with a
  // human reason if invalid; the discount is re-validated and the usage counter
  // incremented atomically at checkout (ordersService.createFromCart).
  const cart = await cartService.getCart({ userId: session?.sub ?? null, sessionId });
  const { coupon, discount } = await couponsService.evaluate(body.code, cart.subtotal);

  revalidateTag('cart', 'max');
  return {
    applied: true,
    code: coupon.code,
    discount: Number(discount),
    discountType: coupon.discountType,
  };
});
