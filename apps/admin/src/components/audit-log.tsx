'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../lib/auth-context';

interface AuditRow {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorEmail: string | null;
  createdAt: string;
  diff: { before: Record<string, unknown>; after: Record<string, unknown> } | null;
}

export function AuditLog(): React.JSX.Element {
  const { request } = useAuth();
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (afterCursor: string | null) => {
      try {
        const path = afterCursor ? `admin/audit-log?cursor=${afterCursor}` : 'admin/audit-log';
        const result = await request<{ data: AuditRow[]; meta: { nextCursor: string | null } }>(path);
        setRows((current) => (afterCursor && current ? [...current, ...result.data] : result.data));
        setCursor(result.meta.nextCursor);
      } catch {
        setError('Could not load the audit log.');
      }
    },
    [request],
  );

  useEffect(() => {
    void load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  return (
    <div>
      <h1 className="font-display text-h2 text-fg-strong">Audit log</h1>
      <p className="text-fg-muted mt-2 text-sm">Every create, update, publish, and delete, newest first.</p>

      {error ? (
        <p role="alert" className="text-danger mt-4 text-sm">
          {error}
        </p>
      ) : null}

      {!rows ? (
        <p className="text-fg-muted mt-6 text-sm">Loading…</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="border-border bg-surface rounded-md border p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-fg-strong font-semibold">
                  {row.action} {row.entityType ? `— ${row.entityType}` : ''}
                </span>
                <span className="text-fg-muted text-xs">{new Date(row.createdAt).toLocaleString('en-IN')}</span>
              </div>
              <p className="text-fg-muted mt-1 text-xs">{row.actorEmail ?? 'system'}</p>
              {row.diff ? (
                <pre className="bg-bg mt-2 overflow-x-auto rounded p-2 text-xs text-fg-secondary">
                  {JSON.stringify(row.diff, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {cursor ? (
        <button
          type="button"
          onClick={() => {
            void load(cursor);
          }}
          className="text-accent mt-4 text-sm underline"
        >
          Load more
        </button>
      ) : null}
    </div>
  );
}
