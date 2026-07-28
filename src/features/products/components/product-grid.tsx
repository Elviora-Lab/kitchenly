'use client';

import { useEffect, useRef } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

import { analytics } from '@/lib/analytics';
import { cn } from '@/lib/cn';

import { ProductCard, ProductCardSkeleton } from '@/design-system/patterns/product-card';
import { EmptyState } from '@/design-system/primitives/empty-state';

import type { Product } from '../types';

type ProductGridProps = {
  products?: Product[];
  loading?: boolean;
  skeletonCount?: number;
  className?: string;
  onWishlistToggle?: (id: string) => void;
  wishlistedIds?: string[];
  /** GA4 list context — labels this grid's view_item_list / select_item events. */
  listId?: string;
  listName?: string;
};

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export function ProductGrid({
  products,
  loading,
  skeletonCount = 8,
  className,
  onWishlistToggle,
  wishlistedIds = [],
  listId,
  listName,
}: ProductGridProps) {
  const prefersReduced = useReducedMotion();

  // Cards that have already animated in. A filter/sort that reshuffles the
  // list should only animate genuinely NEW cards — not replay the entrance
  // stagger over products the shopper is already looking at.
  const seenIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    products?.forEach((p) => seenIds.current.add(p.id));
  }, [products]);

  // GA4 view_item_list — fire once when the list first has products. Keyed on
  // the id set so a filter/sort that swaps the products re-reports the new list.
  const trackedKey = useRef<string>('');
  useEffect(() => {
    if (!products || products.length === 0) return;
    const key = products.map((p) => p.id).join(',');
    if (trackedKey.current === key) return;
    trackedKey.current = key;
    analytics.viewItemList({
      listId,
      listName,
      items: products.slice(0, 50).map((p, i) => ({
        item_id: p.id,
        item_name: p.name,
        item_brand: p.brandLine,
        item_list_id: listId,
        item_list_name: listName,
        price: p.price,
        index: i,
      })),
    });
  }, [products, listId, listName]);

  if (loading && !products) {
    return (
      <div
        className={cn('grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4', className)}
      >
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <EmptyState
        title="Nothing to show — yet"
        description="Try adjusting your filters or browse our latest editorial picks."
      />
    );
  }

  // Cap motion to the first 12 items so very long grids don't stagger painfully
  // far down the page; the rest mount instantly.
  const STAGGER_LIMIT = 12;

  if (prefersReduced) {
    return (
      <div
        className={cn('grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4', className)}
      >
        {products.map((p, i) => (
          <ProductCard
            key={p.id}
            product={p}
            priority={i < 4}
            onWishlistToggle={onWishlistToggle}
            wishlisted={wishlistedIds.includes(p.id)}
            listId={listId}
            listName={listName}
            index={i}
          />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className={cn('grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4', className)}
      variants={container}
      initial="hidden"
      animate="show"
    >
      {products.map((p, i) => (
        <motion.div
          key={p.id}
          // Every card keeps `item` so the parent's "show" always resolves to a
          // visible state. Dropping `variants` for seen cards used to strand any
          // card whose entrance was still in flight at `opacity: 0` — it kept the
          // grid slot but never painted. `initial` is read only at mount, so a
          // later re-render can no longer interrupt an entrance; `false` means
          // "render straight at `show`", i.e. skip the entrance animation.
          variants={item}
          initial={i < STAGGER_LIMIT && !seenIds.current.has(p.id) ? undefined : false}
        >
          <ProductCard
            product={p}
            priority={i < 4}
            onWishlistToggle={onWishlistToggle}
            wishlisted={wishlistedIds.includes(p.id)}
            listId={listId}
            listName={listName}
            index={i}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
