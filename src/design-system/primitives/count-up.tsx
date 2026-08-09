'use client';

import { useEffect, useRef, useState } from 'react';

type CountUpProps = {
  value: number;
  decimals?: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
};

/**
 * Animates a number up to `value` the first time it scrolls into view
 * (easeOutCubic). Falls back to the final value instantly under
 * prefers-reduced-motion or without IntersectionObserver.
 *
 * IMPORTANT: the initial state is `value`, not 0.
 *
 * Starting at 0 meant the SERVER-RENDERED HTML contained "0". The homepage
 * closing line reads "<CountUp value={productCount} suffix="+" /> essentials,
 * one promise", so every crawler, every no-JS visitor, and every reader whose
 * hydration had not finished saw "0+ essentials" on a store with 579 products —
 * a live content bug that no amount of metadata work would have fixed.
 *
 * The animation is now opt-in per element: it only runs when the number starts
 * BELOW the fold, i.e. the observer's first callback reports it as not yet
 * intersecting. An element already on screen at mount keeps its real value
 * instead of flashing to 0 and counting back up.
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 1400,
  suffix = '',
  prefix = '',
  className,
}: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Nothing to do — `display` already holds the final value.
    if (reduced || typeof IntersectionObserver === 'undefined') return;

    // The observer fires once immediately with the current intersection state.
    let armed = false;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? false;
        if (!armed) {
          armed = true;
          // Already on screen at mount: leave the real number alone.
          if (visible) {
            io.disconnect();
            return;
          }
          setDisplay(0);
          return;
        }
        if (!visible || started.current) return;
        started.current = true;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(value * eased);
          if (t < 1) requestAnimationFrame(tick);
          else setDisplay(value);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  const formatted = display.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
