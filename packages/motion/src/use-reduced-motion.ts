'use client';

import { useEffect, useState } from 'react';

/**
 * `prefers-reduced-motion: reduce`, live.
 *
 * Starts `false` on the server and on the first client render so the markup
 * matches; the effect corrects it before paint work matters. The token layer
 * is the real kill switch (every duration goes to 1ms in theme.css) — this
 * hook exists for the cases CSS cannot reach, like declining to mount a
 * WebGL canvas at all.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent): void => {
      setReduced(event.matches);
    };
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, []);

  return reduced;
}
