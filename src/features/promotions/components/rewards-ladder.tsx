'use client';

import { Gift, Truck } from 'lucide-react';

import { cn } from '@/lib/cn';
import { spendTierProgress } from '@/lib/promotions';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/shipping';
import { formatMoney } from '@/utils/format';

import { useGetSpendTiersQuery } from '../api/promotions-api';

// Use the shared formatter so amounts render "Rs 3,300" here exactly like the
// Price primitive on the same cart/checkout screen (was "PKR 8,000" via en-US).
const money = (n: number, currency = 'PKR') => formatMoney(n, currency);

/**
 * The "rewards ladder" nudge — the core conversion lever. Tells the shopper what
 * they've unlocked and how little more it takes to reach the next reward (a
 * bigger Spend & Save tier, or free shipping). Goal-gradient effect → lifts AOV.
 *
 * Renders nothing when the cart is empty or every reward is already unlocked and
 * there's no Spend & Save configured.
 */
export function RewardsLadder({
  subtotal,
  currency = 'PKR',
  className,
}: {
  subtotal: number;
  currency?: string;
  className?: string;
}) {
  const { data } = useGetSpendTiersQuery();
  const tiers = data?.tiers ?? [];

  const { current, next } = spendTierProgress(subtotal, tiers);
  const hasFreeShip = subtotal >= FREE_SHIPPING_THRESHOLD;

  if (subtotal <= 0) return null;

  // The next milestone = the nearer of (next tier, free shipping).
  const milestones: { threshold: number; label: string; icon: 'gift' | 'truck' }[] = [];
  if (next) {
    milestones.push({
      threshold: next.minSubtotal,
      label: `save ${money(next.discountAmount, currency)}`,
      icon: 'gift',
    });
  }
  if (!hasFreeShip) {
    milestones.push({
      threshold: FREE_SHIPPING_THRESHOLD,
      label: 'unlock free shipping',
      icon: 'truck',
    });
  }
  milestones.sort((a, b) => a.threshold - b.threshold);
  const target = milestones[0];

  // Nothing unlocked and nothing to chase → don't render.
  if (!current && !target && !hasFreeShip) return null;

  const remaining = target ? Math.max(0, target.threshold - subtotal) : 0;
  const progress = target ? Math.min(100, (subtotal / target.threshold) * 100) : 100;
  const Icon = target?.icon === 'truck' ? Truck : Gift;

  return (
    <div
      className={cn(
        'rounded-lg border border-accent/30 bg-gradient-to-r from-accent/10 to-transparent p-3',
        className,
      )}
    >
      {current ? (
        <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-success">
          <Gift className="size-4 shrink-0" />
          {money(current.discountAmount, currency)} off unlocked!
        </div>
      ) : null}

      {target ? (
        <p className="flex items-center gap-1.5 text-sm">
          <Icon className="size-4 shrink-0 text-accent" />
          <span>
            Add <span className="font-semibold">{money(remaining, currency)}</span> more to{' '}
            {target.label}.
          </span>
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-sm font-medium text-success">
          <Gift className="size-4 shrink-0" /> You&apos;ve unlocked every reward 🎉
        </p>
      )}

      {target ? (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
