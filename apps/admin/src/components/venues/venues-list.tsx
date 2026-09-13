'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../../lib/auth-context';

interface VenueRow {
  id: string;
  name: string;
  city: string;
  status: string;
  publishedAt: string | null;
  eventCount: number;
}

interface ListResponse {
  data: VenueRow[];
  meta: { pagination: { page: number; totalPages: number; totalCount: number } };
}

/**
 * The one fully built content-type admin screen (see STATUS.md's Group E
 * section for why Venues specifically, and what's deferred). Every other
 * content type would follow this exact shape — list, create, edit, publish
 * workflow — copied file-for-file.
 */
export function VenuesList(): React.JSX.Element {
  const { request, can } = useAuth();
  const [rows, setRows] = useState<VenueRow[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number) => {
      try {
        const result = await request<ListResponse>(`admin/venues?page=${String(targetPage)}&perPage=20`);
        setRows(result.data);
        setPage(result.meta.pagination.page);
        setTotalPages(result.meta.pagination.totalPages);
      } catch {
        setError('Could not load venues.');
      }
    },
    [request],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  async function togglePublish(venue: VenueRow): Promise<void> {
    setBusyId(venue.id);
    try {
      const action = venue.status === 'PUBLISHED' ? 'unpublish' : 'publish';
      await request(`admin/venues/${venue.id}/${action}`, { method: 'PATCH' });
      await load(page);
    } catch {
      setError('That action failed. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(venue: VenueRow): Promise<void> {
    if (!window.confirm(`Delete "${venue.name}"? This can be restored later by an admin with access to the database.`)) {
      return;
    }
    setBusyId(venue.id);
    try {
      await request(`admin/venues/${venue.id}`, { method: 'DELETE' });
      await load(page);
    } catch {
      setError('Delete failed. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h2 text-fg-strong">Venues</h1>
        {can('venue:write') ? (
          <Link href="/venues/new" className="bg-accent text-on-accent rounded-full px-4 py-2 text-sm font-semibold">
            New venue
          </Link>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-danger mt-4 text-sm">
          {error}
        </p>
      ) : null}

      {!rows ? (
        <p className="text-fg-muted mt-6 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-fg-muted mt-6 text-sm">No venues yet.</p>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-fg-muted">
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">City</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Events</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((venue) => (
              <tr key={venue.id} className="border-b border-border">
                <td className="py-2">
                  {can('venue:write') ? (
                    <Link href={`/venues/${venue.id}`} className="text-accent hover:underline">
                      {venue.name}
                    </Link>
                  ) : (
                    venue.name
                  )}
                </td>
                <td className="py-2 text-fg-secondary">{venue.city}</td>
                <td className="py-2 text-fg-secondary">{venue.status}</td>
                <td className="py-2 text-fg-secondary">{venue.eventCount}</td>
                <td className="py-2 text-right">
                  {can('venue:publish') ? (
                    <button
                      type="button"
                      disabled={busyId === venue.id}
                      onClick={() => {
                        void togglePublish(venue);
                      }}
                      className="text-fg-muted mr-4 text-xs underline disabled:opacity-60"
                    >
                      {venue.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                    </button>
                  ) : null}
                  {can('venue:delete') ? (
                    <button
                      type="button"
                      disabled={busyId === venue.id}
                      onClick={() => {
                        void remove(venue);
                      }}
                      className="text-danger text-xs underline disabled:opacity-60"
                    >
                      Delete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalPages > 1 ? (
        <div className="mt-4 flex gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              void load(page - 1);
            }}
            className="text-fg-muted underline disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-fg-muted">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => {
              void load(page + 1);
            }}
            className="text-fg-muted underline disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
