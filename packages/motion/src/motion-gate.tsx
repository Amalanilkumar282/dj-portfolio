'use client';

import { useCapability } from './use-capability';

/**
 * The one funnel every heavy visual passes through.
 *
 * The rule from docs/03-design-system/motion.md: the fallback is designed
 * first, server-rendered, and complete on its own. `static` is not a
 * degraded `full` — it is the composition the page is built on, which the
 * richer tiers then fade in *over*.
 *
 * `light` defaults to the `static` content when omitted, because that is
 * almost always right: the CSS composition underneath is already enough.
 */
export function MotionGate({
  full,
  light,
  static: staticTier,
}: {
  full: React.ReactNode;
  light?: React.ReactNode;
  static: React.ReactNode;
}): React.JSX.Element {
  const capability = useCapability();

  if (capability === 'full') return <>{full}</>;
  if (capability === 'light') return <>{light ?? staticTier}</>;
  return <>{staticTier}</>;
}
