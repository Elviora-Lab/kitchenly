'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarRange } from 'lucide-react';

import {
  AD_DATE_PRESET_LABELS,
  AD_RANGE_TABS,
  currentMetaReportingDate,
  DEFAULT_AD_RANGE,
  isAdDatePreset,
} from '@/lib/ads/date-presets';
import { cn } from '@/lib/cn';

import { AdsRefreshButton } from './ads-refresh-button';

const SUB_TABS = [
  { label: 'Overview', href: '/admin/ads' },
  { label: 'Funnel', href: '/admin/ads/funnel' },
  { label: 'Breakdowns', href: '/admin/ads/breakdowns' },
  { label: 'Campaigns', href: '/admin/ads/campaigns' },
] as const;

/**
 * Shared sub-navigation for the ad dashboard: section tabs on the left, the
 * date-range selector on the right. Reads the current range off the URL so it
 * persists as you move between sections, and carries the current section as you
 * change the range. Lives in the layout, so it renders once for every sub-page.
 */
export function AdsNav() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const rawRange = params.get('range') ?? undefined;
  const range = isAdDatePreset(rawRange) ? rawRange : DEFAULT_AD_RANGE;
  const isCustom = rawRange === 'custom';
  const latestAllowed = currentMetaReportingDate();
  const [from, setFrom] = useState(params.get('from') ?? '');
  const [to, setTo] = useState(params.get('to') ?? '');

  useEffect(() => {
    setFrom(params.get('from') ?? '');
    setTo(params.get('to') ?? '');
  }, [params]);

  const selectedDateQuery =
    isCustom && from && to
      ? new URLSearchParams({ range: 'custom', from, to }).toString()
      : `range=${range}`;

  const isActive = (href: string) =>
    href === '/admin/ads' ? pathname === '/admin/ads' : pathname.startsWith(href);

  return (
    <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
      <nav className="flex flex-wrap gap-1" aria-label="Ad dashboard sections">
        {SUB_TABS.map((t) => (
          <Link
            key={t.href}
            href={`${t.href}?${selectedDateQuery}`}
            aria-current={isActive(t.href) ? 'page' : undefined}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              isActive(t.href)
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex flex-wrap gap-1" aria-label="Date range">
          {AD_RANGE_TABS.map((preset) => (
            <Link
              key={preset}
              href={`${pathname}?range=${preset}`}
              aria-current={preset === range ? 'true' : undefined}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                !isCustom && preset === range
                  ? 'bg-muted text-foreground ring-1 ring-inset ring-border'
                  : 'text-muted-foreground hover:bg-muted/70',
              )}
            >
              {AD_DATE_PRESET_LABELS[preset]}
            </Link>
          ))}
        </nav>
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!from || !to || from > to) return;
            router.push(`${pathname}?${new URLSearchParams({ range: 'custom', from, to })}`);
          }}
        >
          <CalendarRange className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="date"
            value={from}
            max={to || latestAllowed}
            onChange={(event) => setFrom(event.target.value)}
            aria-label="Custom range start date"
            className="h-8 w-[132px] rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            max={latestAllowed}
            onChange={(event) => setTo(event.target.value)}
            aria-label="Custom range end date"
            className="h-8 w-[132px] rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={!from || !to || from > to}
            className="h-8 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply
          </button>
        </form>
        <AdsRefreshButton />
      </div>
    </div>
  );
}
