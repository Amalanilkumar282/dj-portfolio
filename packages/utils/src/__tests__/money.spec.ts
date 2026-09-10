import { describe, expect, it } from 'vitest';

import { formatINR, formatPriceRange, parseMoney } from '../money.js';

/**
 * The business quotes in rupees. The legacy booking form offered USD brackets
 * ("under-500", "over-5000") for a Bengaluru business, so these tests pin the
 * two things that were wrong: the currency and the digit grouping.
 */

describe('formatINR', () => {
  it('uses Indian digit grouping, not thousands grouping', () => {
    // 250000 is two lakh fifty thousand: ₹2,50,000 — not ₹250,000.
    expect(formatINR(250_000)).toBe('₹2,50,000');
    expect(formatINR(1_000_000)).toBe('₹10,00,000');
    expect(formatINR(15_000)).toBe('₹15,000');
  });

  it('omits decimals by default', () => {
    expect(formatINR(45_000)).toBe('₹45,000');
    expect(formatINR(45_000.6)).toBe('₹45,001');
  });

  it('includes decimals on request', () => {
    expect(formatINR(45_000.5, { withDecimals: true })).toBe('₹45,000.50');
  });

  it('compacts for stat tiles and badges', () => {
    // Indian compact notation uses lakh/crore, which is the point of en-IN.
    expect(formatINR(250_000, { compact: true })).toMatch(/2\.5\s?L/);
  });

  it('handles zero, which is distinct from absent', () => {
    expect(formatINR(0)).toBe('₹0');
  });
});

describe('formatPriceRange', () => {
  it('says "On request" when neither bound is known', () => {
    // This is the honest default for bespoke work and is what the seeded
    // services render. It is a real state, not a missing value.
    expect(formatPriceRange(null, null)).toBe('On request');
    expect(formatPriceRange(undefined, undefined)).toBe('On request');
  });

  it('accepts a custom on-request label', () => {
    expect(formatPriceRange(null, null, 'INR', { onRequestLabel: 'Ask us' })).toBe('Ask us');
  });

  it('renders an open-ended lower bound', () => {
    expect(formatPriceRange(25_000, null)).toMatch(/^From ₹/);
  });

  it('renders an open-ended upper bound', () => {
    expect(formatPriceRange(null, 80_000)).toMatch(/^Up to ₹/);
  });

  it('collapses an equal band to a single figure', () => {
    const single = formatPriceRange(40_000, 40_000);
    expect(single).not.toContain('–');
    expect(single).not.toContain('From');
  });

  it('renders a genuine range with an en dash', () => {
    expect(formatPriceRange(25_000, 80_000)).toContain('–');
  });

  it('treats zero as a real bound rather than as absent', () => {
    // A free event has a real lower bound of 0. Using `||` instead of `??`
    // anywhere in this path would turn that into "On request".
    expect(formatPriceRange(0, 5_000)).toContain('–');
    expect(formatPriceRange(0, 5_000)).not.toBe('On request');
  });

  it('formats non-INR currencies with their own locale', () => {
    expect(formatPriceRange(1_000, 2_000, 'USD')).toContain('$');
    expect(formatPriceRange(1_000, 2_000, 'AED')).toMatch(/AED|د\.إ/);
  });
});

describe('parseMoney', () => {
  it('strips grouping separators and currency symbols', () => {
    expect(parseMoney('₹2,50,000')).toBe(250_000);
    expect(parseMoney('45,000')).toBe(45_000);
    expect(parseMoney('  1500  ')).toBe(1500);
  });

  it('distinguishes empty from zero', () => {
    // A caller needs to tell "left blank" from "entered 0".
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('   ')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('0')).toBe(0);
  });

  it('rejects negatives', () => {
    expect(parseMoney('-500')).toBe(500);
  });
});
