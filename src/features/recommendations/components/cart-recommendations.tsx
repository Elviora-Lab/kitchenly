'use client';

import { cn } from '@/lib/cn';

import { ProductCard } from '@/design-system/patterns/product-card';

import { useCart } from '@/features/cart/hooks/use-cart';
import { useListProductsQuery } from '@/features/products/api/products-api';

/**
 * "You may also like" cross-sell for the cart — surfaces best-selling products that
 * aren't already in the bag, to lift average order value. Client-side so it
 * reacts to whatever is currently in the cart.
 */
export function CartRecommendations({
  limit = 4,
  columns = 4,
  heading = 'You may also like',
}: {
  limit?: number;
  columns?: 2 | 4;
  heading?: string;
}) {
  const { cart } = useCart();
  const { data } = useListProductsQuery({ sort: 'best-sellers', pageSize: 12 });

  const inCart = new Set(cart.lines.map((l) => l.productId));
  const recs = (data?.items ?? []).filter((p) => !inCart.has(p.id)).slice(0, limit);
  if (recs.length === 0) return null;

  return (
    <section className="flex flex-col gap-5">
      <h2 className="editorial-heading text-display-sm">{heading}</h2>
      <div
        className={cn(
          'grid gap-x-4 gap-y-10',
          columns === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2',
        )}
      >
        {recs.map((p, i) => (
          <ProductCard
            key={p.id}
            product={p}
            index={i}
            listId="cart_cross_sell"
            listName="Cart recommendations"
          />
        ))}
      </div>
    </section>
  );
}
