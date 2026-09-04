import { ArrowDown, ArrowUp } from 'lucide-react';

import { parseAdDateSelection } from '@/lib/ads/date-presets';
import { cn } from '@/lib/cn';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { AdsErrorCard, SetupCard } from './ads-shared';
import { RoasChart } from './charts/roas-chart';
import { SpendRevenueChart } from './charts/spend-revenue-chart';
import { deltaPct, intText, money, roasText } from './format';

import {
  type AdsInsight,
  adsInsightsEnabled,
  getAdsSummary,
  presetToDateRange,
} from '@/server/analytics/meta-ads';
import { adminAnalyticsRepo } from '@/server/repositories/admin.repo';

type StoreSales = { revenue: number; orders: number; currency: string };
type Props = { searchParams: Promise<{ range?: string; from?: string; to?: string }> };

export default async function AdminAdsOverviewPage({ searchParams }: Props) {
  const range = parseAdDateSelection(await searchParams);

  if (!adsInsightsEnabled()) return <SetupCard />;

  const result = await getAdsSummary(range);
  if (!result.ok) return <AdsErrorCard error={result.error} />;

  const { account, previous, previousLabel, currency, accountName, daily } = result.data;

  // Real store sales for the same window — to reconcile against Meta's attributed
  // numbers. Best-effort: never let it break the page.
  let storeSales: StoreSales | null = null;
  try {
    const { since, until } = presetToDateRange(range);
    storeSales = await adminAnalyticsRepo.salesForRange(since, until);
  } catch {
    storeSales = null;
  }

  const tiles = [
    {
      label: 'Amount spent',
      value: money(account.spend, currency),
      delta: <DeltaBadge current={account.spend} previous={previous?.spend} goodDirection="none" />,
      sub: previousLabel,
    },
    {
      label: 'Purchase revenue',
      value: money(account.revenue, currency),
      delta: <DeltaBadge current={account.revenue} previous={previous?.revenue} />,
      sub: `${intText(account.purchases)} purchase${account.purchases === 1 ? '' : 's'}`,
    },
    {
      label: 'ROAS',
      value: roasText(account.roas),
      delta: <DeltaBadge current={account.roas} previous={previous?.roas} />,
      sub: account.roas >= 1 ? 'Profitable on ad spend' : 'Below break-even',
      danger: account.roas < 1,
    },
    {
      label: 'Cost per purchase',
      value: account.purchases > 0 ? money(account.costPerPurchase, currency) : '—',
      delta: (
        <DeltaBadge
          current={account.costPerPurchase}
          previous={previous?.costPerPurchase}
          goodDirection="none"
        />
      ),
      sub: 'Spend ÷ purchases',
    },
  ];

  const secondary = [
    { label: 'Impressions', value: intText(account.impressions) },
    { label: 'Reach', value: intText(account.reach) },
    { label: 'Clicks', value: intText(account.clicks) },
    { label: 'CTR', value: `${account.ctr.toFixed(2)}%` },
    { label: 'CPC', value: money(account.cpc, currency) },
    { label: 'CPM', value: money(account.cpm, currency) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <p className="-mt-4 text-xs uppercase tracking-[0.12em] text-muted-foreground">
        {accountName}
      </p>

      {/* Headline tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardHeader>
              <CardDescription>{t.label}</CardDescription>
              <div className="flex items-baseline gap-2">
                <CardTitle
                  className={cn(
                    'text-3xl tabular-nums',
                    'danger' in t && t.danger ? 'text-destructive' : '',
                  )}
                >
                  {t.value}
                </CardTitle>
                {t.delta}
              </div>
              <p className="text-xs text-muted-foreground">{t.sub}</p>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* True performance: Meta's attributed numbers vs real store orders */}
      {storeSales ? (
        <Reconciliation account={account} storeSales={storeSales} metaCurrency={currency} />
      ) : null}

      {/* Trend — two single-axis charts side by side (never one dual-axis plot) */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Performance over time
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-medium">Spend vs revenue</h3>
            <SpendRevenueChart daily={daily} currency={currency} />
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-medium">ROAS</h3>
            <RoasChart daily={daily} />
          </div>
        </div>
      </section>

      {/* Delivery metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {secondary.map((s) => (
          <Card key={s.label}>
            <CardHeader className="p-4">
              <CardDescription className="text-xs">{s.label}</CardDescription>
              <CardTitle className="text-lg tabular-nums">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DeltaBadge({
  current,
  previous,
  goodDirection = 'up',
}: {
  current: number;
  previous: number | null | undefined;
  goodDirection?: 'up' | 'none';
}) {
  const pct = deltaPct(current, previous);
  if (pct === null) return null;
  const up = pct >= 0;
  const good = goodDirection === 'none' ? null : up === (goodDirection === 'up');
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
        good === null ? 'text-muted-foreground' : good ? 'text-success' : 'text-destructive',
      )}
    >
      {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function Reconciliation({
  account,
  storeSales,
  metaCurrency,
}: {
  account: AdsInsight;
  storeSales: StoreSales;
  metaCurrency: string;
}) {
  const sameCurrency = metaCurrency === storeSales.currency;
  const blendedRoas = account.spend > 0 ? storeSales.revenue / account.spend : 0;
  const orderShare = storeSales.orders > 0 ? (account.purchases / storeSales.orders) * 100 : null;

  const tiles = [
    {
      label: 'Real store orders',
      value: intText(storeSales.orders),
      sub: `${money(storeSales.revenue, storeSales.currency)} recognized revenue`,
    },
    {
      label: 'Meta claims credit for',
      value: orderShare !== null ? `${orderShare.toFixed(0)}%` : '—',
      sub: `${intText(account.purchases)} of ${intText(storeSales.orders)} orders attributed`,
    },
    {
      label: 'Blended ROAS (MER)',
      value: sameCurrency ? roasText(blendedRoas) : '—',
      sub: sameCurrency ? 'All store revenue ÷ ad spend' : 'Currencies differ — see note',
    },
    {
      label: 'Meta-reported ROAS',
      value: roasText(account.roas),
      sub: 'What Meta attributes',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">True performance</CardTitle>
        <CardDescription>
          Meta’s attributed numbers vs your real store orders for this window.
        </CardDescription>
      </CardHeader>
      <div className="flex flex-col gap-4 p-6 pt-0">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div className="text-xs text-muted-foreground">{t.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{t.value}</div>
              <div className="text-[11px] text-muted-foreground">{t.sub}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {sameCurrency ? (
            <>
              Blended ROAS (MER) counts <strong>all</strong> store revenue against ad spend — the
              honest efficiency of your marketing, organic included. Meta-reported ROAS only counts
              sales it attributes to a click/view and usually over-states its impact.
            </>
          ) : (
            <>
              Ad spend is in {metaCurrency} but store revenue is in {storeSales.currency}, so
              blended ROAS isn’t shown (mixing currencies would mislead). Set your Meta ad account
              to the same currency as your store to enable it.
            </>
          )}
        </p>
      </div>
    </Card>
  );
}
