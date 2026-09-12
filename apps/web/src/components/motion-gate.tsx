'use client';

import { useCapability, useReducedMotion } from '../lib/motion';

/**
 * Every heavy visual experience routes through this — never rendered
 * directly. `light` must be a complete, on-brand composition on its own
 * (masterplan §5.6's central rule), not a loading spinner for `heavy`.
 */
export function MotionGate({ heavy, light }: { heavy: React.ReactNode; light: React.ReactNode }): React.JSX.Element {
  const reducedMotion = useReducedMotion();
  const { capable } = useCapability();

  return <>{reducedMotion || !capable ? light : heavy}</>;
}
