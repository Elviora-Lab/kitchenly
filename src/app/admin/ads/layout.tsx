import { Suspense } from 'react';

import { buildMetadata } from '@/lib/seo/metadata';

import { AdsNav } from './ads-nav';

import { adsInsightsEnabled } from '@/server/analytics/meta-ads';

export const metadata = buildMetadata({ title: 'Admin · Ad Performance', noIndex: true });
export const dynamic = 'force-dynamic';

export default function AdsLayout({ children }: { children: React.ReactNode }) {
  const configured = adsInsightsEnabled();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="editorial-heading text-display-md">Ad Performance</h1>
        <p className="text-sm text-muted-foreground">
          Spend, ROAS, funnel and conversions from Meta Ads.
        </p>
        <p className="text-xs text-muted-foreground">
          Meta reporting day: 12:00 PM to 11:59 AM Pakistan time.
        </p>
      </header>

      {configured ? (
        <Suspense fallback={<div className="h-10 border-b border-border" />}>
          <AdsNav />
        </Suspense>
      ) : null}

      {children}
    </div>
  );
}
