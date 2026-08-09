import { type AriaAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/cn';

import { buttonVariants } from '@/components/ui/button';

/**
 * Server-rendered pagination for the storefront catalog and category listings.
 *
 * Link-based rather than the `onChange` design-system `<Pagination>` primitive,
 * which is a client component — these listings are server components, and real
 * hrefs keep pages crawlable and middle-clickable.
 *
 * `params` carries the active sort/brand/search filters into every page link so
 * paging never silently drops a filter. Page 1 is emitted without a `page`
 * param to keep the canonical URL clean.
 *
 * Rendered alongside the infinite-scroll grid rather than only inside
 * `<noscript>`: crawlers do not scroll, so without these hrefs everything past
 * the first 24 products of a category is reachable only from the sitemap, with
 * no internal links pointing at it. `showSummary` turns off the item count when
 * the grid above already reports its own progress.
 */
export function CatalogPagination({
  page,
  pageSize,
  total,
  basePath,
  params,
  showSummary = true,
  label,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
  showSummary?: boolean;
  /** Small heading shown beside the page links (e.g. "Browse by page"). */
  label?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const hrefFor = (target: number) => {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) sp.set(key, value);
    }
    if (target > 1) sp.set('page', String(target));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  // Nothing to link to: an empty listing, or one that fits on a single page
  // and therefore needs no page links at all.
  if (total === 0 || (!showSummary && totalPages <= 1)) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-6">
      {showSummary ? (
        <p className="text-xs text-muted-foreground">
          Showing {from}–{to} of {total} products
        </p>
      ) : (
        <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
          {label ?? 'Browse by page'}
        </p>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <PageLink href={hrefFor(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </PageLink>

          {pageWindow(page, totalPages).map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <PageLink key={p} href={hrefFor(p)} current={p === page} aria-label={`Page ${p}`}>
                {p}
              </PageLink>
            ),
          )}

          <PageLink href={hrefFor(page + 1)} disabled={page >= totalPages} aria-label="Next page">
            <ChevronRight className="size-4" />
          </PageLink>
        </nav>
      ) : null}
    </div>
  );
}

function PageLink({
  href,
  current = false,
  disabled = false,
  children,
  ...rest
}: {
  href: string;
  current?: boolean;
  disabled?: boolean;
  children: ReactNode;
} & AriaAttributes) {
  const className = cn(
    buttonVariants({ variant: current ? 'primary' : 'outline', size: 'sm' }),
    'min-w-9 px-2.5',
    disabled && 'pointer-events-none opacity-40',
  );
  if (disabled) {
    return (
      <span aria-disabled className={className} {...rest}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-current={current ? 'page' : undefined} className={className} {...rest}>
      {children}
    </Link>
  );
}

/** First, last, current ±1, with ellipsis gaps. */
function pageWindow(current: number, total: number): Array<number | 'ellipsis'> {
  const wanted = new Set<number>([1, total, current, current - 1, current + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | 'ellipsis'> = [];
  let prev = 0;
  for (const p of pages) {
    if (p - prev > 1) out.push('ellipsis');
    out.push(p);
    prev = p;
  }
  return out;
}
