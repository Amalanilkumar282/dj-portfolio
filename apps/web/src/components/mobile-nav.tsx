'use client';

import Link from 'next/link';
import { useRef } from 'react';

/**
 * The mobile menu disclosure.
 *
 * A `<details>` element still — no drawer, no animation library, same
 * zero-dependency mechanism as before. The one thing that needed real JS:
 * closing it after a link inside is actually followed. A bare `<details>`
 * has no such behaviour, so every navigation left the panel open, covering
 * the page underneath until the visitor found and tapped "Menu" a second
 * time — on a phone, that reads as broken navigation, not as a menu.
 *
 * `close()` is attached to each `<Link>` directly rather than delegated
 * from the wrapping `<nav>` — a real interactive element already carries
 * keyboard activation for free, and a click handler on a non-interactive
 * container is both an a11y lint error and, on a phone, slower than
 * necessary (the browser has to bubble the event before anything runs).
 */
export function MobileNav({
  personas,
  navLinks,
}: {
  personas: { id: string; slug: string; stageName: string }[];
  navLinks: { href: string; label: string }[];
}): React.JSX.Element {
  const ref = useRef<HTMLDetailsElement>(null);

  function close(): void {
    if (ref.current) ref.current.open = false;
  }

  return (
    <details ref={ref} className="md:hidden">
      <summary className="text-fg-strong cursor-pointer list-none rounded-sm border border-border px-3 py-1.5 text-sm">
        Menu
      </summary>
      <nav
        aria-label="Primary"
        className="absolute inset-x-0 top-full flex flex-col gap-1 border-b border-border bg-surface p-4"
      >
        {personas.map((persona) => (
          <Link
            key={persona.id}
            href={`/${persona.slug}`}
            onClick={close}
            className="text-fg-secondary py-2 text-sm"
          >
            {persona.stageName}
          </Link>
        ))}
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} onClick={close} className="text-fg-secondary py-2 text-sm">
            {link.label}
          </Link>
        ))}
        <Link href="/book" onClick={close} className="text-accent py-2 text-sm font-semibold">
          Book now
        </Link>
      </nav>
    </details>
  );
}
