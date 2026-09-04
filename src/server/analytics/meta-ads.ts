import 'server-only';

import { unstable_cache } from 'next/cache';

import { serverEnv } from '@/config/env';

import {
  type AdDatePreset,
  type AdDateSelection,
  adPresetToDateRange,
  adPresetToDateWindow,
  adPresetToPreviousDateWindow,
} from '@/lib/ads/date-presets';

/**
 * Meta Marketing API — read-only ad performance (Insights).
 *
 * Pulls spend, ROAS, revenue, funnel drop-off and delivery metrics for the
 * configured ad account so the admin can see campaign performance without
 * leaving the app. The conversions that feed ROAS here are the same Purchase
 * events the pixel + Conversions API report.
 *
 * Read-only: needs a System User token with `ads_read` (no write scope). Stays
 * completely inert unless `META_ADS_ACCESS_TOKEN` and `META_ADS_ACCOUNT_ID`
 * are configured — the dashboard renders a setup card instead.
 */

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Ad metrics move slowly (Meta aggregates over hours), so the dashboard is served
// from a short-lived server cache instead of hitting the Graph API on every admin
// page load — keeping it snappy and well under Meta's rate limits.
const ADS_CACHE_TTL = 600; // seconds (10 min)

export function adsInsightsEnabled(): boolean {
  return Boolean(serverEnv.META_ADS_ACCESS_TOKEN && serverEnv.META_ADS_ACCOUNT_ID);
}

/** `act_` prefix is what the Graph API expects; tolerate the id given either way. */
function accountPath(): string {
  const id = (serverEnv.META_ADS_ACCOUNT_ID ?? '').trim();
  return id.startsWith('act_') ? id : `act_${id}`;
}

// Date-range presets live in a client-safe module so the dashboard's client
// components can share them without importing this `server-only` file. Re-export
// here so server-side callers keep a single import surface.
export type { AdDatePreset, AdDateSelection } from '@/lib/ads/date-presets';
export {
  AD_DATE_PRESET_LABELS,
  AD_DATE_PRESETS,
  AD_RANGE_TABS,
  DEFAULT_AD_RANGE,
  isAdDatePreset,
} from '@/lib/ads/date-presets';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdsFunnel = {
  /** Outbound/link clicks to the site. */
  linkClicks: number;
  landingPageViews: number;
  viewContent: number;
  addToCart: number;
  checkout: number;
  purchases: number;
};

export type AdsInsight = {
  spend: number;
  revenue: number;
  /** Return on ad spend — Meta's attributed number when present, else revenue/spend. */
  roas: number;
  purchases: number;
  /** Cost per purchase (spend / purchases). */
  costPerPurchase: number;
  impressions: number;
  reach: number;
  clicks: number;
  /** Click-through rate, already a percentage. */
  ctr: number;
  /** Cost per click. */
  cpc: number;
  /** Cost per 1,000 impressions. */
  cpm: number;
  funnel: AdsFunnel;
};

export type CampaignInsight = AdsInsight & {
  campaignId: string;
  campaignName: string;
  /** Raw Meta effective_status (ACTIVE, PAUSED, ARCHIVED…). '' if unknown. */
  status: string;
  isActive: boolean;
  objective: string;
};

export type BreakdownRow = {
  label: string;
  spend: number;
  revenue: number;
  roas: number;
  purchases: number;
};

export type AdsBreakdowns = {
  placement: BreakdownRow[];
  demographic: BreakdownRow[];
  device: BreakdownRow[];
  /** Country of the reached audience (ISO code). Aggregate, ad-attributed only. */
  country: BreakdownRow[];
  /** Sub-national region (province/state) of the reached audience. */
  region: BreakdownRow[];
};

export type TopAd = {
  adId: string;
  adName: string;
  campaignName: string;
  spend: number;
  revenue: number;
  roas: number;
  purchases: number;
  thumbnailUrl: string | null;
};

export type DailyPoint = {
  date: string;
  spend: number;
  revenue: number;
  roas: number;
};

/**
 * The dashboard is split into independent sub-pages ("submodules"), so the data
 * is fetched in matching slices — each sub-page pays only for the Graph calls it
 * renders, instead of one monolithic call powering a single mega-page.
 */

/** Overview submodule: headline metrics, prior-period deltas and the daily trend. */
export type AdsSummary = {
  currency: string;
  accountName: string;
  account: AdsInsight;
  /** Prior equal-length window for delta indicators; null when not applicable. */
  previous: AdsInsight | null;
  previousLabel: string | null;
  /** Per-day spend/revenue/ROAS for the trend charts. */
  daily: DailyPoint[];
};

/** Breakdowns submodule: spend/ROAS split by placement, demographic and device. */
export type AdsBreakdownsData = {
  currency: string;
  breakdowns: AdsBreakdowns;
};

/** Campaigns submodule: per-campaign performance and the top ads by spend. */
export type AdsCampaignsData = {
  currency: string;
  campaigns: CampaignInsight[];
  topAds: TopAd[];
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type AdsSummaryResult = Result<AdsSummary>;
export type AdsBreakdownsResult = Result<AdsBreakdownsData>;
export type AdsCampaignsResult = Result<AdsCampaignsData>;

// ---------------------------------------------------------------------------
// Action-type parsing
// ---------------------------------------------------------------------------

type ActionRow = { action_type: string; value: string };

type InsightRow = {
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: ActionRow[];
  action_values?: ActionRow[];
  purchase_roas?: ActionRow[];
  campaign_id?: string;
  campaign_name?: string;
  ad_id?: string;
  ad_name?: string;
  publisher_platform?: string;
  age?: string;
  gender?: string;
  impression_device?: string;
  country?: string;
  region?: string;
  date_start?: string;
};

// Meta reports each conversion under several action types depending on channel
// and attribution. Prefer the deduplicated omni_ metric, then the pixel one,
// then the generic — pick ONE (never sum, or the same event is double-counted).
const PURCHASE_TYPES = [
  'omni_purchase',
  'offsite_conversion.fb_pixel_purchase',
  'purchase',
] as const;
const VIEW_CONTENT_TYPES = [
  'omni_view_content',
  'offsite_conversion.fb_pixel_view_content',
  'view_content',
] as const;
const ADD_TO_CART_TYPES = [
  'omni_add_to_cart',
  'offsite_conversion.fb_pixel_add_to_cart',
  'add_to_cart',
] as const;
const CHECKOUT_TYPES = [
  'omni_initiated_checkout',
  'offsite_conversion.fb_pixel_initiate_checkout',
  'initiate_checkout',
] as const;
const LPV_TYPES = ['landing_page_view'] as const;
const LINK_CLICK_TYPES = ['link_click'] as const;

function pick(rows: ActionRow[] | undefined, priority: readonly string[]): number {
  if (!rows?.length) return 0;
  for (const type of priority) {
    const row = rows.find((r) => r.action_type === type);
    if (row) return Number(row.value) || 0;
  }
  return 0;
}

function num(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toFunnel(row: InsightRow | undefined): AdsFunnel {
  return {
    linkClicks: pick(row?.actions, LINK_CLICK_TYPES),
    landingPageViews: pick(row?.actions, LPV_TYPES),
    viewContent: pick(row?.actions, VIEW_CONTENT_TYPES),
    addToCart: pick(row?.actions, ADD_TO_CART_TYPES),
    checkout: pick(row?.actions, CHECKOUT_TYPES),
    purchases: pick(row?.actions, PURCHASE_TYPES),
  };
}

function toInsight(row: InsightRow | undefined): AdsInsight {
  const spend = num(row?.spend);
  const revenue = pick(row?.action_values, PURCHASE_TYPES);
  const purchases = pick(row?.actions, PURCHASE_TYPES);
  const attributedRoas = pick(row?.purchase_roas, PURCHASE_TYPES);
  return {
    spend,
    revenue,
    roas: attributedRoas > 0 ? attributedRoas : spend > 0 ? revenue / spend : 0,
    purchases,
    costPerPurchase: purchases > 0 ? spend / purchases : 0,
    impressions: num(row?.impressions),
    reach: num(row?.reach),
    clicks: num(row?.clicks),
    ctr: num(row?.ctr),
    cpc: num(row?.cpc),
    cpm: num(row?.cpm),
    funnel: toFunnel(row),
  };
}

function toBreakdownRow(row: InsightRow, label: string): BreakdownRow {
  const i = toInsight(row);
  return { label, spend: i.spend, revenue: i.revenue, roas: i.roas, purchases: i.purchases };
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

const INSIGHT_FIELDS =
  'spend,impressions,reach,clicks,ctr,cpc,cpm,actions,action_values,purchase_roas';
const BREAKDOWN_FIELDS = 'spend,actions,action_values,purchase_roas';

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = serverEnv.META_ADS_ACCESS_TOKEN as string;
  const url = new URL(`${GRAPH_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  // Use the ad account's configured attribution setting on every Insights read so
  // the dashboard's spend/ROAS/purchases reconcile with what Ads Manager shows.
  // Without this the API falls back to a legacy window (7d-click/1d-view) that can
  // silently disagree with Meta's UI.
  if (path.endsWith('/insights')) url.searchParams.set('use_unified_attribution_setting', 'true');
  url.searchParams.set('access_token', token);

  const res = await fetch(url, { cache: 'no-store' });
  const body = (await res.json().catch(() => null)) as
    | { error?: { message?: string } }
    | (T & { error?: undefined })
    | null;

  if (!res.ok || (body && 'error' in body && body.error)) {
    const message = body?.error?.message ?? `Graph API returned ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

/** Supplementary calls degrade gracefully — a failure returns the fallback. */
function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return promise.catch(() => fallback);
}

/**
 * Explicit Insights windows keep Overview, Funnel, Breakdowns and Campaigns on
 * the same dates. Meta documents `time_range` as overriding `date_preset`, so
 * use it for every finite dashboard range and keep `maximum` as Meta's preset.
 */
function insightsDateParams(selection: AdDateSelection): Record<string, string> {
  const window = adPresetToDateWindow(selection);
  return window
    ? { time_range: JSON.stringify(window) }
    : { date_preset: selection as AdDatePreset };
}

function dateSelectionCacheKey(selection: AdDateSelection): string {
  return typeof selection === 'string' ? selection : `${selection.since}_${selection.until}`;
}

export const presetToDateRange = adPresetToDateRange;

async function fetchBreakdown(
  act: string,
  dateSelection: AdDateSelection,
  breakdowns: string,
  toLabel: (row: InsightRow) => string,
): Promise<BreakdownRow[]> {
  const res = await graphGet<{ data?: InsightRow[] }>(`${act}/insights`, {
    fields: BREAKDOWN_FIELDS,
    ...insightsDateParams(dateSelection),
    level: 'account',
    breakdowns,
    limit: '50',
  });
  return (res.data ?? [])
    .map((row) => toBreakdownRow(row, toLabel(row)))
    .filter((r) => r.spend > 0)
    .sort((a, b) => b.spend - a.spend);
}

const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Fetch thumbnails for the given ad ids in one batched call. */
async function fetchAdThumbnails(ids: string[]): Promise<Record<string, string | null>> {
  if (!ids.length) return {};
  const res = await graphGet<Record<string, { creative?: { thumbnail_url?: string } }>>('', {
    ids: ids.join(','),
    fields: 'creative{thumbnail_url}',
  });
  const map: Record<string, string | null> = {};
  for (const id of ids) map[id] = res?.[id]?.creative?.thumbnail_url ?? null;
  return map;
}

// ---------------------------------------------------------------------------
// Submodule entry points
// ---------------------------------------------------------------------------
//
// Each dashboard sub-page calls one of these. They share the private fetch
// helpers above but only make the Graph calls their own view needs, so flipping
// between tabs never re-fetches the whole account. All are inert unless
// configured and never throw: the core call failing returns `{ ok: false }`;
// each supplementary section degrades to empty on its own error.

const errText = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

/** Read the account's display name + reporting currency (small, shared call). */
async function fetchAccountMeta(act: string): Promise<{ name: string; currency: string }> {
  const meta = await graphGet<{ name?: string; currency?: string }>(act, {
    fields: 'name,currency',
  });
  return { name: meta.name ?? 'Ad account', currency: meta.currency ?? 'USD' };
}

/**
 * Overview submodule — headline account metrics, the prior-period comparison for
 * delta badges, and the per-day spend/revenue/ROAS series that feeds the trend
 * charts. The account insights call failing is fatal for this view.
 */
/** Graph API `filtering` param that scopes account-level insights to a single
 *  campaign, or {} for the whole account. */
function campaignFilter(campaignId?: string): Record<string, string> {
  return campaignId
    ? { filtering: JSON.stringify([{ field: 'campaign.id', operator: 'IN', value: [campaignId] }]) }
    : {};
}

export function getAdsSummary(
  dateSelection: AdDateSelection,
  campaignId?: string,
): Promise<AdsSummaryResult> {
  return unstable_cache(
    () => fetchAdsSummary(dateSelection, campaignId),
    ['meta-ads-summary', dateSelectionCacheKey(dateSelection), campaignId ?? 'all'],
    { revalidate: ADS_CACHE_TTL, tags: ['meta-ads'] },
  )();
}

async function fetchAdsSummary(
  dateSelection: AdDateSelection,
  campaignId?: string,
): Promise<AdsSummaryResult> {
  if (!adsInsightsEnabled()) return { ok: false, error: 'Meta Ads is not configured.' };

  const act = accountPath();
  const prev = adPresetToPreviousDateWindow(dateSelection);
  const scope = campaignFilter(campaignId);

  try {
    const [meta, accountInsights, previousInsights, dailyRows] = await Promise.all([
      fetchAccountMeta(act),
      graphGet<{ data?: InsightRow[] }>(`${act}/insights`, {
        fields: INSIGHT_FIELDS,
        ...insightsDateParams(dateSelection),
        level: 'account',
        ...scope,
      }),
      prev
        ? safe(
            graphGet<{ data?: InsightRow[] }>(`${act}/insights`, {
              fields: INSIGHT_FIELDS,
              time_range: JSON.stringify({ since: prev.since, until: prev.until }),
              level: 'account',
              ...scope,
            }),
            { data: [] },
          )
        : Promise.resolve<{ data?: InsightRow[] }>({ data: [] }),
      safe(
        graphGet<{ data?: InsightRow[] }>(`${act}/insights`, {
          fields: 'spend,action_values,purchase_roas',
          ...insightsDateParams(dateSelection),
          level: 'account',
          time_increment: '1',
          limit: '200',
          ...scope,
        }),
        { data: [] },
      ),
    ]);

    const previousInsight =
      prev && previousInsights.data?.length ? toInsight(previousInsights.data[0]) : null;

    const daily: DailyPoint[] = (dailyRows.data ?? []).map((row) => {
      const i = toInsight(row);
      return { date: row.date_start ?? '', spend: i.spend, revenue: i.revenue, roas: i.roas };
    });

    return {
      ok: true,
      data: {
        currency: meta.currency,
        accountName: meta.name,
        account: toInsight(accountInsights.data?.[0]),
        previous: previousInsight,
        previousLabel: prev?.label ?? null,
        daily,
      },
    };
  } catch (error) {
    return { ok: false, error: errText(error, 'Failed to load ad insights.') };
  }
}

/** Breakdowns submodule — spend/ROAS split by placement, demographic and device. */
export function getAdsBreakdownsData(dateSelection: AdDateSelection): Promise<AdsBreakdownsResult> {
  return unstable_cache(
    () => fetchAdsBreakdownsData(dateSelection),
    ['meta-ads-breakdowns', dateSelectionCacheKey(dateSelection)],
    { revalidate: ADS_CACHE_TTL, tags: ['meta-ads'] },
  )();
}

async function fetchAdsBreakdownsData(
  dateSelection: AdDateSelection,
): Promise<AdsBreakdownsResult> {
  if (!adsInsightsEnabled()) return { ok: false, error: 'Meta Ads is not configured.' };

  const act = accountPath();

  try {
    // `country` and `region` cannot share one Insights call with `age,gender`
    // (Meta rejects mixing geographic + demographic breakdowns), so each is its
    // own request — same pattern as the existing placement/device splits.
    const [meta, placement, demographic, device, country, region] = await Promise.all([
      fetchAccountMeta(act),
      safe(
        fetchBreakdown(act, dateSelection, 'publisher_platform', (r) =>
          titleCase(r.publisher_platform ?? 'Unknown'),
        ),
        [],
      ),
      safe(
        fetchBreakdown(
          act,
          dateSelection,
          'age,gender',
          (r) => `${r.age ?? '?'} · ${titleCase(r.gender ?? 'unknown')}`,
        ),
        [],
      ),
      safe(
        fetchBreakdown(act, dateSelection, 'impression_device', (r) =>
          titleCase(r.impression_device ?? 'Unknown'),
        ),
        [],
      ),
      safe(
        fetchBreakdown(act, dateSelection, 'country', (r) => r.country ?? 'Unknown'),
        [],
      ),
      safe(
        fetchBreakdown(act, dateSelection, 'region', (r) => r.region ?? 'Unknown'),
        [],
      ),
    ]);

    return {
      ok: true,
      data: {
        currency: meta.currency,
        breakdowns: { placement, demographic, device, country, region },
      },
    };
  } catch (error) {
    return { ok: false, error: errText(error, 'Failed to load breakdowns.') };
  }
}

export type CampaignOption = { id: string; name: string };

/** Lightweight {id, name} list of campaigns that spent in the window — powers the
 *  funnel's campaign filter. Sorted by spend so the biggest campaigns lead. */
export function getAdsCampaignOptions(dateSelection: AdDateSelection): Promise<CampaignOption[]> {
  return unstable_cache(
    () => fetchAdsCampaignOptions(dateSelection),
    ['meta-ads-campaign-options', dateSelectionCacheKey(dateSelection)],
    { revalidate: ADS_CACHE_TTL, tags: ['meta-ads'] },
  )();
}

async function fetchAdsCampaignOptions(dateSelection: AdDateSelection): Promise<CampaignOption[]> {
  if (!adsInsightsEnabled()) return [];
  const act = accountPath();
  const res = await safe(
    graphGet<{ data?: InsightRow[] }>(`${act}/insights`, {
      fields: 'campaign_id,campaign_name,spend',
      ...insightsDateParams(dateSelection),
      level: 'campaign',
      sort: 'spend_descending',
      limit: '100',
    }),
    { data: [] },
  );
  const seen = new Set<string>();
  const options: CampaignOption[] = [];
  for (const row of res.data ?? []) {
    const id = row.campaign_id;
    if (id && !seen.has(id)) {
      seen.add(id);
      options.push({ id, name: row.campaign_name ?? 'Untitled campaign' });
    }
  }
  return options;
}

/** Campaigns submodule — per-campaign performance (with live status) and top ads. */
export function getAdsCampaignsData(dateSelection: AdDateSelection): Promise<AdsCampaignsResult> {
  return unstable_cache(
    () => fetchAdsCampaignsData(dateSelection),
    ['meta-ads-campaigns', dateSelectionCacheKey(dateSelection)],
    { revalidate: ADS_CACHE_TTL, tags: ['meta-ads'] },
  )();
}

async function fetchAdsCampaignsData(dateSelection: AdDateSelection): Promise<AdsCampaignsResult> {
  if (!adsInsightsEnabled()) return { ok: false, error: 'Meta Ads is not configured.' };

  const act = accountPath();

  try {
    const [meta, campaignInsights, campaignMeta, topAdRows] = await Promise.all([
      fetchAccountMeta(act),
      graphGet<{ data?: InsightRow[] }>(`${act}/insights`, {
        fields: `${INSIGHT_FIELDS},campaign_id,campaign_name`,
        ...insightsDateParams(dateSelection),
        level: 'campaign',
        limit: '200',
      }),
      safe(
        graphGet<{ data?: { id: string; effective_status?: string; objective?: string }[] }>(
          `${act}/campaigns`,
          { fields: 'id,effective_status,objective', limit: '500' },
        ),
        { data: [] },
      ),
      safe(
        graphGet<{ data?: InsightRow[] }>(`${act}/insights`, {
          fields: 'ad_id,ad_name,campaign_name,spend,actions,action_values,purchase_roas',
          ...insightsDateParams(dateSelection),
          level: 'ad',
          sort: 'spend_descending',
          limit: '8',
        }),
        { data: [] },
      ),
    ]);

    // Join live campaign status/objective onto the insight rows.
    const statusMap = new Map((campaignMeta.data ?? []).map((c) => [c.id, c] as const));
    const campaigns: CampaignInsight[] = (campaignInsights.data ?? [])
      .map((row) => {
        const cid = row.campaign_id ?? '';
        const cMeta = statusMap.get(cid);
        const status = cMeta?.effective_status ?? '';
        return {
          ...toInsight(row),
          campaignId: cid,
          campaignName: row.campaign_name ?? 'Untitled campaign',
          status,
          isActive: status === 'ACTIVE',
          objective: cMeta?.objective ?? '',
        };
      })
      .sort((a, b) => b.spend - a.spend);

    // Top ads + thumbnails (second, dependent call).
    const topAdInsights = (topAdRows.data ?? []).filter((r) => r.ad_id);
    const thumbnails = await safe(
      fetchAdThumbnails(topAdInsights.map((r) => r.ad_id as string)),
      {} as Record<string, string | null>,
    );
    const topAds: TopAd[] = topAdInsights.map((row) => {
      const i = toInsight(row);
      return {
        adId: row.ad_id as string,
        adName: row.ad_name ?? 'Untitled ad',
        campaignName: row.campaign_name ?? '',
        spend: i.spend,
        revenue: i.revenue,
        roas: i.roas,
        purchases: i.purchases,
        thumbnailUrl: thumbnails[row.ad_id as string] ?? null,
      };
    });

    return { ok: true, data: { currency: meta.currency, campaigns, topAds } };
  } catch (error) {
    return { ok: false, error: errText(error, 'Failed to load campaigns.') };
  }
}
