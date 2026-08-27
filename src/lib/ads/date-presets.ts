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

const FIXED_DAY_PRESETS: Partial<Record<AdDatePreset, number>> = {
  today: 1,
  yesterday: 1,
  last_7d: 7,
  last_14d: 14,
  last_30d: 30,
  last_90d: 90,
};

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

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

/**
 * Exact date window shown by the ads dashboard.
 *
 * Meta accepts `date_preset`, but using explicit ranges keeps all sub-tabs and
 * the store reconciliation on the same calendar dates. Last-N-day presets are
 * inclusive of today: on Aug 27, "Last 7 days" is Aug 21 through Aug 27.
 */
export function adPresetToDateWindow(preset: AdDatePreset, now = new Date()): AdDateWindow | null {
  const today = utcDay(now);
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
  preset: AdDatePreset,
  now = new Date(),
): (AdDateWindow & { label: string }) | null {
  const current = adPresetToDateWindow(preset, now);
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
  preset: AdDatePreset,
  now = new Date(),
): { since: Date; until: Date } {
  const window = adPresetToDateWindow(preset, now);
  if (!window) {
    return { since: new Date(Date.UTC(2000, 0, 1)), until: now };
  }

  return {
    since: new Date(`${window.since}T00:00:00.000Z`),
    until: new Date(`${window.until}T23:59:59.999Z`),
  };
}
