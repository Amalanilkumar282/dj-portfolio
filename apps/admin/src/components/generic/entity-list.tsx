'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../../lib/auth-context';
import type { EntityConfig } from '../../lib/entity-config';

type Row = Record<string, unknown>;

interface PaginatedResponse {
  data: Row[];
  meta: { pagination: { page: number; totalPages: number } };
}

interface BareResponse {
  data: Row[];
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '—';
}

/** One generic table, driven entirely by `EntityConfig` — see `lib/entity-config.ts`. */
export function EntityList({ config }: { config: EntityConfig }): React.JSX.Element {
  const { request, can } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number) => {
      try {
        const path = config.paginated
          ? `${config.basePath}?page=${String(targetPage)}&perPage=20`
          : config.basePath;
        const result = await request<PaginatedResponse | BareResponse>(path);
        setRows(result.data);
        if ('meta' in result) {
          setPage(result.meta.pagination.page);
          setTotalPages(result.meta.pagination.totalPages);
        }
      } catch {
        setError(`Could not load ${config.pluralLabel.toLowerCase()}.`);
      }
    },
    [request, config],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  async function togglePublish(row: Row): Promise<void> {
    const id = String(row.id);
    setBusyId(id);
    try {
      const action = row.status === 'PUBLISHED' ? 'unpublish' : 'publish';
      await request(`${config.basePath}/${id}/${action}`, { method: 'PATCH' });
      await load(page);
    } catch {
      setError('That action failed. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function move(row: Row, direction: 'up' | 'down'): Promise<void> {
    if (!rows) return;
    const index = rows.findIndex((candidate) => candidate.id === row.id);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= rows.length) return;
    const other = rows[swapIndex];
    if (!other) return;

    const id = String(row.id);
    setBusyId(id);
    try {
      await request(`${config.basePath}/reorder`, {
        method: 'PATCH',
        body: {
          entries: [
            { id: row.id, sortIndex: other.sortIndex },
            { id: other.id, sortIndex: row.sortIndex },
          ],
        },
      });
      await load(page);
    } catch {
      setError('Could not reorder. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: Row): Promise<void> {
    if (!window.confirm(`Delete this ${config.label.toLowerCase()}?`)) return;
    const id = String(row.id);
    setBusyId(id);
    try {
      await request(`${config.basePath}/${id}`, { method: 'DELETE' });
      await load(page);
    } catch {
      setError('Delete failed — it may still be referenced elsewhere.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h2 text-fg-strong">{config.pluralLabel}</h1>
        {can(`${config.permissionPrefix}:write`) ? (
          <Link
            href={`${config.adminRoute}/new`}
            className="bg-accent text-on-accent rounded-full px-4 py-2 text-sm font-semibold"
          >
            New {config.label.toLowerCase()}
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
        <p className="text-fg-muted mt-6 text-sm">Nothing here yet.</p>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-fg-muted">
              {config.listColumns.map((column) => (
                <th key={column.key} className="py-2 font-medium">
                  {column.label}
                </th>
              ))}
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const id = String(row.id);
              return (
                <tr key={id} className="border-b border-border">
                  {config.listColumns.map((column, index) => (
                    <td key={column.key} className="max-w-xs truncate py-2 text-fg-secondary">
                      {index === 0 && can(`${config.permissionPrefix}:write`) ? (
                        <Link href={`${config.adminRoute}/${id}`} className="text-accent hover:underline">
                          {formatCell(row[column.key])}
                        </Link>
                      ) : (
                        formatCell(row[column.key])
                      )}
                    </td>
                  ))}
                  <td className="py-2 text-right whitespace-nowrap">
                    {config.reorderable && can(`${config.permissionPrefix}:write`) ? (
                      <>
                        <button
                          type="button"
                          disabled={busyId === id || rowIndex === 0}
                          aria-label={`Move ${config.label.toLowerCase()} up`}
                          onClick={() => {
                            void move(row, 'up');
                          }}
                          className="text-fg-muted mr-2 text-xs underline disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={busyId === id || rowIndex === rows.length - 1}
                          aria-label={`Move ${config.label.toLowerCase()} down`}
                          onClick={() => {
                            void move(row, 'down');
                          }}
                          className="text-fg-muted mr-4 text-xs underline disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </>
                    ) : null}
                    {config.publishable && can(`${config.permissionPrefix}:publish`) ? (
                      <button
                        type="button"
                        disabled={busyId === id}
                        onClick={() => {
                          void togglePublish(row);
                        }}
                        className="text-fg-muted mr-4 text-xs underline disabled:opacity-60"
                      >
                        {row.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                      </button>
                    ) : null}
                    {can(`${config.permissionPrefix}:delete`) ? (
                      <button
                        type="button"
                        disabled={busyId === id}
                        onClick={() => {
                          void remove(row);
                        }}
                        className="text-danger text-xs underline disabled:opacity-60"
                      >
                        Delete
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
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
