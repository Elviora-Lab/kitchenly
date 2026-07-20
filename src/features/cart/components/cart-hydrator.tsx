'use client';

import { useEffect } from 'react';

import { useAppDispatch } from '@/store/hooks';

import { useGetCartQuery } from '../api/cart-api';
import { type CartLine, hydrate } from '../store/cart-slice';

/**
 * CartHydrator
 * ----------------------------------------------------------------------
 * Source-of-truth bridge: server cart (Postgres) → Redux cart (in-memory).
 *
 * Why this exists:
 *   • The cart drawer and badge read from Redux for instant UI updates.
 *   • Redux state is in-memory only — it resets on every page reload.
 *   • Without this hydrator, items added in a previous session disappear
 *     visually after refresh (they're still in the DB; the UI just doesn't know).
 *
 * How it works:
 *   • Calls `useGetCartQuery` once per mount. RTK Query dedups + caches.
 *   • When the cart is refetched (mount, focus, post-mutation invalidation),
 *     dispatches `hydrate` to replace Redux state with the server's truth.
 *
 * Rendered as a sibling of the cart drawer — it has no visual output.
 */
export function CartHydrator() {
  const dispatch = useAppDispatch();
  const { data } = useGetCartQuery();

  useEffect(() => {
    if (!data) return;
    dispatch(
      hydrate({
        lines: data.lines.map(toSliceLine),
        couponCode: data.couponCode ?? null,
        couponDiscount: null,
        shippingMethodId: null,
        flashSale: data.flashSale ?? null,
      }),
    );
  }, [data, dispatch]);

  return null;
}

// Server lines carry an `id` (cart_item.id) and may have a null variantId.
function toSliceLine(line: {
  id?: string;
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  imageUrl: string;
  unitPrice: number;
  originalPrice?: number;
  quantity: number;
  currency: string;
}): CartLine {
  return {
    id: line.id,
    productId: line.productId,
    // No-variant products never occur in the seed, but be defensive.
    variantId: line.variantId ?? '',
    slug: line.slug,
    name: line.name,
    imageUrl: line.imageUrl,
    unitPrice: line.unitPrice,
    originalPrice: line.originalPrice,
    quantity: line.quantity,
    currency: line.currency,
  };
}
