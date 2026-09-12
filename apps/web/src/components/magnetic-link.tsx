'use client';

import Link from 'next/link';
import { useRef } from 'react';

import { useCapability } from '../lib/motion';

import { MotionGate } from './motion-gate';

const MAX_OFFSET = 8;

/**
 * §5.6 item 13. A subtle pointer-follow effect on the primary CTA — capped
 * at 8px, RAF-free (a plain `pointermove` handler is cheap enough at this
 * scale not to need coalescing). `<MotionGate>` swaps to a plain `<Link>`
 * under reduced motion or on a low-capability device; it is never mounted
 * on touch at all, since `(hover: hover) and (pointer: fine)` is the whole
 * point of a "magnetic" cursor effect.
 */
function InteractiveMagneticLink(props: React.ComponentProps<typeof Link>): React.JSX.Element {
  const ref = useRef<HTMLAnchorElement>(null);

  function onPointerMove(event: React.PointerEvent<HTMLAnchorElement>): void {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2 * MAX_OFFSET;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2 * MAX_OFFSET;
    el.style.transform = `translate3d(${String(x)}px, ${String(y)}px, 0)`;
  }

  function onPointerLeave(): void {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'translate3d(0, 0, 0)';
  }

  return (
    <Link
      {...props}
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{ transition: 'transform var(--duration-fast) var(--ease-out-quart)' }}
    />
  );
}

export function MagneticLink(props: React.ComponentProps<typeof Link>): React.JSX.Element {
  const { coarsePointer } = useCapability();
  if (coarsePointer) return <Link {...props} />;
  return <MotionGate heavy={<InteractiveMagneticLink {...props} />} light={<Link {...props} />} />;
}
