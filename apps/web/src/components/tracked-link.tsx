'use client';

import { track, type AnalyticsEvent } from '../lib/analytics';

/**
 * A plain `<a>` that fires one analytics event on click and then lets
 * navigation proceed normally — no `preventDefault`, so it degrades to an
 * ordinary link with JavaScript disabled. `href` is destructured explicitly
 * (not spread) so eslint-plugin-jsx-a11y can see this is a real, native
 * anchor rather than a generic element with a click handler.
 */
export function TrackedLink({
  event,
  href,
  children,
  ...props
}: React.ComponentProps<'a'> & { event: AnalyticsEvent }): React.JSX.Element {
  return (
    <a
      href={href}
      {...props}
      onClick={() => {
        track(event);
      }}
    >
      {children}
    </a>
  );
}
