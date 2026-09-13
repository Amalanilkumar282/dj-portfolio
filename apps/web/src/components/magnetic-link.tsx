'use client';

import Link from 'next/link';
import { useRef } from 'react';

import { MotionGate, useCoarsePointer } from '@dj/motion';

const MAX_OFFSET = 8;

/**
 * A pointer-follow CTA, capped at 8px (motion.md item 13).
 *
 * Gated on pointer type rather than raw capability: a magnetic cursor on a
 * touch screen has no cursor to follow, however fast the device is. See
 * ADR 0022 for why those two gates are separate.
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
  const coarsePointer = useCoarsePointer();
  if (coarsePointer) return <Link {...props} />;

  return (
    <MotionGate
      full={<InteractiveMagneticLink {...props} />}
      static={<Link {...props} />}
    />
  );
}
