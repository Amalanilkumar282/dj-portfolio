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

/** One nav row, extracted so the collapsible-group and root cases render it identically. */
function NavLink({ item, active }: { item: NavItem; active: boolean }): React.JSX.Element {
  return (
    <Link
      href={item.href}
      className={`relative rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
        active
          ? 'bg-accent-soft text-fg-strong font-semibold'
          : 'text-fg-secondary hover:bg-surface-raised hover:text-fg-strong'
      }`}
    >
      {active ? (
        <span aria-hidden="true" className="bg-accent absolute inset-y-1 left-0 w-0.5 rounded-full" />
      ) : null}
      {item.label}
    </Link>
  );
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
const COLLAPSE_STORAGE_KEY = 'dj-admin-nav-collapsed';

/** Which group a route belongs to, so navigating somewhere always reveals it. */
function ownerGroupLabel(pathname: string): string | null {
  const group = NAV_GROUPS.find((g) => g.items.some((item) => item.href === pathname));
  // `||`, deliberately not `??`: the root group's label is `''`, and an
  // empty string must be treated the same as a missing group here.
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  return group?.label || null;
}

export function DashboardShell({ children }: { children: React.ReactNode }): React.JSX.Element | null {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  /**
   * Which nav groups are collapsed, by label. There are 7 groups and some
   * (Content) hold 11 items — collapsing the ones you're not using cuts a
   * long scroll down to a glance, the same reasoning `EntityList`'s own
   * pagination follows for a long list of rows.
   *
   * Persisted per browser via `localStorage`, not a runtime capability: this
   * is a per-viewer convenience (which sections *this admin* likes open),
   * never shared state and never read back by the server, so the simpler
   * mechanism is the right one. Wrapped in try/catch — a private window or
   * blocked site data can throw, and the shell must still render without it.
   */
  // Starts empty (everything expanded) for hydration safety — reading
  // localStorage during the initial render would throw on the server, the
  // same reasoning `useCapability` in @dj/motion starts at its most
  // conservative tier and upgrades in an effect. The one-frame flash from
  // "expanded" to "collapsed" on a repeat visit is the acceptable cost.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]));
    } catch {
      // Private window, blocked site data, etc. — just stay expanded.
    }
  }, []);

  function toggleGroup(label: string): void {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Best-effort only — a blocked localStorage just means the
        // collapsed state resets next visit, not a broken shell.
      }
      return next;
    });
  }

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // A route change (clicking any nav link) closes the mobile drawer — the
  // same class of bug flagged on the public site's header menu, fixed here
  // before it could ship the same way.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Never leave the admin looking at a page whose own nav group is hidden —
  // landing on /events/new (say, from the dashboard's own shortcuts) must
  // reveal "Music & shows" even if it was collapsed on the last visit.
  useEffect(() => {
    const owner = ownerGroupLabel(pathname);
    if (owner) setCollapsed((current) => (current.has(owner) ? new Set([...current].filter((l) => l !== owner)) : current));
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
    <nav className="flex flex-col gap-1">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter(
          (item) => !item.permission || user.permissions.includes(item.permission),
        );
        if (items.length === 0) return null;

        // The one ungrouped "Dashboard" row (empty label) is never
        // collapsible — there's nothing to collapse, and it's the one link
        // that should always stay one click away.
        if (!group.label) {
          return (
            <div key="root" className="mb-4 flex flex-col gap-0.5">
              {items.map((item) => (
                <NavLink key={item.href} item={item} active={pathname === item.href} />
              ))}
            </div>
          );
        }

        const isCollapsed = collapsed.has(group.label);
        const panelId = `nav-group-${group.label.replace(/\s+/g, '-').toLowerCase()}`;

        return (
          <div key={group.label} className="mb-1">
            <button
              type="button"
              aria-expanded={!isCollapsed}
              aria-controls={panelId}
              onClick={() => {
                toggleGroup(group.label);
              }}
              className="text-fg-muted hover:text-fg-secondary flex w-full items-center gap-1.5 rounded-md px-3 py-2 text-[11px] font-semibold tracking-widest uppercase transition-colors"
            >
              <GroupDot className="bg-border" />
              <span className="flex-1 text-left">{group.label}</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className={`size-3 shrink-0 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {/* `hidden` rather than unmounting: an unmounted panel loses its
                scroll position and, more importantly, the active item inside
                a collapsed-then-reopened group would otherwise remount and
                lose focus if a keyboard user were tabbing through it. */}
            <div id={panelId} hidden={isCollapsed} className="flex flex-col gap-0.5 pb-1">
              {items.map((item) => (
                <NavLink key={item.href} item={item} active={pathname === item.href} />
              ))}
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
