import { describe, expect, it } from 'vitest';

import { durationToSeconds, formatDurationLabel, secondsToDuration } from '../duration.js';
import { slugify, uniqueSlug } from '../slug.js';
import { readingMinutes, stripMarkdown, truncate } from '../text.js';

describe('slugify', () => {
  it('produces lowercase hyphenated ASCII', () => {
    expect(slugify('Big Bollywood Night')).toBe('big-bollywood-night');
    expect(slugify('Bolly-Tech')).toBe('bolly-tech');
  });

  it('strips diacritics rather than replacing them', () => {
    // "Trinitrócosmic" must become trinitrocosmic, not trinitr-cosmic.
    expect(slugify('Trinitrócosmic')).toBe('trinitrocosmic');
    expect(slugify('Café Sessions')).toBe('cafe-sessions');
  });

  it('reads an ampersand as "and" instead of dropping it', () => {
    // Dropping it would merge the words into "djfelicitousdjgeetz".
    expect(slugify('DJ Felicitous & DJ Geetz')).toBe('dj-felicitous-and-dj-geetz');
  });

  it('normalises case so paths cannot break on case-sensitive hosts', () => {
    // The legacy site had /images/couple-1.JPG alongside couple-1.jpg, which
    // worked on Windows and 404d on Linux.
    expect(slugify('Couple-1.JPG')).toBe('couple-1-jpg');
  });

  it('collapses runs of separators and trims the ends', () => {
    expect(slugify('  Housefull   Sunday!!!  ')).toBe('housefull-sunday');
    expect(slugify('---a---b---')).toBe('a-b');
  });

  it('truncates at a word boundary', () => {
    const result = slugify('one two three four five six seven eight nine ten', 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith('-')).toBe(false);
  });
});

describe('uniqueSlug', () => {
  it('returns the base slug when it is free', async () => {
    await expect(uniqueSlug('Techno Night', () => false)).resolves.toBe('techno-night');
  });

  it('appends a discriminator until it is free', async () => {
    const taken = new Set(['techno-night', 'techno-night-2']);
    await expect(uniqueSlug('Techno Night', (s) => taken.has(s))).resolves.toBe('techno-night-3');
  });

  it('supports an async predicate, for a database lookup', async () => {
    const taken = new Set(['techno-night']);
    await expect(uniqueSlug('Techno Night', (s) => Promise.resolve(taken.has(s)))).resolves.toBe(
      'techno-night-2',
    );
  });

  it('throws rather than looping forever', async () => {
    await expect(uniqueSlug('x', () => true, 3)).rejects.toThrow(/unique slug/i);
  });
});

describe('duration', () => {
  it('formats minutes and seconds', () => {
    expect(secondsToDuration(3323)).toBe('55:23');
    expect(secondsToDuration(59)).toBe('0:59');
  });

  it('adds an hours component past an hour', () => {
    expect(secondsToDuration(3765)).toBe('1:02:45');
    expect(secondsToDuration(3600)).toBe('1:00:00');
  });

  it('renders an em dash for an unknown duration', () => {
    // The legacy data carried the string 'N/A' for most tracks.
    expect(secondsToDuration(null)).toBe('—');
    expect(secondsToDuration(undefined)).toBe('—');
  });

  it('round-trips through durationToSeconds', () => {
    expect(durationToSeconds('55:23')).toBe(3323);
    expect(durationToSeconds('1:02:45')).toBe(3765);
    expect(durationToSeconds(secondsToDuration(3323))).toBe(3323);
  });

  it('returns null for the legacy N/A placeholder', () => {
    expect(durationToSeconds('N/A')).toBeNull();
    expect(durationToSeconds('')).toBeNull();
    expect(durationToSeconds(null)).toBeNull();
  });

  it('produces a screen-reader label', () => {
    // The waveform canvas is aria-hidden, so this string is the only way a
    // non-sighted listener learns how long a set is.
    expect(formatDurationLabel(3765)).toBe('1 hour 2 minutes');
    expect(formatDurationLabel(3323)).toBe('55 minutes 23 seconds');
    expect(formatDurationLabel(null)).toBe('Duration unknown');
  });
});

describe('text', () => {
  it('truncates at a word boundary with an ellipsis', () => {
    const result = truncate('The quick brown fox jumps over the lazy dog', 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result).toMatch(/…$/);
    expect(result).not.toMatch(/\s…$/);
  });

  it('leaves short text untouched', () => {
    expect(truncate('Short', 155)).toBe('Short');
  });

  it('flattens markdown for meta descriptions', () => {
    // Persona bios are markdown; a meta description must not contain **.
    expect(stripMarkdown('**Bold** and _italic_')).toBe('Bold and italic');
    expect(stripMarkdown('# Heading\n\nBody text')).toBe('Heading Body text');
    expect(stripMarkdown('[DJ Felicitous](https://example.com)')).toBe('DJ Felicitous');
    expect(stripMarkdown('![alt](img.jpg) caption')).toBe('caption');
  });

  it('never reports zero reading minutes', () => {
    expect(readingMinutes('One word')).toBe(1);
    expect(readingMinutes('')).toBe(1);
    expect(readingMinutes('word '.repeat(450))).toBe(2);
  });
});
