import Link from 'next/link';
import { ArrowRight, Check, Truck } from 'lucide-react';

import { cn } from '@/lib/cn';

import { Reveal } from '@/design-system/primitives/reveal';
import { SectionHeading } from '@/design-system/primitives/section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type LadderTier = { minSubtotal: number; discountAmount: number };

const fmt = (n: number) => `Rs ${n.toLocaleString('en-US')}`;

/** One stop on the ladder: the quiet origin, a savings tier, or the summit. */
type Col = { kind: 'origin' } | { kind: 'tier'; spend: number; save: number } | { kind: 'summit' };

/**
 * Spend & Save ladder — the goal-gradient made visible BEFORE the cart.
 * Every number is the store's real published policy (tiers + the Rs 3,300
 * free-delivery summit); nothing is fabricated, so the motivation is honest.
 *
 * The rail runs cool→warm (teal → ember) so the eye reads it as a climb that
 * pays off at the top. Server component: desktop renders a horizontal stepper
 * (aligned pill / node / price rows so the rail threads every node center),
 * mobile a receipt-style vertical ladder along a gradient spine.
 */
export function SavingsLadder({
  tiers,
  freeDeliveryAt = 3300,
}: {
  tiers: LadderTier[];
  freeDeliveryAt?: number;
}) {
  const steps = tiers.slice(0, 4);
  if (steps.length === 0) return null;
  const maxSave = Math.max(...steps.map((t) => t.discountAmount));

  // origin + tiers + summit as one array, so the desktop stepper can render
  // three perfectly-aligned rows (pills, nodes, prices).
  const columns: Col[] = [
    { kind: 'origin' },
    ...steps.map((t) => ({ kind: 'tier' as const, spend: t.minSubtotal, save: t.discountAmount })),
    { kind: 'summit' as const },
  ];
  // The rail should span from the first node center to the last — each is half
  // a cell in from the edge.
  const edge = 100 / (2 * columns.length);

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="flex flex-col gap-4">
        <SectionHeading
          eyebrow="Spend & Save"
          title="Bigger basket, bigger discount."
          description={`Automatic at checkout — no code needed. Save up to ${fmt(maxSave)}, and cross ${fmt(freeDeliveryAt)} for free delivery.`}
        />
        <Badge
          variant="info"
          className="inline-flex w-fit items-center gap-1.5 border border-accent/30 bg-card text-accent"
        >
          <Check className="size-3.5" /> Applied automatically at checkout
        </Badge>
        <p className="text-sm text-muted-foreground">
          The more your basket holds, the more comes off — stacked automatically on every order.
        </p>
        <div>
          <Button asChild variant="outline" size="md">
            <Link href="/products">
              Build your basket <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Desktop: horizontal stepper as three aligned rows. */}
      <div className="hidden lg:block">
        {/* Row 1 — reward pills. */}
        <div className="flex">
          {columns.map((c, i) => (
            <Reveal key={i} inView delay={i * 0.08} className="flex flex-1 justify-center">
              {c.kind === 'summit' ? (
                <span className="flex items-center gap-1.5 rounded-full bg-brand-ember px-3 py-1 text-xs font-bold text-white shadow-card ring-2 ring-brand-ember/20">
                  <Truck className="size-3.5" /> Free delivery
                </span>
              ) : c.kind === 'tier' ? (
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
                  save {fmt(c.save)}
                </span>
              ) : (
                <span className="rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Start
                </span>
              )}
            </Reveal>
          ))}
        </div>

        {/* Row 2 — gradient rail threaded through the milestone nodes. */}
        <div className="relative flex items-center py-3">
          <div
            aria-hidden
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-accent/20 via-accent/50 to-brand-ember"
            style={{ left: `${edge}%`, right: `${edge}%` }}
          />
          {columns.map((c, i) => (
            <Reveal
              key={i}
              inView
              delay={i * 0.08}
              className="relative z-10 flex flex-1 items-center justify-center"
            >
              {c.kind === 'summit' ? (
                <span className="relative grid size-5 place-items-center rounded-full border-2 border-brand-ember bg-card shadow-card transition-transform duration-300 hover:scale-110">
                  <span className="size-2 rounded-full bg-brand-ember" />
                  <span
                    aria-hidden
                    className="absolute inset-0 -z-10 rounded-full bg-brand-ember/40 blur-md"
                  />
                </span>
              ) : c.kind === 'tier' ? (
                <span className="grid size-5 place-items-center rounded-full border-2 border-accent bg-card shadow-sm transition-transform duration-300 hover:scale-110">
                  <span className="size-1.5 rounded-full bg-accent" />
                </span>
              ) : (
                <span className="size-3 rounded-full border-2 border-muted-foreground/40 bg-card" />
              )}
            </Reveal>
          ))}
        </div>

        {/* Row 3 — spend thresholds. */}
        <div className="flex">
          {columns.map((c, i) => (
            <Reveal key={i} inView delay={i * 0.08} className="flex-1 text-center">
              {c.kind === 'origin' ? (
                <span className="text-sm tabular-nums text-muted-foreground">{fmt(0)}</span>
              ) : c.kind === 'summit' ? (
                <span className="text-sm font-semibold tabular-nums">{fmt(freeDeliveryAt)}</span>
              ) : (
                <span className="text-sm font-medium tabular-nums">{fmt(c.spend)}</span>
              )}
            </Reveal>
          ))}
        </div>
      </div>

      {/* Mobile: receipt-style vertical ladder along a gradient spine. */}
      <div className="lg:hidden">
        <div className="relative flex flex-col pl-6">
          <div
            aria-hidden
            className="absolute bottom-3 left-[5px] top-2 w-0.5 rounded-full bg-gradient-to-b from-accent/40 via-accent/60 to-brand-ember"
          />
          {steps.map((t, i) => (
            <Reveal key={t.minSubtotal} inView delay={i * 0.07}>
              <div
                className={cn(
                  'relative flex min-h-11 items-center justify-between gap-3 py-2.5',
                  i > 0 && 'border-t border-border/60',
                )}
              >
                <span
                  aria-hidden
                  className="absolute -left-6 top-1/2 grid size-3 -translate-y-1/2 place-items-center rounded-full border-2 border-accent bg-card"
                >
                  <span className="size-1 rounded-full bg-accent" />
                </span>
                <span className="text-sm tabular-nums text-foreground/80">
                  Spend {fmt(t.minSubtotal)}
                </span>
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-sm font-semibold text-accent">
                  save {fmt(t.discountAmount)}
                </span>
              </div>
            </Reveal>
          ))}
          <Reveal inView delay={steps.length * 0.07}>
            <div className="relative flex min-h-11 items-center justify-between gap-3 rounded-md border-t border-border/60 bg-brand-ember/[0.06] py-3">
              <span
                aria-hidden
                className="absolute -left-[25px] top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 border-brand-ember bg-card"
              />
              <span className="text-sm font-medium tabular-nums">Cross {fmt(freeDeliveryAt)}</span>
              <span className="flex items-center gap-1.5 rounded-full bg-brand-ember px-3 py-1 text-xs font-bold text-white">
                <Truck className="size-3.5" /> Free delivery
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
