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

const NAV: NavItem[] = [
  { href: '/', label: 'Dashboard' },
  { href: '/venues', label: 'Venues', permission: 'venue:read' },
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
      <aside className="w-56 shrink-0 border-r border-border bg-surface p-4">
        <p className="text-eyebrow text-fg-muted mb-6 uppercase">DJ Felicitous</p>
        <nav className="flex flex-col gap-1">
          {NAV.filter((item) => !item.permission || user.permissions.includes(item.permission)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm ${
                pathname === item.href ? 'bg-bg text-fg-strong font-semibold' : 'text-fg-secondary hover:text-fg-strong'
              }`}
            >
              {item.label}
            </Link>
          ))}
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
