/**
 * Ad-dashboard date-range presets.
 *
 * Client-safe: kept out of `@/server/analytics/meta-ads` (which is `server-only`)
 * so the client sub-nav and page components can share the same preset list and
 * labels without pulling server code into the browser bundle. `meta-ads.ts`
 * re-exports these for the server-side fetchers.
 */

export const AD_DATE_PRESETS = [
  'today',
  'yesterday',
  'last_7d',
  'last_14d',
  'last_30d',
  'last_90d',
  'this_month',
  'last_month',
  'maximum',
] as const;

export type AdDatePreset = (typeof AD_DATE_PRESETS)[number];

export const AD_DATE_PRESET_LABELS: Record<AdDatePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last_7d: 'Last 7 days',
  last_14d: 'Last 14 days',
  last_30d: 'Last 30 days',
  last_90d: 'Last 90 days',
  this_month: 'This month',
  last_month: 'Last month',
  maximum: 'All time',
};

export function isAdDatePreset(value: string | undefined): value is AdDatePreset {
  return Boolean(value) && (AD_DATE_PRESETS as readonly string[]).includes(value as string);
}

/** Default window when none (or an invalid one) is supplied via the URL. */
export const DEFAULT_AD_RANGE: AdDatePreset = 'last_30d';

/** Presets offered as tabs in the dashboard nav (omits the noisier `yesterday`/`last_14d`). */
export const AD_RANGE_TABS: AdDatePreset[] = [
  'today',
  'last_7d',
  'last_30d',
  'last_90d',
  'this_month',
  'last_month',
  'maximum',
];

export type AdDateWindow = { since: string; until: string };
export type AdDateSelection = AdDatePreset | AdDateWindow;

type AdDateSearchParams = { range?: string; from?: string; to?: string };

/**
 * Meta Ads Manager rolls this account's reporting day at noon in Pakistan.
 * Keep the dashboard's "today" and its store-order comparison on that same
 * boundary, rather than switching at either the server's or UTC midnight.
 */
export const META_REPORTING_CUTOFF_HOUR_PAKISTAN = 12;
const PAKISTAN_TIME_ZONE = 'Asia/Karachi';

const FIXED_DAY_PRESETS: Partial<Record<AdDatePreset, number>> = {
  today: 1,
  yesterday: 1,
  last_7d: 7,
  last_14d: 14,
  last_30d: 30,
  last_90d: 90,
};

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addUtcMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function fmtDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pakistanDateParts(now: Date): { year: number; month: number; day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PAKISTAN_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

function metaReportingDay(now: Date): Date {
  const parts = pakistanDateParts(now);
  const pakistanCalendarDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return parts.hour < META_REPORTING_CUTOFF_HOUR_PAKISTAN
    ? addUtcDays(pakistanCalendarDay, -1)
    : pakistanCalendarDay;
}

export function currentMetaReportingDate(now = new Date()): string {
  return fmtDate(metaReportingDay(now));
}

function isCalendarDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && fmtDate(parsed) === value;
}

/** Resolve URL parameters into either a preset or a validated custom window. */
export function parseAdDateSelection(
  params: AdDateSearchParams,
  now = new Date(),
): AdDateSelection {
  if (params.range === 'custom' && isCalendarDate(params.from) && isCalendarDate(params.to)) {
    const latestAllowed = currentMetaReportingDate(now);
    if (params.from <= params.to && params.to <= latestAllowed) {
      return { since: params.from, until: params.to };
    }
  }
  return isAdDatePreset(params.range) ? params.range : DEFAULT_AD_RANGE;
}

export function adDateSelectionToSearchParams(selection: AdDateSelection): string {
  if (typeof selection === 'string') return `range=${selection}`;
  return new URLSearchParams({
    range: 'custom',
    from: selection.since,
    to: selection.until,
  }).toString();
}

function storeNoon(date: Date): Date {
  // Pakistan is UTC+5 year-round. `date` is a UTC calendar-only value here.
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      META_REPORTING_CUTOFF_HOUR_PAKISTAN - 5,
    ),
  );
}

/**
 * Exact date window shown by the ads dashboard.
 *
 * Meta accepts `date_preset`, but using explicit ranges keeps all sub-tabs and
 * the store reconciliation on the same calendar dates. Last-N-day presets are
 * inclusive of today: on Aug 27, "Last 7 days" is Aug 21 through Aug 27.
 */
export function adPresetToDateWindow(
  selection: AdDateSelection,
  now = new Date(),
): AdDateWindow | null {
  if (typeof selection !== 'string') return selection;
  const preset = selection;
  const today = metaReportingDay(now);
  const days = FIXED_DAY_PRESETS[preset];

  if (preset === 'yesterday') {
    const yesterday = addUtcDays(today, -1);
    return { since: fmtDate(yesterday), until: fmtDate(yesterday) };
  }

  if (days) {
    return { since: fmtDate(addUtcDays(today, -(days - 1))), until: fmtDate(today) };
  }

  if (preset === 'this_month') {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return { since: fmtDate(start), until: fmtDate(today) };
  }

  if (preset === 'last_month') {
    const thisMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const start = addUtcMonths(thisMonth, -1);
    const end = addUtcDays(thisMonth, -1);
    return { since: fmtDate(start), until: fmtDate(end) };
  }

  return null;
}

export function adPresetToPreviousDateWindow(
  selection: AdDateSelection,
  now = new Date(),
): (AdDateWindow & { label: string }) | null {
  const current = adPresetToDateWindow(selection, now);
  if (!current) return null;

  const start = new Date(`${current.since}T00:00:00.000Z`);
  const end = new Date(`${current.until}T00:00:00.000Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const prevUntil = addUtcDays(start, -1);
  const prevSince = addUtcDays(prevUntil, -(days - 1));

  return {
    since: fmtDate(prevSince),
    until: fmtDate(prevUntil),
    label: days === 1 ? 'vs prior day' : `vs prior ${days} days`,
  };
}

export function adPresetToDateRange(
  selection: AdDateSelection,
  now = new Date(),
): { since: Date; until: Date } {
  const window = adPresetToDateWindow(selection, now);
  if (!window) {
    return { since: new Date(Date.UTC(2000, 0, 1)), until: now };
  }

  const sinceDay = new Date(`${window.since}T00:00:00.000Z`);
  const untilDay = new Date(`${window.until}T00:00:00.000Z`);
  const activeReportingDay = metaReportingDay(now);
  const isCurrentReportingDay = fmtDate(untilDay) === fmtDate(activeReportingDay);

  return {
    since: storeNoon(sinceDay),
    // Today's window is intentionally partial: Meta has only reported data up
    // to this instant, so include store orders only up to the same point.
    until: isCurrentReportingDay ? now : new Date(storeNoon(addUtcDays(untilDay, 1)).getTime() - 1),
  };
}
