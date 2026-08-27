import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { pctText } from '@/lib/analytics/intent';
import { cn } from '@/lib/cn';
import { buildMetadata } from '@/lib/seo/metadata';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { CustomerGeoChart } from './_components/customer-geo-chart';
import { GaOverview } from './_components/ga-overview';

import { getCustomerGeo } from '@/server/analytics/customer-geo';
import { DEFAULT_GA_RANGE, isGaRange } from '@/server/analytics/ga-data-api';
import { adminAnalyticsRepo } from '@/server/repositories/admin.repo';

export const metadata = buildMetadata({ title: 'Admin · Analytics', noIndex: true });
export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 30;

const pct = (num: number, denom: number) =>
  denom > 0 ? `${((num / denom) * 100).toFixed(1)}%` : '—';

type Ranked = { id: string; name: string; slug: string; imageUrl: string; count: number };

const money = (value: number, currency = 'PKR') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);

function ProductRankList({
  title,
  description,
  rows,
  unit,
}: {
  title: string;
  description: string;
  rows: Ranked[];
  unit: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            No activity yet in the last {WINDOW_DAYS} days.
          </p>
        ) : (
          <ol className="divide-y divide-border/60">
            {rows.map((p, i) => (
              <li key={p.id}>
                <Link
                  href={`/admin/products/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                >
                  <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}</span>
                  <span className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">
                    {p.imageUrl ? (
                      <Image
                        src={p.imageUrl}
                        alt={p.name}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                  <span className="text-sm font-medium tabular-nums">
                    {p.count.toLocaleString()}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function SignalPill({ signal }: { signal: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
        signal === 'Scale winner'
          ? 'bg-success/15 text-success'
          : signal.includes('Fix')
            ? 'bg-destructive/10 text-destructive'
            : 'bg-muted text-muted-foreground',
      )}
    >
      {signal}
    </span>
  );
}

function ProductIntentTable({
  rows,
}: {
  rows: Awaited<ReturnType<typeof adminAnalyticsRepo.productIntent>>;
}) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No product intent data yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Product</th>
            <th className="px-4 py-2.5 text-right font-medium">Score</th>
            <th className="px-4 py-2.5 text-right font-medium">View → cart</th>
            <th className="px-4 py-2.5 text-right font-medium">Cart → order</th>
            <th className="px-4 py-2.5 text-right font-medium">Revenue</th>
            <th className="px-4 py-2.5 font-medium">Signal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-muted/40">
              <td className="px-4 py-3">
                <Link
                  href={`/admin/products/${p.id}`}
                  className="flex min-w-0 items-center gap-3 hover:underline"
                >
                  <span className="relative size-9 shrink-0 overflow-hidden rounded bg-muted">
                    {p.imageUrl ? (
                      <Image src={p.imageUrl} alt="" fill sizes="36px" className="object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.category ?? 'Uncategorised'} · {p.views.toLocaleString()} views ·{' '}
                      {p.carts.toLocaleString()} carts · {p.purchases.toLocaleString()} orders
                    </span>
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3 text-right font-medium tabular-nums">{p.score}</td>
              <td className="px-4 py-3 text-right tabular-nums">{pctText(p.cartRate)}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {p.carts > 0 ? pctText(p.cartToPurchaseRate) : '—'}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{money(p.revenue)}</td>
              <td className="px-4 py-3">
                <SignalPill signal={p.signal} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompactRows({
  rows,
  empty,
}: {
  rows: Array<{ label: string; value: string; sub?: string; danger?: boolean }>;
  empty: string;
}) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="divide-y divide-border/60">
      {rows.map((r) => (
        <div key={`${r.label}-${r.sub ?? ''}`} className="flex items-center gap-3 py-2.5 text-sm">
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{r.label}</div>
            {r.sub ? <div className="truncate text-xs text-muted-foreground">{r.sub}</div> : null}
          </div>
          <div
            className={cn(
              'shrink-0 text-right font-medium tabular-nums',
              r.danger ? 'text-destructive' : '',
            )}
          >
            {r.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; country?: string }>;
}) {
  const sp = await searchParams;
  const range = isGaRange(sp.range) ? sp.range : DEFAULT_GA_RANGE;
  const country = sp.country;
  const [
    funnel,
    topViewed,
    topAddedToCart,
    topSearches,
    zeroResults,
    surveys,
    geo,
    productIntent,
    searchIntent,
    cityPerformance,
    utmPerformance,
    abandonedCart,
  ] = await Promise.all([
    adminAnalyticsRepo.funnel(WINDOW_DAYS),
    adminAnalyticsRepo.topViewed(WINDOW_DAYS),
    adminAnalyticsRepo.topAddedToCart(WINDOW_DAYS),
    adminAnalyticsRepo.topSearches(WINDOW_DAYS),
    adminAnalyticsRepo.zeroResultSearches(WINDOW_DAYS),
    adminAnalyticsRepo.surveyBreakdown(WINDOW_DAYS),
    getCustomerGeo(WINDOW_DAYS),
    adminAnalyticsRepo.productIntent(WINDOW_DAYS),
    adminAnalyticsRepo.searchIntent(WINDOW_DAYS),
    adminAnalyticsRepo.cityPerformance(WINDOW_DAYS),
    adminAnalyticsRepo.utmPerformance(WINDOW_DAYS),
    adminAnalyticsRepo.abandonedCartPressure(WINDOW_DAYS),
  ]);

  // Group survey answers by question for the feedback card.
  const SURVEY_META: Record<string, { title: string; desc: string }> = {
    why_not_buy: {
      title: 'Why shoppers hesitate',
      desc: 'On-site "anything holding you back?" survey — the direct reason people don’t order.',
    },
    how_heard: {
      title: 'How customers heard about us',
      desc: 'Asked right after purchase — where your buyers actually come from.',
    },
  };
  const surveyGroups = new Map<string, Array<{ answer: string; count: number }>>();
  for (const r of surveys) {
    const arr = surveyGroups.get(r.question) ?? [];
    arr.push({ answer: r.answer, count: r.count });
    surveyGroups.set(r.question, arr);
  }

  const tiles = [
    { label: 'Product views', value: funnel.views, sub: `Last ${WINDOW_DAYS} days` },
    {
      label: 'Add-to-carts',
      value: funnel.cartAdds,
      sub: `${pct(funnel.cartAdds, funnel.views)} of views`,
    },
    {
      label: 'Orders',
      value: funnel.orders,
      sub: `${pct(funnel.orders, funnel.cartAdds)} of carts`,
    },
  ];
  const scaleWinners = productIntent.filter((p) => p.signal === 'Scale winner').slice(0, 4);
  const fixList = productIntent.filter((p) => p.signal.includes('Fix')).slice(0, 4);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="editorial-heading text-display-md">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Traffic and merchandising performance over the last {WINDOW_DAYS} days.
        </p>
      </header>

      {/* Live Google Analytics (GA4 Data API) — loads independently. */}
      <Suspense
        key={`${range}-${country ?? 'all'}`}
        fallback={
          <div className="h-40 animate-pulse rounded-lg border border-border bg-muted/40" />
        }
      >
        <GaOverview range={range} country={country} />
      </Suspense>

      <div className="border-t border-border pt-2">
        <h2 className="editorial-heading text-display-sm">First-party events</h2>
        <p className="text-sm text-muted-foreground">
          Measured server-side from your own database (ad-blocker-proof).
        </p>
      </div>

      {/* Funnel */}
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardHeader>
              <CardDescription>{t.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{t.value.toLocaleString()}</CardTitle>
              <p className="text-xs text-muted-foreground">{t.sub}</p>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Targeting cockpit */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Scale now</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{scaleWinners.length}</CardTitle>
            <p className="text-xs text-muted-foreground">Products with buying signal</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Fix before scaling</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-destructive">
              {fixList.length}
            </CardTitle>
            <p className="text-xs text-muted-foreground">High intent, weak conversion</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Abandoned cart value</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{money(abandonedCart.value)}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {abandonedCart.staleCarts.toLocaleString()} carts older than 24h
            </p>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Product intent map</CardTitle>
          <CardDescription>
            Ranked by views, cart adds and real orders. Use Scale winner products for prospecting;
            fix PDP or checkout/offer products before spending more.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ProductIntentTable rows={productIntent} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Retargeting pressure</CardTitle>
            <CardDescription>
              Active carts still carrying products. Stale carts are ready for reminder/retargeting
              audiences.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Carts</div>
                <div className="text-xl font-semibold tabular-nums">
                  {abandonedCart.carts.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Items</div>
                <div className="text-xl font-semibold tabular-nums">
                  {abandonedCart.items.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Value</div>
                <div className="text-xl font-semibold tabular-nums">
                  {money(abandonedCart.value)}
                </div>
              </div>
            </div>
            <CompactRows
              empty="No active carts with items in this window."
              rows={abandonedCart.topProducts.map((p) => ({
                label: p.name,
                sub: `${p.carts.toLocaleString()} carts · ${p.quantity.toLocaleString()} items`,
                value: money(p.value),
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Demand map</CardTitle>
            <CardDescription>
              Search language customers use. High zero-result count means missing demand or naming
              mismatch.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompactRows
              empty="No searches yet in this window."
              rows={searchIntent.map((s) => ({
                label: s.keyword,
                sub: `${s.count.toLocaleString()} searches · avg ${s.avgResults.toFixed(1)} results`,
                value: s.zeroResults ? `${s.zeroResults} empty` : 'matched',
                danger: s.zeroResults > 0,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">City targeting</CardTitle>
            <CardDescription>
              Where buyers convert and how much they spend per order.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompactRows
              empty="No city-level orders in this window."
              rows={cityPerformance.map((c) => ({
                label: c.city,
                sub: `${c.orders.toLocaleString()} orders · AOV ${money(c.avgOrderValue)}`,
                value: money(c.revenue),
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Source and campaign quality</CardTitle>
            <CardDescription>
              Last-touch UTM orders. Use this as the first-party check against ad platform claims.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompactRows
              empty="No UTM-tagged orders in this window."
              rows={utmPerformance.map((u) => ({
                label: u.campaign,
                sub: `${u.source} · ${u.orders.toLocaleString()} orders · AOV ${money(u.avgOrderValue)}`,
                value: money(u.revenue),
              }))}
            />
          </CardContent>
        </Card>
      </div>

      {/* Product rankings */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ProductRankList
          title="Most viewed"
          description="Which products customers are visiting."
          rows={topViewed}
          unit="views"
        />
        <ProductRankList
          title="Most added to cart"
          description="Which products customers are adding to cart."
          rows={topAddedToCart}
          unit="adds"
        />
      </div>

      {/* Customer geography — where actual buyers are (first-party shipping data) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Customers by city</CardTitle>
          <CardDescription>
            Where orders ship to over the last {WINDOW_DAYS} days — your real buyers, from
            first-party checkout data. (Meta&apos;s Country/Region tabs on{' '}
            <Link href="/admin/ads" className="underline underline-offset-2 hover:text-foreground">
              Ad Performance
            </Link>{' '}
            show the aggregate geography your ads reached.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {geo.cities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No orders with a shipping city in the last {WINDOW_DAYS} days.
            </p>
          ) : (
            <CustomerGeoChart rows={geo.cities} currency={geo.currency} />
          )}
        </CardContent>
      </Card>

      {/* Customer feedback — zero-party survey answers */}
      {surveyGroups.size > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {[...surveyGroups.entries()].map(([question, answers]) => {
            const meta = SURVEY_META[question] ?? { title: question, desc: 'Survey responses.' };
            const total = answers.reduce((sum, a) => sum + a.count, 0);
            return (
              <Card key={question}>
                <CardHeader>
                  <CardTitle className="text-xl">{meta.title}</CardTitle>
                  <CardDescription>{meta.desc}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2.5">
                  {answers.map((a) => (
                    <div key={a.answer} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between text-sm">
                        <span>{a.answer}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {a.count} · {total > 0 ? Math.round((a.count / total) * 100) : 0}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground/60"
                          style={{ width: `${total > 0 ? (a.count / total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* Searched but not found — unmet demand */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Searched but not found</CardTitle>
          <CardDescription>
            Queries that returned nothing — products you don&apos;t stock yet, or that customers
            can&apos;t find under the name they used. A strong signal for what to add or rename.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {zeroResults.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No empty searches in the last {WINDOW_DAYS} days.
            </p>
          ) : (
            <ol className="divide-y divide-border/60">
              {zeroResults.map((s, i) => (
                <li key={s.keyword} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{s.keyword}</span>
                  <span className="font-medium tabular-nums text-destructive">
                    {s.count.toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Searches */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Top searches</CardTitle>
          <CardDescription>What customers are looking for.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {topSearches.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No searches yet in the last {WINDOW_DAYS} days.
            </p>
          ) : (
            <ol className="divide-y divide-border/60">
              {topSearches.map((s, i) => (
                <li key={s.keyword} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{s.keyword}</span>
                  <span className="font-medium tabular-nums">{s.count.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
