import Link from 'next/link';

import { getPersonas } from '../server/queries/personas';

import { MobileNav } from './mobile-nav';
import { PersonaMenu } from './persona-menu';

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
          <PersonaMenu personas={personas} />
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
