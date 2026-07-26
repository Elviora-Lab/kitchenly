import 'server-only';

import { Prisma } from '@prisma/client';

import { isProd, publicEnv } from '@/config/env';

import { prisma } from '@/lib/db';

import { capiEnabled } from './meta-capi';

/**
 * First-party "Pixel Events" analytics — the data behind `/admin/pixel`.
 *
 * Meta offers no supported public API to read back raw pixel event volume (that
 * lives only in Events Manager), so this dashboard measures the SAME standard
 * events from our own server-side logs instead. First-party counts are actually
 * MORE reliable than the browser pixel — they aren't lost to ad blockers or
 * ITP — and they map 1:1 onto the events the pixel + Conversions API fire (see
 * `@/lib/analytics/meta-pixel` and `./meta-capi`).
 *
 * Buckets are UTC days (`… AT TIME ZONE 'UTC'`) so the SQL grouping lines up
 * with the UTC date spine we build in JS regardless of the DB session timezone.
 */

// ---------- Date ranges ----------

export const PIXEL_RANGES = { '7d': 7, '30d': 30, '90d': 90 } as const;
export type PixelRange = keyof typeof PIXEL_RANGES;
export const DEFAULT_PIXEL_RANGE: PixelRange = '30d';

export const PIXEL_RANGE_LABELS: Record<PixelRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

export function isPixelRange(value: string | undefined): value is PixelRange {
  return Boolean(value) && value! in PIXEL_RANGES;
}

// ---------- Types ----------

export type PixelSeriesPoint = { date: string; count: number };

export type PixelEventSeries = {
  key: string;
  /** Standard Meta/GA4 event name (e.g. `ViewContent`). */
  label: string;
  total: number;
  /** Same-length window immediately before this one — for the delta badge. */
  previousTotal: number;
  points: PixelSeriesPoint[];
  /** A "good" conversion event (rendered with the success accent). */
  positive: boolean;
};

export type PixelHealth = {
  environment: string;
  isProd: boolean;
  pixel: { id: string | null; configured: boolean; active: boolean };
  ga: { id: string | null; configured: boolean; active: boolean };
  capi: { configured: boolean };
};

/** Coverage map: which destinations each tracked event reaches, and whether we
 *  also measure it first-party (so it appears as a chart above). */
export type CoverageRow = {
  event: string;
  pixel: boolean;
  ga: boolean;
  capi: boolean;
  /** DB table backing the first-party series, or null if pixel/GA-only. */
  firstParty: string | null;
};

export type PixelDashboard = {
  rangeDays: number;
  /** e.g. "vs previous 30 days" — the delta comparison baseline. */
  previousLabel: string;
  health: PixelHealth;
  events: PixelEventSeries[];
  revenue: { total: number; previous: number; currency: string };
  funnel: {
    views: number;
    carts: number;
    purchases: number;
    /** carts / views. */
    cartRate: number;
    /** purchases / views. */
    purchaseRate: number;
    previous: { views: number; carts: number; purchases: number };
  };
  coverage: CoverageRow[];
};

// ---------- Health / config ----------

export function getPixelHealth(): PixelHealth {
  const pixelId = publicEnv.NEXT_PUBLIC_FB_PIXEL_ID || null;
  const gaId = publicEnv.NEXT_PUBLIC_GA_ID || null;
  return {
    environment: publicEnv.NEXT_PUBLIC_ENVIRONMENT,
    isProd,
    pixel: { id: pixelId, configured: Boolean(pixelId), active: isProd && Boolean(pixelId) },
    ga: { id: gaId, configured: Boolean(gaId), active: isProd && Boolean(gaId) },
    capi: { configured: capiEnabled() },
  };
}

/** Every event the app fires, and where it goes. Kept in sync with the
 *  `analytics` facade (`@/lib/analytics`). `firstParty` names the log we can
 *  chart from; null means the event is pixel/GA-only (no server-side record). */
const EVENT_COVERAGE: CoverageRow[] = [
  { event: 'ViewContent', pixel: true, ga: true, capi: true, firstParty: 'product_view_logs' },
  // Custom (trackCustom) events aren't standard Meta events, so they have no
  // CAPI twin — they exist to seed Custom Conversions in Ads Manager.
  { event: 'ViewCategory', pixel: true, ga: true, capi: false, firstParty: null },
  { event: 'Search', pixel: true, ga: true, capi: true, firstParty: 'search_logs' },
  { event: 'AddToCart', pixel: true, ga: true, capi: true, firstParty: 'cart_event_logs' },
  { event: 'AddToWishlist', pixel: true, ga: true, capi: true, firstParty: null },
  { event: 'InitiateCheckout', pixel: true, ga: true, capi: true, firstParty: null },
  { event: 'AddPaymentInfo', pixel: true, ga: true, capi: true, firstParty: null },
  { event: 'Purchase', pixel: true, ga: true, capi: true, firstParty: 'orders' },
  { event: 'Subscribe', pixel: true, ga: true, capi: true, firstParty: 'newsletter_subscribers' },
  { event: 'Lead', pixel: true, ga: false, capi: true, firstParty: null },
  { event: 'CouponApplied', pixel: true, ga: true, capi: false, firstParty: null },
  { event: 'BackInStockNotify', pixel: true, ga: true, capi: false, firstParty: null },
  { event: 'Contact', pixel: true, ga: true, capi: true, firstParty: null },
  { event: 'SkincareAssistant', pixel: true, ga: true, capi: false, firstParty: null },
];

// ---------- Series helpers ----------

type DayRow = { day: string; count: number };
type OrderDayRow = DayRow & { revenue: number };

/** Ordered list of `YYYY-MM-DD` (UTC) days spanning [since, until] inclusive. */
function dateSpine(since: Date, until: Date): string[] {
  const days: string[] = [];
  const cursor = new Date(
    Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()),
  );
  const end = Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), until.getUTCDate());
  while (cursor.getTime() <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function buildSeries(
  key: string,
  label: string,
  rows: DayRow[],
  spine: string[],
  previousTotal: number,
  positive = false,
): PixelEventSeries {
  const byDay = new Map(rows.map((r) => [r.day, Number(r.count)]));
  const points = spine.map((date) => ({ date, count: byDay.get(date) ?? 0 }));
  const total = points.reduce((sum, p) => sum + p.count, 0);
  return { key, label, total, previousTotal, points, positive };
}

// ---------- Dashboard ----------

// ---------- Filters ----------

export type PixelAudience = 'all' | 'user' | 'guest';
export function isPixelAudience(v: string | undefined): v is PixelAudience {
  return v === 'all' || v === 'user' || v === 'guest';
}

export type PixelFilters = {
  since: Date;
  until: Date;
  audience: PixelAudience;
  /** Scope product-aware events to one product… */
  productId?: string;
  /** …or to all products in a category. */
  categoryId?: string;
  /** Last-touch marketing attribution (orders only). Scopes Purchase + revenue. */
  utmCampaign?: string;
  utmSource?: string;
};

/** `AND <col> IS [NOT] NULL` for the audience split (col names are literals). */
function audienceSql(audience: PixelAudience, col: string): Prisma.Sql {
  if (audience === 'user') return Prisma.sql`AND ${Prisma.raw(col)} IS NOT NULL`;
  if (audience === 'guest') return Prisma.sql`AND ${Prisma.raw(col)} IS NULL`;
  return Prisma.empty;
}

/** Product/category scope on a product_id column, or nothing. */
function productSql(f: PixelFilters, col: string): Prisma.Sql {
  if (f.productId) return Prisma.sql`AND ${Prisma.raw(col)} = ${f.productId}::uuid`;
  if (f.categoryId)
    return Prisma.sql`AND ${Prisma.raw(col)} IN (SELECT id FROM products WHERE category_id = ${f.categoryId}::uuid)`;
  return Prisma.empty;
}

/** Order-level product/category scope (via order_items), or nothing. */
function orderProductSql(f: PixelFilters): Prisma.Sql {
  if (f.productId)
    return Prisma.sql`AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = orders.id AND oi.product_id = ${f.productId}::uuid)`;
  if (f.categoryId)
    return Prisma.sql`AND EXISTS (SELECT 1 FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = orders.id AND p.category_id = ${f.categoryId}::uuid)`;
  return Prisma.empty;
}

/** Order-level UTM scope (last-touch attribution lives on the order), or nothing. */
function orderUtmSql(f: PixelFilters): Prisma.Sql {
  const conds: Prisma.Sql[] = [];
  if (f.utmCampaign) conds.push(Prisma.sql`utm_campaign = ${f.utmCampaign}`);
  if (f.utmSource) conds.push(Prisma.sql`utm_source = ${f.utmSource}`);
  return conds.length ? Prisma.sql`AND ${Prisma.join(conds, ' AND ')}` : Prisma.empty;
}

/** True when a product/category filter is active — search/subscribe have no
 *  product dimension, so they read as n/a (0) in that case. */
const productScoped = (f: PixelFilters) => Boolean(f.productId || f.categoryId);

/** True when a campaign/source filter is active — only orders carry UTM, so
 *  every non-purchase event reads as n/a. */
const campaignScoped = (f: PixelFilters) => Boolean(f.utmCampaign || f.utmSource);

export async function getPixelDashboard(f: PixelFilters): Promise<PixelDashboard> {
  const { since, until } = f;
  const windowMs = Math.max(1, until.getTime() - since.getTime());
  const rangeDays = Math.max(1, Math.round(windowMs / (24 * 60 * 60 * 1000)));
  // Same-length window immediately before the current one — the delta baseline.
  const prevUntil = since;
  const prevSince = new Date(since.getTime() - windowMs);
  const spine = dateSpine(since, until);
  const prod = productScoped(f);
  const camp = campaignScoped(f);
  const aud = audienceSql(f.audience, 'user_id');

  const [viewRows, cartRows, searchRows, orderRows, subRows, previous] = await Promise.all([
    // Views/carts have no UTM → n/a under a campaign filter.
    camp
      ? Promise.resolve<DayRow[]>([])
      : prisma.$queryRaw<DayRow[]>(Prisma.sql`
          SELECT to_char(date_trunc('day', viewed_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
                 COUNT(*)::int AS count
          FROM product_view_logs
          WHERE viewed_at >= ${since} AND viewed_at < ${until} ${aud} ${productSql(f, 'product_id')}
          GROUP BY 1`),
    camp
      ? Promise.resolve<DayRow[]>([])
      : prisma.$queryRaw<DayRow[]>(Prisma.sql`
          SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
                 COUNT(*)::int AS count
          FROM cart_event_logs
          WHERE created_at >= ${since} AND created_at < ${until} ${aud} ${productSql(f, 'product_id')}
          GROUP BY 1`),
    // Search has no product/UTM dimension → empty under a product or campaign filter.
    prod || camp
      ? Promise.resolve<DayRow[]>([])
      : prisma.$queryRaw<DayRow[]>(Prisma.sql`
          SELECT to_char(date_trunc('day', searched_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
                 COUNT(*)::int AS count
          FROM search_logs
          WHERE searched_at >= ${since} AND searched_at < ${until} ${aud}
          GROUP BY 1`),
    prisma.$queryRaw<OrderDayRow[]>(Prisma.sql`
      SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS count,
             COALESCE(SUM(total_amount), 0)::float AS revenue
      FROM orders
      WHERE created_at >= ${since} AND created_at < ${until} ${aud} ${orderProductSql(f)} ${orderUtmSql(f)}
      GROUP BY 1`),
    // Newsletter has no user/product/UTM link → n/a when audience=user or product/campaign-scoped.
    prod || camp || f.audience === 'user'
      ? Promise.resolve<DayRow[]>([])
      : prisma.$queryRaw<DayRow[]>(Prisma.sql`
          SELECT to_char(date_trunc('day', subscribed_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
                 COUNT(*)::int AS count
          FROM newsletter_subscribers
          WHERE subscribed_at >= ${since} AND subscribed_at < ${until}
          GROUP BY 1`),
    previousTotals({ ...f, since: prevSince, until: prevUntil }),
  ]);

  const viewContent = buildSeries('view_content', 'ViewContent', viewRows, spine, previous.views);
  const addToCart = buildSeries('add_to_cart', 'AddToCart', cartRows, spine, previous.carts);
  const search = buildSeries('search', 'Search', searchRows, spine, previous.searches);
  const purchase = buildSeries('purchase', 'Purchase', orderRows, spine, previous.purchases, true);
  const subscribe = buildSeries(
    'subscribe',
    'Subscribe',
    subRows,
    spine,
    previous.subscribes,
    true,
  );
  const events: PixelEventSeries[] = [viewContent, addToCart, search, purchase, subscribe];

  const views = viewContent.total;
  const carts = addToCart.total;
  const purchases = purchase.total;
  const revenue = orderRows.reduce((sum, r) => sum + Number(r.revenue ?? 0), 0);

  return {
    rangeDays,
    previousLabel: `vs previous ${rangeDays} days`,
    health: getPixelHealth(),
    events,
    revenue: { total: revenue, previous: previous.revenue, currency: 'PKR' },
    funnel: {
      views,
      carts,
      purchases,
      cartRate: views > 0 ? carts / views : 0,
      purchaseRate: views > 0 ? purchases / views : 0,
      previous: { views: previous.views, carts: previous.carts, purchases: previous.purchases },
    },
    coverage: EVENT_COVERAGE,
  };
}

type CountRow = { count: number };
type CountRevenueRow = { count: number; revenue: number };

export type UtmOptions = { campaigns: string[]; sources: string[] };

/** Distinct utm_campaign / utm_source seen on orders — powers the filter dropdowns. */
export async function getUtmOptions(): Promise<UtmOptions> {
  const [campaigns, sources] = await Promise.all([
    prisma.$queryRaw<{ v: string }[]>`
      SELECT DISTINCT utm_campaign AS v FROM orders
      WHERE utm_campaign IS NOT NULL AND utm_campaign <> '' ORDER BY 1 LIMIT 100`,
    prisma.$queryRaw<{ v: string }[]>`
      SELECT DISTINCT utm_source AS v FROM orders
      WHERE utm_source IS NOT NULL AND utm_source <> '' ORDER BY 1 LIMIT 100`,
  ]);
  return { campaigns: campaigns.map((r) => r.v), sources: sources.map((r) => r.v) };
}

/** Bare totals for the previous window, under the SAME filters — delta baseline. */
async function previousTotals(f: PixelFilters) {
  const { since, until } = f;
  const prod = productScoped(f);
  const camp = campaignScoped(f);
  const aud = audienceSql(f.audience, 'user_id');

  const [views, carts, searches, orders, subs] = await Promise.all([
    camp
      ? Promise.resolve<CountRow[]>([{ count: 0 }])
      : prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::int AS count FROM product_view_logs
          WHERE viewed_at >= ${since} AND viewed_at < ${until} ${aud} ${productSql(f, 'product_id')}`),
    camp
      ? Promise.resolve<CountRow[]>([{ count: 0 }])
      : prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::int AS count FROM cart_event_logs
          WHERE created_at >= ${since} AND created_at < ${until} ${aud} ${productSql(f, 'product_id')}`),
    prod || camp
      ? Promise.resolve<CountRow[]>([{ count: 0 }])
      : prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::int AS count FROM search_logs
          WHERE searched_at >= ${since} AND searched_at < ${until} ${aud}`),
    prisma.$queryRaw<CountRevenueRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS count, COALESCE(SUM(total_amount), 0)::float AS revenue FROM orders
      WHERE created_at >= ${since} AND created_at < ${until} ${aud} ${orderProductSql(f)} ${orderUtmSql(f)}`),
    prod || camp || f.audience === 'user'
      ? Promise.resolve<CountRow[]>([{ count: 0 }])
      : prisma.$queryRaw<CountRow[]>(Prisma.sql`
          SELECT COUNT(*)::int AS count FROM newsletter_subscribers
          WHERE subscribed_at >= ${since} AND subscribed_at < ${until}`),
  ]);
  return {
    views: Number(views[0]?.count ?? 0),
    carts: Number(carts[0]?.count ?? 0),
    searches: Number(searches[0]?.count ?? 0),
    purchases: Number(orders[0]?.count ?? 0),
    revenue: Number(orders[0]?.revenue ?? 0),
    subscribes: Number(subs[0]?.count ?? 0),
  };
}
