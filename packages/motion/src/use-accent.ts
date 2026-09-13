'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The live accent colour, resolved to numbers a shader can use.
 *
 * Two problems solved at once:
 *
 * 1. `--color-accent` is OKLCH in theme.css but a plain hex when the CMS
 *    overrides it per persona. Parsing both in JS would mean shipping a
 *    colour library.
 * 2. `dj/no-raw-color-literals` forbids hex in app code, so a shader cannot
 *    simply hardcode its palette — and it shouldn't, because the palette
 *    belongs to whichever persona the visitor is tuned to.
 *
 * Setting a probe element's `color` to `var(--color-accent)` and reading it
 * back makes the browser do the conversion: `getComputedStyle` always
 * returns a resolved `rgb()`/`rgba()` string regardless of the input format.
 * `player/audio-visualizer.tsx` already uses this trick.
 */
export type Rgb = readonly [number, number, number];

const FALLBACK: Rgb = [0.4, 0.85, 1];

function parseComputedColor(value: string): Rgb | null {
  const match = /rgba?\(([^)]+)\)/.exec(value);
  if (!match?.[1]) return null;

  const parts = match[1]
    .split(/[\s,/]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(Number);

  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  return [(parts[0] ?? 0) / 255, (parts[1] ?? 0) / 255, (parts[2] ?? 0) / 255];
}

/**
 * Reads `--color-accent` (or any custom property) as normalised 0–1 RGB.
 *
 * `element` scopes the read: pass the canvas itself so a persona-themed
 * subtree resolves to that persona's accent rather than the site default.
 */
export function useAccentRgb(
  elementRef: React.RefObject<HTMLElement | null>,
  property = '--color-accent',
): Rgb {
  const [rgb, setRgb] = useState<Rgb>(FALLBACK);
  const probeRef = useRef<HTMLSpanElement | null>(null);

  const read = useCallback(() => {
    const host = elementRef.current;
    if (!host) return;

    let probe = probeRef.current;
    if (!probe) {
      probe = document.createElement('span');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.position = 'absolute';
      probe.style.width = '0';
      probe.style.height = '0';
      probe.style.opacity = '0';
      probe.style.pointerEvents = 'none';
      probeRef.current = probe;
    }

    // Re-parented every read so it always inherits from the current host,
    // which is what makes a per-persona subtree resolve correctly.
    host.appendChild(probe);
    probe.style.color = `var(${property})`;
    const parsed = parseComputedColor(getComputedStyle(probe).color);
    probe.remove();

    if (parsed) setRgb((current) => (current.every((v, i) => v === parsed[i]) ? current : parsed));
  }, [elementRef, property]);

  useEffect(() => {
    read();

    // The channel switcher sets --color-accent on documentElement, which no
    // event fires for. A cheap rAF-throttled poll during the crossfade
    // window is far simpler than threading a callback through every layer,
    // and it stops as soon as the value settles.
    let frame = 0;
    let settled = 0;
    const tick = (): void => {
      read();
      settled += 1;
      // ~2s of polling covers --duration-slow (520ms) several times over.
      if (settled < 120) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const restart = (): void => {
      settled = 0;
    };
    window.addEventListener('dj:accent-change', restart);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('dj:accent-change', restart);
      probeRef.current?.remove();
    };
  }, [read]);

  return rgb;
}
