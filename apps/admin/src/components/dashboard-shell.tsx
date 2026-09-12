'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '../lib/auth-context';

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
    items: [{ href: '/media', label: 'Media library', permission: 'media:read' }],
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

/**
 * The protected shell. Auth is checked client-side (`useAuth`'s silent
 * refresh runs in the root layout, above this one) — the real enforcement
 * boundary is the API itself (every admin route requires a valid access
 * token server-side), this is purely a UX redirect so a signed-out visitor
 * sees `/login` instead of a page full of failed requests.
 */
export function DashboardShell({ children }: { children: React.ReactNode }): React.JSX.Element | null {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-fg-muted text-sm">Loading…</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-dvh">
      <aside className="w-56 shrink-0 overflow-y-auto border-r border-border bg-surface p-4">
        <p className="text-eyebrow text-fg-muted mb-6 uppercase">DJ Felicitous</p>
        <nav className="flex flex-col gap-4">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter(
              (item) => !item.permission || user.permissions.includes(item.permission),
            );
            if (items.length === 0) return null;
            return (
              <div key={group.label || 'root'}>
                {group.label ? (
                  <p className="text-fg-muted mb-1 px-3 text-xs font-semibold uppercase">{group.label}</p>
                ) : null}
                <div className="flex flex-col gap-1">
                  {items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-md px-3 py-2 text-sm ${
                        pathname === item.href
                          ? 'bg-bg text-fg-strong font-semibold'
                          : 'text-fg-secondary hover:text-fg-strong'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-border px-6 py-3">
          <p className="text-fg-muted text-sm">{user.email}</p>
          <button
            type="button"
            onClick={() => {
              void logout().then(() => {
                router.replace('/login');
              });
            }}
            className="text-fg-muted text-sm underline"
          >
            Sign out
          </button>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
