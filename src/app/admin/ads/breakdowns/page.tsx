import { parseAdDateSelection } from '@/lib/ads/date-presets';

import { AdsErrorCard, SetupCard } from '../ads-shared';
import { BreakdownTabs } from '../breakdown-tabs';

import { adsInsightsEnabled, getAdsBreakdownsData } from '@/server/analytics/meta-ads';

type Props = { searchParams: Promise<{ range?: string; from?: string; to?: string }> };

export default async function AdminAdsBreakdownsPage({ searchParams }: Props) {
  const range = parseAdDateSelection(await searchParams);

  if (!adsInsightsEnabled()) return <SetupCard />;

  const result = await getAdsBreakdownsData(range);
  if (!result.ok) return <AdsErrorCard error={result.error} />;

  const { breakdowns, currency } = result.data;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Breakdowns
        </h2>
        <p className="text-sm text-muted-foreground">
          Spend and ROAS split by placement, audience and device — chart shows the top segments by
          spend, the table lists them all.
        </p>
      </div>
      <BreakdownTabs breakdowns={breakdowns} currency={currency} />
    </section>
  );
}
