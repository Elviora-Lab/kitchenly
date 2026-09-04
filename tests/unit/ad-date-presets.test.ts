import { describe, expect, it } from 'vitest';

import {
  adPresetToDateRange,
  adPresetToDateWindow,
  adPresetToPreviousDateWindow,
  parseAdDateSelection,
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
    expect(since.toISOString()).toBe('2026-07-29T07:00:00.000Z');
    expect(until.toISOString()).toBe(NOW.toISOString());
  });

  it('keeps Meta today on the previous reporting day until noon in Pakistan', () => {
    const beforeNoonPakistan = new Date('2026-08-27T06:59:59.000Z');

    expect(adPresetToDateWindow('today', beforeNoonPakistan)).toEqual({
      since: '2026-08-26',
      until: '2026-08-26',
    });
    expect(adPresetToDateRange('today', beforeNoonPakistan)).toEqual({
      since: new Date('2026-08-26T07:00:00.000Z'),
      until: beforeNoonPakistan,
    });
  });

  it('accepts a completed custom period and rejects future dates', () => {
    expect(
      parseAdDateSelection({ range: 'custom', from: '2026-08-02', to: '2026-08-14' }, NOW),
    ).toEqual({
      since: '2026-08-02',
      until: '2026-08-14',
    });
    expect(
      parseAdDateSelection({ range: 'custom', from: '2026-08-02', to: '2026-08-28' }, NOW),
    ).toBe('last_30d');
  });
});
