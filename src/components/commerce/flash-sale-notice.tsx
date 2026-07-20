'use client';

import { useCallback, useState } from 'react';
import { Zap } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatMoney } from '@/utils/format';

import { FlashCountdown } from './flash-countdown';

/**
 * "Flash sale ends in HH:MM:SS" for the cart and checkout summaries.
 *
 * Removes itself the moment the window closes: past that instant checkout
 * re-derives prices at list rate, so leaving the notice up would promise a
 * discount the order is no longer going to apply.
 */
export function FlashSaleNotice({
  title,
  endsAt,
  savings,
  currency = 'PKR',
  className,
}: {
  title: string;
  endsAt: string;
  /** Total saved on the current cart; the line is omitted when 0. */
  savings?: number;
  currency?: string;
  className?: string;
}) {
  const [expired, setExpired] = useState(false);
  const handleExpire = useCallback(() => setExpired(true), []);

  if (expired) return null;

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-lg border border-brand-ember/25 bg-brand-ember/[0.06] px-3 py-2.5',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ember">
          <Zap className="size-3.5" aria-hidden />
          {title}
        </span>
        <span className="inline-flex items-baseline gap-1.5">
          <span className="text-xs text-muted-foreground">Ends in</span>
          <FlashCountdown endsAt={endsAt} onExpire={handleExpire} />
        </span>
      </div>
      {savings && savings > 0 ? (
        <p className="text-xs text-muted-foreground">
          You&rsquo;re saving {formatMoney(savings, currency)} on this order.
        </p>
      ) : null}
    </div>
  );
}
