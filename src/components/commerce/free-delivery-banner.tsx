import Link from 'next/link';
import { ArrowRight, Gift, ShieldCheck, Truck } from 'lucide-react';

import { FREE_SHIPPING_THRESHOLD } from '@/lib/shipping';

import { Button } from '@/components/ui/button';

const threshold = `Rs ${FREE_SHIPPING_THRESHOLD.toLocaleString('en-US')}`;

export function FreeDeliveryBanner({ variant = 'home' }: { variant?: 'home' | 'compact' }) {
  const isHome = variant === 'home';

  return (
    <section
      aria-label={`Free delivery on orders over ${threshold}`}
      className="overflow-hidden rounded-lg border border-brand-ember/25 bg-gradient-to-br from-brand-mist via-background to-brand-ember/[0.12] shadow-pop"
    >
      <div className="grid items-center gap-5 p-5 md:grid-cols-[1fr_auto] md:p-7">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-brand-ember text-white shadow-card md:size-14">
            <Truck className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-ember">
              Delivery gift
            </p>
            <h2 className="mt-1 text-balance font-serif text-2xl font-semibold leading-tight text-brand-navy md:text-3xl">
              Free delivery over {threshold}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              {isHome
                ? 'Build a smarter basket and we will handle the delivery fee automatically at checkout.'
                : 'Add your everyday picks to cross the free-delivery line before checkout.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-foreground/80">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/75 px-3 py-1 ring-1 ring-border">
                <ShieldCheck className="size-3.5 text-brand-teal" />
                Cash on delivery
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/75 px-3 py-1 ring-1 ring-border">
                <Gift className="size-3.5 text-brand-ember" />
                Auto-applied
              </span>
            </div>
          </div>
        </div>

        <Button
          asChild
          variant="cta"
          size={isHome ? 'xl' : 'md'}
          uppercase
          className="w-full md:w-auto"
        >
          <Link href="/products?sort=best-sellers">
            Shop now <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
