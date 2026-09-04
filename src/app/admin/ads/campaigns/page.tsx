import { parseAdDateSelection } from '@/lib/ads/date-presets';
import { cn } from '@/lib/cn';

import { AdsErrorCard, SetupCard } from '../ads-shared';
import { CampaignsTable } from '../campaigns-table';
import { BreakdownBarChart } from '../charts/breakdown-bar-chart';
import { intText, money, roasText } from '../format';

import { adsInsightsEnabled, getAdsCampaignsData, type TopAd } from '@/server/analytics/meta-ads';

type Props = { searchParams: Promise<{ range?: string; from?: string; to?: string }> };

export default async function AdminAdsCampaignsPage({ searchParams }: Props) {
  const range = parseAdDateSelection(await searchParams);

  if (!adsInsightsEnabled()) return <SetupCard />;

  const result = await getAdsCampaignsData(range);
  if (!result.ok) return <AdsErrorCard error={result.error} />;

  const { campaigns, topAds, currency } = result.data;

  // Reuse the breakdown bar chart for a "top campaigns by spend" view.
  const chartRows = campaigns
    .filter((c) => c.spend > 0)
    .map((c) => ({
      label: c.campaignName,
      spend: c.spend,
      revenue: c.revenue,
      roas: c.roas,
      purchases: c.purchases,
    }));

  return (
    <div className="flex flex-col gap-8">
      {chartRows.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Top campaigns by spend
          </h2>
          <div className="rounded-lg border border-border bg-card p-4">
            <BreakdownBarChart rows={chartRows} currency={currency} />
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          All campaigns
        </h2>
        <CampaignsTable campaigns={campaigns} currency={currency} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Top ads by spend
        </h2>
        <TopAds ads={topAds} currency={currency} />
      </section>
    </div>
  );
}

function TopAds({ ads, currency }: { ads: TopAd[]; currency: string }) {
  if (!ads.length) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        No ad-level data for this window.
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ads.map((ad) => (
        <div
          key={ad.adId}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
        >
          <span className="relative size-12 shrink-0 overflow-hidden rounded bg-muted">
            {ad.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Meta fbcdn thumbnails, not app assets
              <img src={ad.thumbnailUrl} alt="" className="size-full object-cover" />
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium" title={ad.adName}>
              {ad.adName}
            </div>
            <div className="truncate text-xs text-muted-foreground" title={ad.campaignName}>
              {ad.campaignName}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium tabular-nums">{money(ad.spend, currency)}</div>
            <div
              className={cn(
                'text-xs tabular-nums',
                ad.spend > 0 && ad.roas < 1 ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {roasText(ad.roas)} · {intText(ad.purchases)} sales
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
