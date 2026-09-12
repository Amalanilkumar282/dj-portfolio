'use client';

import { useEffect, useState } from 'react';

/**
 * Motion primitives, scoped down from the masterplan's dedicated
 * `packages/motion`. A real, standalone package is deferred until
 * `apps/admin` needs the same capability checks (it doesn't yet — nothing
 * in the admin UI is motion-heavy) — see STATUS.md's Group E section. These
 * two hooks are pure and dependency-free, so hoisting them later is a file
 * move, not a rewrite.
 */

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent): void => {
      setReduced(event.matches);
    };
    query.addEventListener('change', listener);
    return () => {
      query.removeEventListener('change', listener);
    };
  }, []);

  return reduced;
}

interface NetworkInformation {
  saveData?: boolean;
}

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  connection?: NetworkInformation;
}

/**
 * A conservative "can this device handle a heavy visual effect" check.
 * Missing APIs (Safari has none of these) default to **capable** — a
 * false negative there costs nothing but the fallback rendering instead,
 * which is meant to be beautiful on its own anyway (masterplan §5.6).
 */
export function useCapability(): { capable: boolean; coarsePointer: boolean } {
  const [state, setState] = useState({ capable: true, coarsePointer: false });

  useEffect(() => {
    const nav = navigator as NavigatorWithHints;
    const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4;
    const lowConcurrency = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 2;
    const saveData = nav.connection?.saveData === true;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

    setState({ capable: !lowMemory && !lowConcurrency && !saveData, coarsePointer });
  }, []);

  return state;
}
