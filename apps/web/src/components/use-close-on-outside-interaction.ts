'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Closes an open `<details>` disclosure when the visitor clicks/taps
 * anywhere outside it, or presses Escape — the one thing a native
 * `<details>` doesn't do on its own. Without this, both the header's
 * desktop "Personas" dropdown and the mobile menu only ever closed by
 * clicking their own `<summary>` a second time, which reads as broken to
 * anyone used to how every other dropdown/menu on the web behaves.
 */
export function useCloseOnOutsideInteraction(ref: RefObject<HTMLDetailsElement | null>): void {
  useEffect(() => {
    function onPointerDown(event: PointerEvent): void {
      const element = ref.current;
      if (!element?.open) return;
      if (event.target instanceof Node && !element.contains(event.target)) {
        element.open = false;
      }
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      const element = ref.current;
      if (element?.open) element.open = false;
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref]);
}
