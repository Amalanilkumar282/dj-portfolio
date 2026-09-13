'use client';

import Link from 'next/link';

/**
 * A Client Component is unavoidable here — Next requires `error.tsx` to be
 * one, since it needs `useEffect`/event handlers to offer a retry. It is a
 * leaf, not a route file in the `dj/no-client-in-route-files` sense.
 */
export default function MarketingError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-h3 text-fg-strong">Something went wrong</h1>
      <p className="text-fg-secondary">
        That page hit an error loading its content. Try again, or head back home.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="bg-accent text-on-accent rounded-full px-5 py-2 text-sm font-semibold"
        >
          Try again
        </button>
        <Link href="/" className="rounded-full border border-border px-5 py-2 text-sm">
          Home
        </Link>
      </div>
    </div>
  );
}
