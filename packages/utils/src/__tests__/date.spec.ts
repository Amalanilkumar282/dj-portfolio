import { describe, expect, it } from 'vitest';

import {
  formatEventDateRange,
  formatIstDate,
  formatIstDateTime,
  isoWithIstOffset,
} from '../date.js';

/**
 * Every timestamp is stored UTC and displayed IST. These tests pin the
 * conversion, and in particular the JSON-LD offset — a bare `Z` makes Google
 * display Indian gigs at the wrong local time in rich results.
 */

describe('IST conversion', () => {
  it('shifts a UTC instant into IST for display', () => {
    // 18:30 UTC is 00:00 IST the following day (UTC+05:30).
    const utc = new Date('2026-03-14T18:30:00.000Z');
    expect(formatIstDate(utc)).toMatch(/15 Mar,? 2026/);
  });

  it('formats a date and time in IST', () => {
    const utc = new Date('2026-03-14T16:30:00.000Z'); // 22:00 IST
    const formatted = formatIstDateTime(utc);
    expect(formatted).toMatch(/14 Mar,? 2026/);
    expect(formatted).toMatch(/10:00\s?pm/i);
  });
});

describe('isoWithIstOffset', () => {
  it('emits an explicit +05:30 offset rather than Z', () => {
    // This is the load-bearing assertion for MusicEvent.startDate.
    const utc = new Date('2026-03-14T16:30:00.000Z');
    expect(isoWithIstOffset(utc)).toBe('2026-03-14T22:00:00+05:30');
  });

  it('carries the date forward when IST crosses midnight', () => {
    const utc = new Date('2026-03-14T19:00:00.000Z'); // 00:30 IST on the 15th
    expect(isoWithIstOffset(utc)).toBe('2026-03-15T00:30:00+05:30');
  });

  it('produces a value Date can parse back to the same instant', () => {
    const utc = new Date('2026-06-01T16:30:00.000Z');
    expect(new Date(isoWithIstOffset(utc)).getTime()).toBe(utc.getTime());
  });
});

describe('formatEventDateRange', () => {
  it('returns just the start when there is no end', () => {
    const start = new Date('2026-03-14T16:30:00.000Z');
    expect(formatEventDateRange(start, null)).toBe(formatIstDateTime(start));
  });

  it('shows only the end time for a same-day event', () => {
    const start = new Date('2026-03-14T13:00:00.000Z'); // 18:30 IST
    const end = new Date('2026-03-14T16:00:00.000Z'); // 21:30 IST
    const range = formatEventDateRange(start, end);
    // The date should appear once, not twice.
    expect(range.match(/Mar,? 2026/g)).toHaveLength(1);
  });

  it('treats a set running past midnight as one night', () => {
    // Club sets routinely end after midnight. That must not read as a
    // two-day event.
    const start = new Date('2026-03-14T16:30:00.000Z'); // 22:00 IST, 14 Mar
    const end = new Date('2026-03-14T20:30:00.000Z'); // 02:00 IST, 15 Mar
    const range = formatEventDateRange(start, end);
    expect(range.match(/Mar,? 2026/g)).toHaveLength(1);
  });

  it('shows both dates for a genuinely multi-day event', () => {
    // A festival booking spanning two days must show both.
    const start = new Date('2026-03-14T10:00:00.000Z');
    const end = new Date('2026-03-16T10:00:00.000Z');
    const range = formatEventDateRange(start, end);
    expect(range.match(/Mar,? 2026/g)).toHaveLength(2);
  });
});
