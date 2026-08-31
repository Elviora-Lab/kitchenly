import { describe, expect, it } from 'vitest';

import { formatDate } from '@/utils/format';
import {
  formatStoreDateTimeLocalInput,
  parseStoreDateTimeInput,
  startOfStoreDay,
  startOfStoreWeek,
  storeYear,
} from '@/utils/time';

describe('store time helpers', () => {
  it('parses datetime-local values as Pakistan store time', () => {
    expect(parseStoreDateTimeInput('2026-09-01T21:30').toISOString()).toBe(
      '2026-09-01T16:30:00.000Z',
    );
  });

  it('keeps already absolute instants unchanged', () => {
    expect(parseStoreDateTimeInput('2026-09-01T21:30:00.000Z').toISOString()).toBe(
      '2026-09-01T21:30:00.000Z',
    );
  });

  it('formats admin datetime-local inputs in Pakistan store time', () => {
    expect(formatStoreDateTimeLocalInput('2026-09-01T16:30:00.000Z')).toBe('2026-09-01T21:30');
  });

  it('uses Pakistan calendar boundaries for today and this week', () => {
    const now = new Date('2026-08-31T20:30:00.000Z'); // Sep 1, 01:30 in Pakistan.

    expect(startOfStoreDay(now).toISOString()).toBe('2026-08-31T19:00:00.000Z');
    expect(startOfStoreWeek(now).toISOString()).toBe('2026-08-30T19:00:00.000Z');
  });

  it('formats dates in Pakistan time by default', () => {
    expect(
      formatDate('2026-08-31T20:00:00.000Z', { dateStyle: 'medium', timeStyle: 'short' }),
    ).toBe('01-Sept-2026, 1:00 am');
  });

  it('uses the Pakistan year for generated business numbers', () => {
    expect(storeYear(new Date('2026-12-31T20:00:00.000Z'))).toBe(2027);
  });
});
