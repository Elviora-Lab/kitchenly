import { describe, expect, it } from 'vitest';

import {
  adPresetToDateRange,
  adPresetToDateWindow,
  adPresetToPreviousDateWindow,
} from '@/lib/ads/date-presets';

const NOW = new Date('2026-08-27T12:34:56.000Z');

describe('ad dashboard date presets', () => {
  it('maps last-N-day tabs to exact inclusive calendar windows', () => {
    expect(adPresetToDateWindow('last_7d', NOW)).toEqual({
      since: '2026-08-21',
      until: '2026-08-27',
    });
    expect(adPresetToDateWindow('last_30d', NOW)).toEqual({
      since: '2026-07-29',
      until: '2026-08-27',
    });
    expect(adPresetToDateWindow('last_90d', NOW)).toEqual({
      since: '2026-05-30',
      until: '2026-08-27',
    });
  });

  it('builds the prior equal-length window from the selected window', () => {
    expect(adPresetToPreviousDateWindow('last_7d', NOW)).toEqual({
      since: '2026-08-14',
      until: '2026-08-20',
      label: 'vs prior 7 days',
    });
    expect(adPresetToPreviousDateWindow('yesterday', NOW)).toEqual({
      since: '2026-08-25',
      until: '2026-08-25',
      label: 'vs prior day',
    });
  });

  it('returns full-day Date bounds for store reconciliation', () => {
    const { since, until } = adPresetToDateRange('last_30d', NOW);
    expect(since.toISOString()).toBe('2026-07-29T00:00:00.000Z');
    expect(until.toISOString()).toBe('2026-08-27T23:59:59.999Z');
  });
});
