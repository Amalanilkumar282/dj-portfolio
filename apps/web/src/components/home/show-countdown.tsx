'use client';

import { useEffect, useState } from 'react';

/**
 * A live countdown to a deadline — doors, or the end of the early-bird window.
 *
 * The **server** decides whether a countdown is warranted and what it counts
 * to; this component only ticks. That split matters: the phase logic stays in
 * one pure, tested function (`resolveShowPhase`), and this island stays small
 * enough that it costs nothing on a page that may carry several.
 *
 * Server-rendered as a stable string first, then upgraded on mount. Rendering
 * a live value during SSR would hydrate-mismatch on every load, since the
 * server's "now" is always a little behind the client's.
 */
export function ShowCountdown({
  deadline,
  label,
}: {
  /** ISO string, not a Date — this crosses the server/client boundary. */
  deadline: string;
  label: string;
}): React.JSX.Element | null {
  const [remaining, setRemaining] = useState<string | null>(null);

  useEffect(() => {
    const target = new Date(deadline).getTime();

    function tick(): void {
      setRemaining(format(target - Date.now()));
    }

    tick();
    // Once a minute is enough: nothing here shows seconds, and a 1s interval
    // on a page that may hold several of these is pure battery cost.
    const timer = window.setInterval(tick, 60_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [deadline]);

  if (remaining === null) {
    // Pre-hydration and for anyone without JS: say nothing rather than show a
    // frozen number that looks live but is not.
    return null;
  }

  return (
    <p className="text-fg-muted font-mono text-xs uppercase">
      {label} <span className="text-accent">{remaining}</span>
    </p>
  );
}

function format(ms: number): string {
  if (ms <= 0) return 'now';

  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);

  if (days > 0) return `${String(days)}d ${String(hours)}h`;
  if (hours > 0) return `${String(hours)}h ${String(minutes % 60)}m`;
  return `${String(minutes)}m`;
}
