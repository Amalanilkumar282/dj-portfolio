'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '../../lib/auth-context';
import { previewUrl } from '../../lib/preview';

interface StatCard {
  label: string;
  href: string;
  path: string;
  publicPath: string | null;
}

const CARDS: StatCard[] = [
  { label: 'Personas', href: '/personas', path: 'admin/personas?page=1&perPage=1', publicPath: '/' },
  { label: 'Tracks', href: '/tracks', path: 'admin/tracks?page=1&perPage=1', publicPath: '/music' },
  { label: 'Venues', href: '/venues', path: 'admin/venues?page=1&perPage=1', publicPath: '/venues' },
  { label: 'Programs', href: '/programs', path: 'admin/programs?page=1&perPage=1', publicPath: '/programs' },
  { label: 'Services', href: '/services', path: 'admin/services?page=1&perPage=1', publicPath: '/services' },
  {
    label: 'Testimonials',
    href: '/testimonials',
    path: 'admin/testimonials?page=1&perPage=1',
    publicPath: '/testimonials',
  },
];

interface CountResponse {
  meta?: { pagination?: { totalPages?: number } };
  data: unknown[];
}

const QUICK_ACTIONS = [
  { label: 'Add a track', href: '/tracks/new' },
  { label: 'Add a venue', href: '/venues/new' },
  { label: 'Add a testimonial', href: '/testimonials/new' },
  { label: 'Review bookings', href: '/inquiries' },
];

/**
 * The dashboard's real job: answer "did my last change actually go live?"
 * in one glance, without opening the site in another tab first. Every card
 * below is a real, live count from the API (never a guess), and every card
 * and quick action links straight to the screen that changes it.
 */
export function DashboardHome(): React.JSX.Element {
  const { request } = useAuth();
  const [counts, setCounts] = useState<Record<string, number | null>>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      CARDS.map(async (card) => {
        try {
          const result = await request<CountResponse>(card.path);
          // No API here exposes a bare "total count" endpoint, so the
          // per-page-1 request pattern above reads the paginated meta;
          // falls back to counting the returned rows for non-paginated
          // collections (genres, tags, etc. never appear in this list).
          // perPage=1, so totalPages *is* the total row count.
          const total = result.meta?.pagination?.totalPages ?? result.data.length;
          return [card.label, total] as const;
        } catch {
          return [card.label, null] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) setCounts(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [request]);

  const siteUrl = previewUrl('/') ?? process.env.NEXT_PUBLIC_SITE_URL ?? '/';

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-h2 text-fg-strong">Dashboard</h1>
          <p className="text-fg-secondary mt-2 max-w-xl text-sm">
            Every number below is live from the database. Click a card to edit that content, or open
            the live site to see exactly what a visitor sees right now.
          </p>
        </div>
        <a
          href={siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-accent text-on-accent hover:bg-accent-strong shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors"
        >
          View live site ↗
        </a>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="hover:border-accent flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 transition-colors"
          >
            <span className="text-fg-muted text-xs font-medium uppercase tracking-wide">{card.label}</span>
            <span className="font-display text-h3 text-fg-strong">
              {counts[card.label] ?? <span className="text-fg-muted">…</span>}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-fg-strong text-sm font-semibold uppercase tracking-wide">Quick actions</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {QUICK_ACTIONS.map((action) => (
              <li key={action.href}>
                <Link
                  href={action.href}
                  className="text-accent hover:text-accent-strong inline-flex items-center gap-1.5 text-sm font-medium"
                >
                  {action.label} →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
