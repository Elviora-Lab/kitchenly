import Link from 'next/link';
import { ArrowRight, Gift, Truck } from 'lucide-react';

import { FREE_SHIPPING_THRESHOLD } from '@/lib/shipping';

const threshold = `Rs ${FREE_SHIPPING_THRESHOLD.toLocaleString('en-US')}`;

/**
 * Store-wide offer strip. It deep-links to the homepage banner where the
 * shopper gets the full free-delivery offer and a direct path into products.
 */
export function OfferTicker() {
  return (
    <div className="surface-navy relative border-b border-white/10">
      <Link
        href="/#free-delivery"
        className="group flex min-h-10 items-center justify-center gap-2 px-4 py-2 text-center text-[12px] font-semibold uppercase tracking-[0.12em] text-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-label={`Free delivery on orders over ${threshold}`}
        data-track="cta"
        data-track-label="free-delivery-strip"
      >
        <span className="hidden items-center gap-1.5 text-brand-mist sm:inline-flex">
          <Truck className="size-3.5" />
          Limited delivery gift
        </span>
        <span className="rounded-full bg-brand-ember px-2.5 py-0.5 text-[10px] font-bold text-white shadow-soft">
          Free delivery
        </span>
        <span>on orders over {threshold}</span>
        <Gift className="size-3.5 text-brand-ember" />
        <ArrowRight className="size-3.5 transition-transform duration-300 ease-swift group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
