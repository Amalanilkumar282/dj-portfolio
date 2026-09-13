import Link from 'next/link';

import { getSettings } from '../server/queries/settings';

const LINK_COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Explore',
    links: [
      { href: '/music', label: 'Music' },
      { href: '/events', label: 'Events' },
      { href: '/programs', label: 'Residencies' },
      { href: '/venues', label: 'Venues' },
      { href: '/blog', label: 'Blog' },
    ],
  },
  {
    title: 'Work with us',
    links: [
      { href: '/services', label: 'Services' },
      { href: '/book', label: 'Book' },
      { href: '/press', label: 'Press kit' },
      { href: '/rider', label: 'Technical rider' },
      { href: '/testimonials', label: 'Testimonials' },
    ],
  },
  {
    title: 'About',
    links: [
      { href: '/about', label: 'About' },
      { href: '/setup', label: 'Setup & gear' },
      { href: '/faq', label: 'FAQ' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/cookies', label: 'Cookies' },
    ],
  },
];

export async function Footer(): Promise<React.JSX.Element> {
  const settings = await getSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-(--spacing-gutter) py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="font-display text-fg-strong text-lg">{settings.siteName}</p>
            {settings.siteTagline ? (
              <p className="text-fg-muted mt-2 text-sm">{settings.siteTagline}</p>
            ) : null}
            <address className="text-fg-muted mt-4 space-y-1 text-sm not-italic">
              {settings.addressCity ? (
                <p>
                  {settings.addressCity}
                  {settings.addressRegion ? `, ${settings.addressRegion}` : ''}
                  {settings.serviceAreaText ? ` — serving ${settings.serviceAreaText}` : ''}
                </p>
              ) : null}
              {settings.contactEmail ? (
                <p>
                  <a href={`mailto:${settings.contactEmail}`} className="hover:text-accent">
                    {settings.contactEmail}
                  </a>
                </p>
              ) : null}
              {settings.contactPhone ? (
                <p>
                  <a href={`tel:${settings.contactPhone}`} className="hover:text-accent">
                    {settings.contactPhone}
                  </a>
                </p>
              ) : null}
            </address>
          </div>
          {LINK_COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="text-fg-strong text-sm font-semibold">{column.title}</p>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-fg-muted hover:text-accent text-sm">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="text-fg-muted mt-12 text-xs">
          © {year} {settings.siteName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
