'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../../lib/auth-context';

interface Inquiry {
  id: string;
  reference: string;
  name: string;
  city: string | null;
  eventType: string;
  eventDate: string | null;
  status: string;
  budgetMax: number | null;
}

const COLUMNS = ['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'BOOKED', 'LOST'] as const;

const COLUMN_LABELS: Record<(typeof COLUMNS)[number], string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUOTED: 'Quoted',
  NEGOTIATING: 'Negotiating',
  BOOKED: 'Booked',
  LOST: 'Lost',
};

/**
 * A Kanban-*shaped* pipeline view — not drag-and-drop (see STATUS.md's
 * Group E "next pass" section for the same reasoning as the reorder
 * buttons): each card gets a "Move to…" select instead, which needs no new
 * dependency and is fully keyboard-operable. `SPAM` and `ARCHIVED` inquiries
 * are deliberately not shown as columns — they are the "handled, out of the
 * active pipeline" states, visible via the plain admin list this Kanban
 * sits alongside conceptually (not built as a separate screen this pass).
 */
export function InquiryKanban(): React.JSX.Element {
  const { request } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await request<{ data: Inquiry[] }>('admin/inquiries?perPage=100');
      setInquiries(result.data);
    } catch {
      setError('Could not load inquiries.');
    }
  }, [request]);

  useEffect(() => {
    void load();
  }, [load]);

  async function moveTo(inquiry: Inquiry, status: string): Promise<void> {
    setBusyId(inquiry.id);
    try {
      await request(`admin/inquiries/${inquiry.id}`, { method: 'PATCH', body: { status } });
      await load();
    } catch {
      setError('Could not move that inquiry. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  if (!inquiries) return <p className="text-fg-muted text-sm">Loading…</p>;

  return (
    <div>
      <h1 className="font-display text-h2 text-fg-strong">Bookings</h1>
      {error ? (
        <p role="alert" className="text-danger mt-4 text-sm">
          {error}
        </p>
      ) : null}
      <div className="mt-6 grid gap-4 overflow-x-auto pb-4 lg:grid-cols-6">
        {COLUMNS.map((column) => {
          const cards = inquiries.filter((inquiry) => inquiry.status === column);
          return (
            <div key={column} className="min-w-[220px]">
              <h2 className="text-fg-muted mb-3 text-xs font-semibold uppercase">
                {COLUMN_LABELS[column]} ({cards.length})
              </h2>
              <div className="space-y-3">
                {cards.map((inquiry) => (
                  <div key={inquiry.id} className="border-border bg-surface rounded-md border p-3 text-sm">
                    <p className="text-fg-strong font-semibold">{inquiry.name}</p>
                    <p className="text-fg-muted text-xs">{inquiry.reference}</p>
                    <p className="text-fg-muted mt-1 text-xs">
                      {inquiry.eventType} {inquiry.city ? `· ${inquiry.city}` : ''}
                    </p>
                    <select
                      value={inquiry.status}
                      disabled={busyId === inquiry.id}
                      onChange={(event) => {
                        void moveTo(inquiry, event.target.value);
                      }}
                      className="border-border bg-bg mt-2 w-full rounded border px-2 py-1 text-xs text-fg-strong disabled:opacity-60"
                    >
                      {[...COLUMNS, 'SPAM', 'ARCHIVED'].map((status) => (
                        <option key={status} value={status}>
                          Move to {status}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
