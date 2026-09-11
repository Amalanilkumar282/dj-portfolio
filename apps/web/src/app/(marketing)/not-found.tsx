import Link from 'next/link';

/** "No signal" — a deliberately on-brand 404 with search and top links, not the legacy blank page. */
export default function MarketingNotFound(): React.JSX.Element {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-eyebrow text-accent font-semibold uppercase">404</p>
      <h1 className="font-display text-h3 text-fg-strong">No signal</h1>
      <p className="text-fg-secondary">
        That page doesn&apos;t exist, or moved. Try one of these instead.
      </p>
      <nav aria-label="Suggested pages" className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="text-accent text-sm underline">
          Home
        </Link>
        <Link href="/music" className="text-accent text-sm underline">
          Music
        </Link>
        <Link href="/events" className="text-accent text-sm underline">
          Events
        </Link>
        <Link href="/contact" className="text-accent text-sm underline">
          Contact
        </Link>
      </nav>
    </div>
  );
}
