'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiError } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';

interface VenueDetail {
  id: string;
  name: string;
  city: string;
  state: string | null;
  country: string;
  addressLine: string | null;
  capacity: number | null;
  websiteUrl: string | null;
}

interface FormValues {
  name: string;
  city: string;
  state: string;
  country: string;
  addressLine: string;
  capacity: string;
  websiteUrl: string;
}

const EMPTY: FormValues = { name: '', city: '', state: '', country: 'India', addressLine: '', capacity: '', websiteUrl: '' };

/** Shared by /venues/new and /venues/[id] — the same fields, only the submit path differs. */
export function VenueForm({ id }: { id?: string }): React.JSX.Element {
  const { request } = useAuth();
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    request<VenueDetail>(`admin/venues/${id}`)
      .then((venue) => {
        setValues({
          name: venue.name,
          city: venue.city,
          state: venue.state ?? '',
          country: venue.country,
          addressLine: venue.addressLine ?? '',
          capacity: venue.capacity != null ? String(venue.capacity) : '',
          websiteUrl: venue.websiteUrl ?? '',
        });
      })
      .catch(() => {
        setError('Could not load this venue.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, request]);

  function field(key: keyof FormValues) {
    return {
      value: values[key],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        setValues((current) => ({ ...current, [key]: event.target.value }));
      },
    };
  }

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const body = {
      name: values.name,
      city: values.city,
      state: values.state || undefined,
      country: values.country || undefined,
      addressLine: values.addressLine || undefined,
      capacity: values.capacity ? Number(values.capacity) : undefined,
      websiteUrl: values.websiteUrl || undefined,
    };

    try {
      if (id) {
        await request(`admin/venues/${id}`, { method: 'PATCH', body });
      } else {
        await request('admin/venues', { method: 'POST', body });
      }
      router.push('/venues');
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.status === 422) {
        setError('Please check the form — something is missing or invalid.');
      } else {
        setError('Could not save this venue. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-fg-muted text-sm">Loading…</p>;

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-h2 text-fg-strong">{id ? 'Edit venue' : 'New venue'}</h1>
      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        className="mt-6 space-y-4"
      >
        <div>
          <label htmlFor="name" className="text-fg-strong text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            required
            {...field('name')}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="city" className="text-fg-strong text-sm font-medium">
            City
          </label>
          <input
            id="city"
            required
            {...field('city')}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="state" className="text-fg-strong text-sm font-medium">
            State (optional)
          </label>
          <input
            id="state"
            {...field('state')}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="country" className="text-fg-strong text-sm font-medium">
            Country
          </label>
          <input
            id="country"
            {...field('country')}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="addressLine" className="text-fg-strong text-sm font-medium">
            Address (optional)
          </label>
          <input
            id="addressLine"
            {...field('addressLine')}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="capacity" className="text-fg-strong text-sm font-medium">
            Capacity (optional)
          </label>
          <input
            id="capacity"
            type="number"
            min={1}
            {...field('capacity')}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="websiteUrl" className="text-fg-strong text-sm font-medium">
            Website (optional)
          </label>
          <input
            id="websiteUrl"
            type="url"
            {...field('websiteUrl')}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>

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
          {saving ? 'Saving…' : id ? 'Save changes' : 'Create venue'}
        </button>
      </form>
    </div>
  );
}
