'use client';

import { useRouter } from 'next/navigation';

import type { CampaignOption } from '@/server/analytics/meta-ads';

/**
 * Campaign scope selector for the funnel. Native select for reliability; writes
 * `?campaign=<id>` (preserving the current reporting window) and lets the RSC refetch
 * the funnel scoped to that campaign. "All campaigns" clears the scope.
 */
export function CampaignFilter({
  dateQuery,
  campaignId,
  options,
}: {
  dateQuery: string;
  campaignId?: string;
  options: CampaignOption[];
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="hidden sm:inline">Campaign</span>
      <select
        value={campaignId ?? ''}
        onChange={(e) => {
          const params = new URLSearchParams(dateQuery);
          if (e.target.value) params.set('campaign', e.target.value);
          router.push(`/admin/ads/funnel?${params.toString()}`);
        }}
        className="max-w-[240px] truncate rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All campaigns</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
