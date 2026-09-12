/**
 * @dj/motion — capability detection and the motion governance layer.
 *
 * Every heavy visual in apps/web routes through `MotionGate`, and every
 * tier it can render is a finished design rather than a degraded one. See
 * docs/03-design-system/motion.md, and ADR 0022 for why the tier gate is
 * memory-and-cores rather than pointer type.
 *
 * Must never import from apps/* (enforced by lint).
 */

export { MotionGate } from './motion-gate';
export { useCapability, useCoarsePointer, type Capability } from './use-capability';
export { useReducedMotion } from './use-reduced-motion';
export { useAccentRgb, type Rgb } from './use-accent';
export { DURATION, EASE, riseIn, stagger, fadeUp } from './variants';
