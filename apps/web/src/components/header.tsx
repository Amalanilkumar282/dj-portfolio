import Link from 'next/link';

import { getPersonas } from '../server/queries/personas';

import { MobileNav } from './mobile-nav';

const NAV_LINKS = [
  { href: '/music', label: 'Music' },
  { href: '/events', label: 'Events' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
];

/**
 * Server Component. The mobile menu is a `<details>` disclosure rather than a
 * client-side drawer — zero JS, fully keyboard- and screen-reader-operable,
 * and one fewer client island against the ≤6 budget for the pieces that
 * genuinely need one (mini player, lightbox, booking wizard — Phases 8/9).
 */
export async function Header(): Promise<React.JSX.Element> {
  const personas = await getPersonas();

  return (
    <header className="border-border bg-bg/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-(--spacing-gutter) py-4">
        <Link
          href="/"
          className="font-display text-fg-strong shrink-0 text-xl tracking-tight sm:text-2xl"
        >
          DJ <span className="text-accent">Felicitous</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {/* A native `<details>` disclosure, not a hover-only group: hover
              alone left this dropdown fully inert for anyone without a
              fine, hover-capable pointer (any touch device, and some
              laptops), and its trigger was a plain `<span>` — not
              focusable or clickable by itself. `<details>`/`<summary>`
              gets click, tap and keyboard activation for free, with no JS,
              the same reasoning `MobileNav` already uses. */}
          <details className="group relative">
            <summary className="text-fg-secondary hover-hover:hover:text-fg-strong list-none text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden cursor-pointer">
              Personas
            </summary>
            <div className="absolute left-0 top-full z-10 mt-1 flex flex-col gap-1 rounded-(--radius-md) border border-border bg-surface p-2 shadow-lg">
              {personas.map((persona) => (
                <Link
                  key={persona.id}
                  href={`/${persona.slug}`}
                  className="text-fg-secondary hover-hover:hover:text-fg-strong hover-hover:hover:bg-surface-raised whitespace-nowrap rounded-(--radius-sm) px-3 py-1.5 text-sm"
                >
                  {persona.stageName}
                </Link>
              ))}
            </div>
          </details>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-fg-secondary hover-hover:hover:text-fg-strong text-sm font-medium"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/book"
            className="bg-accent text-on-accent rounded-(--radius-full) px-4 py-2 text-sm font-semibold"
          >
            Book now
          </Link>
        </nav>

        <MobileNav
          personas={personas.map((persona) => ({
            id: persona.id,
            slug: persona.slug,
            stageName: persona.stageName,
          }))}
          navLinks={NAV_LINKS}
        />
      </div>
    </header>
  );
}
