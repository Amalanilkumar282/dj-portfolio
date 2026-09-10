/**
 * Track and set duration handling.
 *
 * Durations are stored as integer seconds. The legacy data carried them as
 * free-text strings ("55:23", "N/A"), which made sorting, totalling a
 * playlist and emitting ISO-8601 for JSON-LD all impossible.
 */

/** "55:23" for a mix, "1:02:45" once past an hour. */
export function secondsToDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return '—';

  const seconds = Math.round(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return hours > 0
    ? `${String(hours)}:${pad(minutes)}:${pad(secs)}`
    : `${String(minutes)}:${pad(secs)}`;
}

/**
 * Parses "mm:ss" or "hh:mm:ss" into seconds. Returns null for unparseable
 * input, including the legacy "N/A" placeholder.
 */
export function durationToSeconds(value: string | null | undefined): number | null {
  if (!value) return null;

  const segments = value.trim().split(':');
  if (segments.length < 2 || segments.length > 3) return null;

  const numbers = segments.map(Number);
  if (numbers.some((n) => !Number.isInteger(n) || n < 0)) return null;

  return segments.length === 3
    ? (numbers[0] ?? 0) * 3600 + (numbers[1] ?? 0) * 60 + (numbers[2] ?? 0)
    : (numbers[0] ?? 0) * 60 + (numbers[1] ?? 0);
}

/**
 * Screen-reader and aria-valuetext label: "1 hour 2 minutes".
 *
 * The waveform canvas is aria-hidden, so this string is the only way a
 * non-sighted listener learns how long a set is.
 */
export function formatDurationLabel(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return 'Duration unknown';
  }

  const seconds = Math.round(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${String(hours)} hour${hours === 1 ? '' : 's'}`);
  if (minutes > 0) parts.push(`${String(minutes)} minute${minutes === 1 ? '' : 's'}`);
  // Only mention seconds for short items, where they carry information.
  if (secs > 0 && hours === 0) parts.push(`${String(secs)} second${secs === 1 ? '' : 's'}`);

  return parts.length > 0 ? parts.join(' ') : '0 seconds';
}
