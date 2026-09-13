'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiError } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import type { EntityConfig, FieldSpec } from '../../lib/entity-config';

type Values = Record<string, string>;

function toDateInputValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.slice(0, 10);
}

function emptyValues(fields: FieldSpec[]): Values {
  const values: Values = {};
  for (const field of fields) values[field.name] = field.type === 'boolean' ? 'false' : '';
  return values;
}

/** One generic create/edit form, driven entirely by `EntityConfig`. */
export function EntityForm({ config, id }: { config: EntityConfig; id?: string }): React.JSX.Element {
  const { request } = useAuth();
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => emptyValues(config.fields));
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    request<Record<string, unknown>>(`${config.basePath}/${id}`)
      .then((record) => {
        const next: Values = {};
        for (const field of config.fields) {
          const raw = record[field.name];
          if (field.type === 'boolean') {
            next[field.name] = raw ? 'true' : 'false';
          } else if (field.type === 'date') {
            next[field.name] = toDateInputValue(raw);
          } else if (typeof raw === 'number') {
            next[field.name] = String(raw);
          } else if (typeof raw === 'string') {
            next[field.name] = raw;
          } else {
            next[field.name] = '';
          }
        }
        setValues(next);
      })
      .catch(() => {
        setError(`Could not load this ${config.label.toLowerCase()}.`);
      })
      .finally(() => {
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- config is static per page
  }, [id, request]);

  function setField(name: string, value: string): void {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function buildBody(): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    for (const field of config.fields) {
      const raw = values[field.name];
      if (field.type === 'boolean') {
        body[field.name] = raw === 'true';
      } else if (field.type === 'number') {
        body[field.name] = raw ? Number(raw) : undefined;
      } else {
        // An empty string means "absent", not a real empty value — `??`
        // would not catch that, so this stays an explicit length check.
        body[field.name] = raw && raw.length > 0 ? raw : undefined;
      }
    }
    return body;
  }

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (id) {
        await request(`${config.basePath}/${id}`, { method: 'PATCH', body: buildBody() });
      } else {
        await request(config.basePath, { method: 'POST', body: buildBody() });
      }
      router.push(config.adminRoute);
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.status === 422) {
        setError('Please check the form — something is missing or invalid.');
      } else if (submitError instanceof ApiError && submitError.status === 409) {
        setError('That already exists, or is still referenced elsewhere.');
      } else {
        setError(`Could not save this ${config.label.toLowerCase()}. Please try again.`);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-fg-muted text-sm">Loading…</p>;

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-h2 text-fg-strong">
        {id ? `Edit ${config.label.toLowerCase()}` : `New ${config.label.toLowerCase()}`}
      </h1>
      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        className="mt-6 space-y-4"
      >
        {config.fields.map((field) => (
          <div key={field.name}>
            <label htmlFor={field.name} className="text-fg-strong text-sm font-medium">
              {field.label}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                id={field.name}
                required={field.required}
                rows={4}
                value={values[field.name] ?? ''}
                onChange={(event) => {
                  setField(field.name, event.target.value);
                }}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
              />
            ) : field.type === 'select' ? (
              <select
                id={field.name}
                required={field.required}
                value={values[field.name] ?? ''}
                onChange={(event) => {
                  setField(field.name, event.target.value);
                }}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
              >
                {!field.options ? null : (
                  <>
                    {field.required ? null : <option value="">— none —</option>}
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </>
                )}
              </select>
            ) : field.type === 'boolean' ? (
              <div className="mt-1">
                <input
                  id={field.name}
                  type="checkbox"
                  checked={values[field.name] === 'true'}
                  onChange={(event) => {
                    setField(field.name, event.target.checked ? 'true' : 'false');
                  }}
                  className="h-4 w-4"
                />
              </div>
            ) : (
              <input
                id={field.name}
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                required={field.required}
                value={values[field.name] ?? ''}
                onChange={(event) => {
                  setField(field.name, event.target.value);
                }}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
              />
            )}
            {field.helpText ? <p className="text-fg-muted mt-1 text-xs">{field.helpText}</p> : null}
          </div>
        ))}

        {error ? (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="bg-accent text-on-accent rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? 'Saving…' : id ? 'Save changes' : `Create ${config.label.toLowerCase()}`}
        </button>
      </form>
    </div>
  );
}
