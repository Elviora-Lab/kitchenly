'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';
import { secondsRemaining } from '@/lib/flash-sale';

/**
 * Ticking time-remaining readout for the flash sale.
 *
 * The deadline arrives as an absolute ISO instant and every tick is measured
 * against it — the homepage is ISR-cached for 300s, so anything derived from
 * render time would be up to five minutes wrong.
 *
 * Calls `onExpire` once the window closes so the parent can drop the section
 * rather than keep advertising prices that are no longer being charged.
 */
export function FlashCountdown({
  endsAt,
  onExpire,
  className,
}: {
  endsAt: string;
  onExpire?: () => void;
  className?: string;
}) {
  // Start at null so server and first client render agree — the real value
  // lands on mount, avoiding a hydration mismatch on a per-second clock.
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const next = secondsRemaining(endsAt);
      setRemaining(next);
      if (next <= 0) onExpire?.();
      return next;
    };

    if (tick() <= 0) return;
    const id = setInterval(() => {
      if (tick() <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt, onExpire]);

  if (remaining === null) {
    return (
      <span className={cn('font-mono text-sm tabular-nums text-muted-foreground', className)}>
        {/* Placeholder keeps layout stable until the clock mounts. */}
        --:--:--
      </span>
    );
  }

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <span
      className={cn('inline-flex items-baseline gap-2', className)}
      // Announce sparingly — a per-second live region would flood a screen reader.
      aria-live="off"
    >
      <span className="sr-only">Time remaining in this sale:</span>
      <span className="font-mono text-lg font-semibold tabular-nums text-brand-ember">
        {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    </span>
  );
}
