'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';

import { cn } from '@/lib/cn';

import { ProductCard, type ProductCardData } from '@/design-system/patterns/product-card';
import { Reveal } from '@/design-system/primitives/reveal';
import { FlashCountdown } from '@/components/commerce/flash-countdown';
import { SnapRail } from '@/components/commerce/snap-rail';
import { Badge } from '@/components/ui/badge';

import type { LiveFlashSale } from '@/server/services/flash-sale.service';

const LIST_ID = 'home_flash_sale';
const LIST_NAME = 'Home — Flash sale';

/**
 * Homepage flash sale — a curated set of products at a reduced price for a
 * scheduled window, managed from /admin/flash-sale.
 *
 * Client component because the countdown ticks. It also self-retires: when the
 * clock hits zero the whole section unmounts, because the homepage is
 * ISR-cached for 300s and would otherwise keep advertising a discount that
 * checkout has already stopped applying (checkout re-derives prices live, in
 * `ordersService.createFromCart`).
 *
 * Prices here are display-only. The chargeable figure is recomputed server-side
 * at add-to-cart and again inside the checkout transaction.
 */
export function FlashSaleSection({ sale }: { sale: LiveFlashSale }) {
  const [expired, setExpired] = useState(false);
  const handleExpire = useCallback(() => setExpired(true), []);

  if (expired || sale.products.length === 0) return null;

  const topDiscount = Math.max(...sale.products.map((p) => p.discountPercent));

  return (
    <section className="border-y border-brand-ember/20 bg-brand-ember/[0.04] py-12 md:py-16">
      <div className="container flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <Reveal inView className="flex max-w-3xl flex-col gap-3">
            <span className="eyebrow inline-flex items-center gap-1.5 text-brand-ember">
              <Zap className="size-3.5" aria-hidden />
              Limited time
            </span>
            <h2 className="editorial-heading text-display-md md:text-display-lg">{sale.title}</h2>
            <p className="text-pretty text-base leading-relaxed text-muted-foreground">
              Up to {topDiscount}% off, while the clock runs. Prices return to normal when it stops.
            </p>
          </Reveal>

          <Reveal
            inView
            className="flex items-center gap-3 rounded-xl border border-brand-ember/25 bg-background px-4 py-3 shadow-soft"
          >
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Ends in
            </span>
            <FlashCountdown endsAt={sale.endsAt} onExpire={handleExpire} />
          </Reveal>
        </div>

        {/* Desktop: up to 16 in a 4-wide grid. */}
        <div className="hidden grid-cols-3 gap-5 md:grid lg:grid-cols-4">
          {sale.products.map((product, i) => (
            <Reveal key={product.id} inView delay={(i % 4) * 0.06}>
              <FlashCard product={product} index={i} />
            </Reveal>
          ))}
        </div>

        {/* Mobile: snap rail, matching the other homepage product sections. */}
        <div className="md:hidden">
          <SnapRail ariaLabel={sale.title} itemClassName="w-[72vw] max-w-72">
            {sale.products.map((product, i) => (
              <FlashCard key={product.id} product={product} index={i} />
            ))}
          </SnapRail>
        </div>

        <Link
          href="/products"
          className="self-start text-sm font-semibold text-accent underline-offset-4 hover:underline"
        >
          Browse the full catalog →
        </Link>
      </div>
    </section>
  );
}

/**
 * A product card wearing its discount percentage.
 *
 * `<ProductCard>` caps its own badge stack at two and has no slot for a custom
 * one, so the percentage rides above it in the corner opposite that stack
 * rather than fighting it for space.
 */
function FlashCard({
  product,
  index,
}: {
  product: LiveFlashSale['products'][number];
  index: number;
}) {
  const card: ProductCardData = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    imageUrl: product.imageUrl,
    hoverImageUrl: product.hoverImageUrl,
    price: product.price,
    // The pre-sale price — drives the card's existing "Save Rs X" line.
    compareAt: product.compareAt,
    currency: product.currency,
    stockState: product.soldOut ? 'out' : undefined,
  };

  return (
    <div className="relative">
      <Badge
        variant="deal"
        className={cn(
          'pointer-events-none absolute right-2 top-2 z-10 shadow-sm',
          product.soldOut && 'opacity-60',
        )}
      >
        −{product.discountPercent}%
      </Badge>
      <ProductCard product={card} listId={LIST_ID} listName={LIST_NAME} index={index} />
    </div>
  );
}
