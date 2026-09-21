'use client';

import { useMemo } from 'react';
import { Color } from 'three';

import { useAccentRgb } from '@dj/motion';

/**
 * Resolves a CSS custom property to a `three.js` Color that retunes live
 * when the token changes (a persona switch, a reduced-motion toggle) — see
 * `useAccentRgb`'s doc comment for how the read itself works. Shared by
 * every procedurally built 3D scene so none of them re-implement the same
 * `getComputedStyle` probe.
 */
export function useTokenColor(host: React.RefObject<HTMLElement | null>, property: string): Color {
  const [r, g, b] = useAccentRgb(host, property);
  return useMemo(() => new Color(r, g, b), [r, g, b]);
}
