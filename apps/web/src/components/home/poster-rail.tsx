'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * One horizontal, snapping rail of cards — the shows rows, the gallery strip
 * and the video strip all use this.
 *
 * Built on native scrolling rather than a transform-driven carousel, because
 * native scrolling already gives touch momentum, trackpad swipe, keyboard
 * arrow keys inside the scroll region, and a scrollbar that tells the viewer
 * how much is left. A JS carousel has to reimplement all four and usually
 * reimplements two.
 *
 * Three things here are load-bearing rather than decorative:
 *
 * 1. **`overflow-x` lives on this element and nowhere above it.** Two
 *    horizontal-scroll bugs have already been fixed on mobile in this
 *    codebase; both were an inner element wider than the viewport with no
 *    scroll container of its own, so the page body scrolled instead. The
 *    rail scrolls; the page never does.
 * 2. **`min-w-0` on the flex children.** A flex item's default `min-width`
 *    is `auto` — its content's min-content width — so a long, unbroken title
 *    would push the card wider than its declared width and blow out the row.
 * 3. **The Prev/Next buttons are real, focusable buttons**, not decoration
 *    over a drag gesture. They are the keyboard and assistive-tech route to
 *    the same content, which is the accessible baseline this project
 *    requires (the same discipline the removed gig map used: a decorative
 *    visual is never the only way to reach the information).
 */
export function PosterRail({
  label,
  children,
}: {
  /** Accessible name for the scroll region, e.g. "Upcoming shows". */
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const sync = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;

    // A one-pixel tolerance: sub-pixel layout means scrollLeft rarely lands
    // exactly on the maximum, which would leave "Next" enabled forever.
    setCanScrollBack(el.scrollLeft > 1);
    setCanScrollForward(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    sync();

    const el = scrollerRef.current;
    if (!el) return;

    // The rail's own width changes on resize, and so does whether it
    // overflows at all — on a wide desktop a three-card row may not scroll,
    // and the arrows should disappear rather than sit there doing nothing.
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [sync]);

  const step = useCallback((direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // Scroll by just under a viewport so the card at the edge stays partly
    // visible — a full-width jump loses the reader's place.
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  }, []);

  const showArrows = canScrollBack || canScrollForward;

  return (
    <div className="relative">
      {showArrows ? (
        <div className="mb-4 flex justify-end gap-2">
          <RailButton
            direction="back"
            disabled={!canScrollBack}
            onClick={() => {
              step(-1);
            }}
            label={`Scroll ${label} backwards`}
          />
          <RailButton
            direction="forward"
            disabled={!canScrollForward}
            onClick={() => {
              step(1);
            }}
            label={`Scroll ${label} forwards`}
          />
        </div>
      ) : null}

      <ul
        ref={scrollerRef}
        onScroll={sync}
        aria-label={label}
        // A scrollable region must be focusable or its content is unreachable
        // by keyboard (WCAG 2.1.1), and browsers do not do this automatically
        // for an overflow container. `role="group"` is what makes the
        // tabIndex legitimate rather than a stray tab stop: it gives the
        // region a name and a purpose in the accessibility tree, so a screen
        // reader announces "Upcoming shows, group" rather than landing the
        // user on an anonymous focusable list.
        role="group"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region is the documented exception: WCAG 2.1.1 requires its content be reachable by keyboard, and browsers do not make an overflow container focusable on their own. `role="group"` plus `aria-label` give it a name and a purpose, so it is an intentional stop rather than a stray one.
        tabIndex={0}
        className="-mx-(--spacing-gutter) flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-(--spacing-gutter) pb-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--color-accent)"
      >
        {children}
      </ul>
    </div>
  );
}

/** One card slot. Fixed width so the rail has something to snap to. */
export function PosterRailItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <li
      className={[
        'min-w-0 shrink-0 snap-start',
        className ?? 'w-[15rem] sm:w-[16rem]',
      ].join(' ')}
    >
      {children}
    </li>
  );
}

function RailButton({
  direction,
  disabled,
  onClick,
  label,
}: {
  direction: 'back' | 'forward';
  disabled: boolean;
  onClick: () => void;
  label: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="border-border text-fg-secondary hover-hover:hover:border-accent hover-hover:hover:text-accent flex size-9 items-center justify-center rounded-full border transition-[color,border-color] duration-(--duration-fast) disabled:opacity-30 disabled:hover:border-(--color-border) disabled:hover:text-(--color-fg-secondary)"
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className={`size-4 ${direction === 'back' ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
