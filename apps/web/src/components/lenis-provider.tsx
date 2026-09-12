'use client';

import Lenis from 'lenis';
import { useEffect } from 'react';

import { useCapability, useReducedMotion } from '../lib/motion';

/**
 * Smooth scroll (masterplan §5.6 item 9). Deliberately disabled — not
 * merely "less smooth" — under reduced motion, on touch (native momentum
 * scrolling is already better there), and on a low-`hardwareConcurrency`
 * device, matching the masterplan's own documented conditions exactly.
 * Native scroll is a complete, correct experience on its own; this is
 * additive.
 */
export function LenisProvider(): null {
  const reducedMotion = useReducedMotion();
  const { capable, coarsePointer } = useCapability();

  useEffect(() => {
    if (reducedMotion || coarsePointer || !capable) return;

    const lenis = new Lenis({ autoRaf: true });
    return () => {
      lenis.destroy();
    };
  }, [reducedMotion, coarsePointer, capable]);

  return null;
}
