'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { setConsent } from '../app/consent-actions';
import { CONSENT_COOKIE } from '../lib/analytics';

/**
 * A non-blocking, keyboard-accessible consent prompt. Reads
 * `document.cookie` only to decide whether to render at all (no analytics
 * script is ever gated by this client-side read — that gate is the server
 * component `AnalyticsScript`, which cannot be bypassed by disabling JS).
 *
 * This is one of two things fixed to the bottom of the viewport — the other
 * is `<ContactDock>`'s WhatsApp/call buttons, present on every marketing
 * page regardless of consent state. Without coordination the two painted on
 * top of each other on first visit. This measures its own real height (a
 * two-line notice wraps taller than a one-line one, so a guessed constant
 * would drift) and publishes it the same way `<MiniPlayer>` publishes its
 * own — `<ContactDock>` reads both and stacks above whichever are present.
 */
export function ConsentBanner(): React.JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hasDecided = document.cookie.split('; ').some((row) => row.startsWith(`${CONSENT_COOKIE}=`));
    if (!hasDecided) setVisible(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const element = ref.current;
    if (!visible || !element) {
      root.style.removeProperty('--consent-clearance');
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      // +8px buffer: a `font-display: swap` webfont arriving after this
      // banner's first paint can reflow its line count, and this box's own
      // border/padding is included in `border-box` but not always caught by
      // the very first callback the same frame the font swaps in.
      const height = entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height;
      root.style.setProperty('--consent-clearance', `${String(Math.ceil(height) + 8)}px`);
    });
    observer.observe(element, { box: 'border-box' });
    return () => {
      observer.disconnect();
      root.style.removeProperty('--consent-clearance');
    };
  }, [visible]);

  if (!visible) return null;

  function decide(value: 'granted' | 'denied'): void {
    startTransition(async () => {
      await setConsent(value);
      setVisible(false);
      // The analytics script is decided server-side from the cookie just
      // set; a full reload is the simplest way to pick that up on "granted"
      // without introducing client-side script injection as a second path.
      if (value === 'granted') window.location.reload();
    });
  }

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-3 border-t border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-fg-secondary text-sm">
        We use privacy-friendly analytics to understand which pages help people book a DJ. No tracking
        cookies are set until you say yes.
      </p>
      <div className="flex shrink-0 gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            decide('denied');
          }}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-fg-strong disabled:opacity-60"
        >
          Decline
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            decide('granted');
          }}
          className="bg-accent text-on-accent rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
