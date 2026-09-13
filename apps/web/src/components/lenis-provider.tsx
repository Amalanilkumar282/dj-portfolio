'use client';

import Lenis from 'lenis';
import { useEffect } from 'react';

import { useCapability, useCoarsePointer } from '@dj/motion';

/**
 * Smooth scroll (motion.md item 9).
 *
 * Off on touch because native momentum scrolling is genuinely better there,
 * and off below the `full` tier because a scroll hijack on a slow device is
 * the most obvious way to make a site feel broken. Native scroll is the
 * complete experience; this is additive.
 */
export function LenisProvider(): null {
  const capability = useCapability();
  const coarsePointer = useCoarsePointer();

  useEffect(() => {
    if (capability !== 'full' || coarsePointer) return;

    const lenis = new Lenis({ autoRaf: true });
    return () => {
      lenis.destroy();
    };
  }, [capability, coarsePointer]);

  return null;
}
