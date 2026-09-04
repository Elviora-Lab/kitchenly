import { adDateSelectionToSearchParams, parseAdDateSelection } from '@/lib/ads/date-presets';
import { cn } from '@/lib/cn';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { AdsErrorCard, SetupCard } from '../ads-shared';
import { CampaignFilter } from '../campaign-filter';
import { FunnelChart, type FunnelStage } from '../charts/funnel-chart';
import { intText } from '../format';

import {
  adsInsightsEnabled,
  getAdsCampaignOptions,
  getAdsSummary,
} from '@/server/analytics/meta-ads';

type Props = {
  searchParams: Promise<{ range?: string; from?: string; to?: string; campaign?: string }>;
};

export default async function AdminAdsFunnelPage({ searchParams }: Props) {
  const { campaign, ...dateParams } = await searchParams;
  const range = parseAdDateSelection(dateParams);

  if (!adsInsightsEnabled()) return <SetupCard />;

  const [result, campaignOptions] = await Promise.all([
    getAdsSummary(range, campaign),
    getAdsCampaignOptions(range),
  ]);
  if (!result.ok) return <AdsErrorCard error={result.error} />;

  const { account } = result.data;
  const selectedCampaign = campaign ? campaignOptions.find((c) => c.id === campaign) : undefined;
  const f = account.funnel;
  const stages: FunnelStage[] = [
    { label: 'Link clicks', value: f.linkClicks || account.clicks },
    { label: 'View content', value: f.viewContent },
    { label: 'Add to cart', value: f.addToCart },
    { label: 'Checkout', value: f.checkout },
    { label: 'Purchases', value: f.purchases },
  ];

  const top = stages[0]?.value ?? 0;
  const overall = top > 0 ? (f.purchases / top) * 100 : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Campaign scope */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CampaignFilter
          dateQuery={adDateSelectionToSearchParams(range)}
          campaignId={campaign}
          options={campaignOptions}
        />
        {selectedCampaign ? (
          <span className="text-xs text-muted-foreground">
            Scoped to <span className="font-medium text-foreground">{selectedCampaign.name}</span>
          </span>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <CardTitle className="text-xl">Conversion funnel</CardTitle>
              <CardDescription>
                {selectedCampaign
                  ? `Where "${selectedCampaign.name}" visitors drop off, from click to purchase.`
                  : 'Where ad-driven visitors drop off, from click to purchase (all campaigns).'}
              </CardDescription>
            </div>
            {overall !== null ? (
              <div className="text-right">
                <div className="text-2xl font-semibold tabular-nums">{overall.toFixed(1)}%</div>
                <div className="text-[11px] text-muted-foreground">click → purchase</div>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <FunnelChart stages={stages} />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Stage-by-stage drop-off
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Stage</th>
                <th className="px-4 py-2.5 text-right font-medium">People</th>
                <th className="px-4 py-2.5 text-right font-medium">From previous</th>
                <th className="px-4 py-2.5 text-right font-medium">From top</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {stages.map((s, i) => {
                const prev = i > 0 ? (stages[i - 1]?.value ?? 0) : null;
                const fromPrev = prev && prev > 0 ? (s.value / prev) * 100 : null;
                const fromTop = top > 0 ? (s.value / top) * 100 : null;
                return (
                  <tr key={s.label} className="transition-colors hover:bg-muted/50">
                    <td className="px-4 py-2.5 font-medium">{s.label}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{intText(s.value)}</td>
                    <td
                      className={cn(
                        'px-4 py-2.5 text-right tabular-nums',
                        fromPrev !== null && fromPrev < 20 ? 'text-destructive' : '',
                      )}
                    >
                      {fromPrev !== null ? `${fromPrev.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {fromTop !== null ? `${fromTop.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
