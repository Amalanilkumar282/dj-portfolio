'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '../lib/auth-context';
import { previewUrl } from '../lib/preview';

interface NavItem {
  href: string;
  label: string;
  permission?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  { label: '', items: [{ href: '/', label: 'Dashboard' }] },
  {
    label: 'Music & shows',
    items: [
      { href: '/personas', label: 'Personas', permission: 'persona:read' },
      { href: '/tracks', label: 'Tracks', permission: 'track:read' },
      { href: '/releases', label: 'Releases', permission: 'release:read' },
      { href: '/playlists', label: 'Playlists', permission: 'playlist:read' },
      { href: '/programs', label: 'Programs', permission: 'program:read' },
      { href: '/events', label: 'Events', permission: 'event:read' },
      { href: '/venues', label: 'Venues', permission: 'venue:read' },
      { href: '/genres', label: 'Genres', permission: 'genre:read' },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/testimonials', label: 'Testimonials', permission: 'testimonial:read' },
      { href: '/services', label: 'Services', permission: 'service:read' },
      { href: '/faqs', label: 'FAQs', permission: 'faq:read' },
      { href: '/experience', label: 'Experience', permission: 'experience:read' },
      { href: '/brands', label: 'Brands', permission: 'brand:read' },
      { href: '/gear', label: 'Gear', permission: 'gear:read' },
      { href: '/press-assets', label: 'Press assets', permission: 'pressAsset:read' },
      { href: '/pages', label: 'Static pages', permission: 'staticPage:read' },
      { href: '/posts', label: 'Blog posts', permission: 'post:read' },
      { href: '/tags', label: 'Tags', permission: 'tag:read' },
      { href: '/stats', label: 'Stats', permission: 'stat:read' },
    ],
  },
  {
    label: 'Media',
    items: [
      { href: '/media', label: 'Media library', permission: 'media:read' },
      { href: '/galleries', label: 'Galleries', permission: 'gallery:read' },
      { href: '/videos', label: 'Videos', permission: 'video:read' },
    ],
  },
  {
    label: 'Bookings',
    items: [{ href: '/inquiries', label: 'Bookings', permission: 'inquiry:read' }],
  },
  {
    label: 'Site',
    items: [
      { href: '/settings', label: 'Settings', permission: 'settings:read' },
      { href: '/redirects', label: 'Redirects', permission: 'redirect:read' },
    ],
  },
  {
    label: 'System',
    items: [{ href: '/audit-log', label: 'Audit log', permission: 'auditLog:read' }],
  },
];

/** One small SVG dot per nav group — enough visual anchor to scan the list quickly. */
function GroupDot({ className }: { className?: string }): React.JSX.Element {
  return <span aria-hidden="true" className={`inline-block size-1.5 rounded-full ${className ?? ''}`} />;
}

/**
 * The protected shell. Auth is checked client-side (`useAuth`'s silent
 * refresh runs in the root layout, above this one) — the real enforcement
 * boundary is the API itself (every admin route requires a valid access
 * token server-side), this is purely a UX redirect so a signed-out visitor
 * sees `/login` instead of a page full of failed requests.
 *
 * Visual language deliberately mirrors the public site's own token layer
 * (`@dj/ui`'s theme.css) rather than inventing a second one — an accent
 * left-rail on the active nav item, the same radius/spacing scale, the same
 * type ramp — so the artist recognises this as "the same brand", not a
 * separate, colder developer tool bolted onto it.
 */
export function DashboardShell({ children }: { children: React.ReactNode }): React.JSX.Element | null {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // A route change (clicking any nav link) closes the mobile drawer — the
  // same class of bug flagged on the public site's header menu, fixed here
  // before it could ship the same way.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-fg-muted text-sm">Loading…</p>
      </div>
    );
  }

  if (!user) return null;

  const siteUrl = previewUrl('/') ?? process.env.NEXT_PUBLIC_SITE_URL ?? '/';

  const nav = (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter(
          (item) => !item.permission || user.permissions.includes(item.permission),
        );
        if (items.length === 0) return null;
        return (
          <div key={group.label || 'root'}>
            {group.label ? (
              <p className="text-fg-muted mb-1.5 flex items-center gap-1.5 px-3 text-[11px] font-semibold tracking-widest uppercase">
                <GroupDot className="bg-border" />
                {group.label}
              </p>
            ) : null}
            <div className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
                      active
                        ? 'bg-accent-soft text-fg-strong font-semibold'
                        : 'text-fg-secondary hover:bg-surface-raised hover:text-fg-strong'
                    }`}
                  >
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="bg-accent absolute inset-y-1 left-0 w-0.5 rounded-full"
                      />
                    ) : null}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-border bg-surface p-4 lg:block">
        <Link href="/" className="mb-6 block font-display text-lg tracking-tight text-fg-strong">
          DJ <span className="text-accent">Felicitous</span>
        </Link>
        {nav}
      </aside>

      {/* Mobile drawer — the sidebar collapses below `lg`, opened from the topbar. */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setMobileNavOpen(false);
            }}
          />
          <aside className="relative w-72 max-w-[85vw] overflow-y-auto border-r border-border bg-surface p-4">
            <div className="mb-6 flex items-center justify-between">
              <Link href="/" className="font-display text-lg tracking-tight text-fg-strong">
                DJ <span className="text-accent">Felicitous</span>
              </Link>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => {
                  setMobileNavOpen(false);
                }}
                className="text-fg-muted text-xl leading-none"
              >
                ✕
              </button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-6">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => {
              setMobileNavOpen(true);
            }}
            className="text-fg-strong rounded-md border border-border px-2.5 py-1.5 text-sm lg:hidden"
          >
            ☰
          </button>

          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="border-accent/40 text-accent hover:bg-accent-soft hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors sm:inline-flex"
          >
            View live site ↗
          </a>

          <div className="ml-auto flex items-center gap-4">
            <p className="text-fg-muted hidden text-sm sm:block">{user.email}</p>
            <button
              type="button"
              onClick={() => {
                void logout().then(() => {
                  router.replace('/login');
                });
              }}
              className="text-fg-muted hover:text-fg-strong text-sm underline underline-offset-2"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
