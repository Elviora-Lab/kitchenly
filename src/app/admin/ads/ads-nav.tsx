'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import {
  AD_DATE_PRESET_LABELS,
  AD_RANGE_TABS,
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
  const pathname = usePathname();
  const params = useSearchParams();
  const rawRange = params.get('range') ?? undefined;
  const range = isAdDatePreset(rawRange) ? rawRange : DEFAULT_AD_RANGE;

  const isActive = (href: string) =>
    href === '/admin/ads' ? pathname === '/admin/ads' : pathname.startsWith(href);

  return (
    <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
      <nav className="flex flex-wrap gap-1" aria-label="Ad dashboard sections">
        {SUB_TABS.map((t) => (
          <Link
            key={t.href}
            href={`${t.href}?range=${range}`}
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
                preset === range
                  ? 'bg-muted text-foreground ring-1 ring-inset ring-border'
                  : 'text-muted-foreground hover:bg-muted/70',
              )}
            >
              {AD_DATE_PRESET_LABELS[preset]}
            </Link>
          ))}
        </nav>
        <AdsRefreshButton />
      </div>
    </div>
  );
}
