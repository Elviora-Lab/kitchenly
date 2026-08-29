'use client';

import { ArrowRight, ShieldCheck, Truck } from 'lucide-react';

import { cn } from '@/lib/cn';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/shipping';
import { formatMoney } from '@/utils/format';

type CartCheckoutNudgeProps = {
  subtotal: number;
  currency?: string;
  compact?: boolean;
  className?: string;
};

export function CartCheckoutNudge({
  subtotal,
  currency = 'PKR',
  compact = false,
  className,
}: CartCheckoutNudgeProps) {
  if (subtotal <= 0) return null;

  const remainingForFreeDelivery = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
  const hasFreeDelivery = remainingForFreeDelivery === 0;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-accent/25 bg-accent/[0.07]',
        compact ? 'p-3' : 'p-4',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-background text-accent shadow-soft">
          {hasFreeDelivery ? (
            <ShieldCheck className="size-4" aria-hidden />
          ) : (
            <Truck className="size-4" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground">
            {hasFreeDelivery
              ? 'Free delivery unlocked. COD checkout is ready.'
              : `Add ${formatMoney(remainingForFreeDelivery, currency)} more for free delivery.`}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Cash on delivery is available. Exact shipping is confirmed before the order is placed.
          </p>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background/80">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-700 ease-swift"
          style={{ width: `${progress}%` }}
        />
      </div>

      {!compact ? (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-accent">
          <span>Your cart is saved for checkout</span>
          <ArrowRight className="size-3.5" aria-hidden />
        </div>
      ) : null}
    </div>
  );
}
