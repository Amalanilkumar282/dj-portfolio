/**
 * Money formatting.
 *
 * The business is Bangalore-based and quotes in rupees. The legacy booking
 * form offered USD brackets ("under-500", "over-5000"), which was wrong for
 * every real client. INR with Indian digit grouping (lakh/crore) is the
 * default everywhere.
 */

export type SupportedCurrency = 'INR' | 'USD' | 'EUR' | 'AED' | 'GBP';

const LOCALE_BY_CURRENCY: Record<SupportedCurrency, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'en-IE',
  AED: 'en-AE',
  GBP: 'en-GB',
};

/**
 * Formats a rupee amount with Indian grouping: 250000 renders as "₹2,50,000".
 *
 * `compact` is for stat tiles and price-from badges where the exact figure
 * matters less than the magnitude ("₹2.5L").
 */
export function formatINR(
  amount: number,
  options: { compact?: boolean; withDecimals?: boolean } = {},
): string {
  const { compact = false, withDecimals = false } = options;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: compact ? 'compact' : 'standard',
    // Compact notation needs one fraction digit or it destroys the precision
    // it exists to convey: 250000 would render as "₹3L" rather than "₹2.5L".
    maximumFractionDigits: compact ? 1 : withDecimals ? 2 : 0,
    minimumFractionDigits: withDecimals && !compact ? 2 : 0,
  }).format(amount);
}

function formatAmount(amount: number, currency: SupportedCurrency, compact: boolean): string {
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency], {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    // Same reasoning as formatINR: rounding a compact figure to whole units
    // turns "from ₹2.5L" into "from ₹3L", which overstates the price.
    maximumFractionDigits: compact ? 1 : 0,
  }).format(amount);
}

/**
 * Renders a service or ticket price band.
 *
 * Both bounds absent is a legitimate state ("price on request") because
 * quoting a number for a bespoke wedding set would be misleading.
 */
export function formatPriceRange(
  from: number | null | undefined,
  to: number | null | undefined,
  currency: SupportedCurrency = 'INR',
  options: { compact?: boolean; onRequestLabel?: string } = {},
): string {
  const { compact = true, onRequestLabel = 'On request' } = options;

  // Ordered so each branch narrows on its own condition rather than relying on
  // an earlier `return`. TypeScript cannot carry a narrowing from
  // `from == null && to == null` into a later `if (from == null)`, so the
  // both-present case is handled first and no assertion is ever needed.
  if (from != null && to != null) {
    if (from === to) return formatAmount(from, currency, compact);
    return `${formatAmount(from, currency, compact)} – ${formatAmount(to, currency, compact)}`;
  }

  if (from != null) return `From ${formatAmount(from, currency, compact)}`;
  if (to != null) return `Up to ${formatAmount(to, currency, compact)}`;

  return onRequestLabel;
}

/**
 * Parses a user-entered amount, tolerating grouping separators and a currency
 * symbol. Returns null for anything not a finite non-negative number, so a
 * caller can distinguish "empty" from "zero".
 */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (cleaned === '') return null;

  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
