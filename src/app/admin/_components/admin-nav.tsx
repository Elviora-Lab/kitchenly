'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { adminNav, adminNavGroups } from '@/config/navigation';

import { cn } from '@/lib/cn';

/**
 * The admin section list, shared by the desktop sidebar and the mobile drawer
 * so the two can't drift apart.
 *
 * Scrolls on its own — the list is longer than a laptop viewport — while the
 * section headings stick, so you can still tell which part of the admin you're
 * looking at halfway down.
 */
export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const active = useActiveHref();

  return (
    <nav className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1" aria-label="Admin sections">
      {adminNavGroups.map((group, index) => (
        <div key={group.label ?? 'top'} className={cn('flex flex-col gap-1', index > 0 && 'mt-4')}>
          {group.label ? (
            <div className="sticky top-0 z-10 bg-card py-1 text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground/70">
              {group.label}
            </div>
          ) : null}
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active === item.href ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-2 text-sm transition-colors',
                active === item.href
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

/**
 * The most specific section matching the current URL.
 *
 * Longest match wins, so `/admin/inventory/reorder` highlights the reorder
 * report rather than both it and stock levels — and `/admin` only lights up on
 * the dashboard itself, despite prefixing every other route.
 */
function useActiveHref(): string | null {
  const pathname = usePathname();

  return adminNav.reduce<string | null>((best, item) => {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!matches) return best;
    return best === null || item.href.length > best.length ? item.href : best;
  }, null);
}
