'use client';

import { useEffect, useRef, useState } from 'react';

import { useReducedMotion } from '@dj/motion';

/**
 * Counts a stat up when it scrolls into view.
 *
 * The final value is **server-rendered as the initial state**, so the number
 * is in the HTML, correct for search engines and for a no-JS visitor; the
 * count only ever replays a value that is already there. Under reduced
 * motion it never animates at all.
 *
 * These are the artist's hand-curated figures, not live platform counts —
 * see docs/07-content/brand.md. Nothing here implies real-time.
 */
export function CountUp({
  value,
  suffix,
  durationMs = 1100,
}: {
  value: number;
  suffix?: string | undefined;
  durationMs?: number;
}): React.JSX.Element {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduced) return;
    const element = ref.current;
    if (!element) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting !== true) return;
        observer.disconnect();
        const started = performance.now();
        const step = (now: number): void => {
          const t = Math.min(1, (now - started) / durationMs);
          // easeOutQuart, matching --ease-out-quart in the token layer.
          setShown(Math.round(value * (1 - Math.pow(1 - t, 4))));
          if (t < 1) frame = requestAnimationFrame(step);
        };
        setShown(0);
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, durationMs, reduced]);

  return (
    <span ref={ref} className="tabular-nums">
      {shown.toLocaleString('en-IN')}
      {suffix ?? ''}
    </span>
  );
}
