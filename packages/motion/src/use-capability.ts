'use client';

import { useEffect, useState } from 'react';

import { useReducedMotion } from './use-reduced-motion';

/**
 * What this device and this visitor should be given.
 *
 * - `static` — the server-rendered composition, complete on its own. No
 *   island ever mounts, so no island chunk is ever fetched. This is what a
 *   reduced-motion, Save-Data or no-JS visitor gets, and it is the reason
 *   the reduced-motion budget (≤60KB JS) is achievable at all.
 * - `light`  — CSS/Canvas2D generative visuals and full scroll motion, but
 *   no WebGL and no 3D.
 * - `full`   — WebGL shader field and procedural 3D.
 *
 * See docs/03-design-system/motion.md.
 */
export type Capability = 'static' | 'light' | 'full';

interface NetworkInformation {
  saveData?: boolean;
}

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  connection?: NetworkInformation;
}

/**
 * Deliberately starts at `static` and upgrades after mount.
 *
 * Server and first client render must agree, and `static` is the only tier
 * that is correct without knowing anything about the device. Upgrading
 * afterwards is also what keeps the heavy chunks off the critical path:
 * nothing heavy is even referenced until the first effect runs.
 */
export function useCapability(): Capability {
  const reduced = useReducedMotion();
  const [deviceTier, setDeviceTier] = useState<Capability>('static');

  useEffect(() => {
    const nav = navigator as NavigatorWithHints;

    // Save-Data is a stated preference, like reduced motion — not an
    // inference about the hardware. It wins outright.
    if (nav.connection?.saveData === true) {
      setDeviceTier('static');
      return;
    }

    // Missing hints default to capable: Safari reports neither deviceMemory
    // nor a connection, and treating every iPhone as low-end would be worse
    // than occasionally being optimistic.
    const memory = nav.deviceMemory ?? 8;
    // Non-optional in the DOM types, but some browsers genuinely report 0.
    // Zero means "declined to say", not "no cores".
    const cores = nav.hardwareConcurrency > 0 ? nav.hardwareConcurrency : 8;

    // ADR 0022: the gate is memory and cores, not pointer type. A modern
    // phone runs a capped-DPR fragment shader comfortably; a four-core
    // laptop often does not.
    setDeviceTier(memory < 4 || cores <= 4 ? 'light' : 'full');
  }, []);

  return reduced ? 'static' : deviceTier;
}

/**
 * Pointer type, kept separate from the capability tier on purpose.
 *
 * Some effects are wrong on touch regardless of how fast the device is — a
 * magnetic cursor has no cursor to follow, and Lenis fights native momentum
 * scrolling. Those gate on this; raw rendering power gates on `useCapability`.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    setCoarse(query.matches);

    const onChange = (event: MediaQueryListEvent): void => {
      setCoarse(event.matches);
    };
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, []);

  return coarse;
}
