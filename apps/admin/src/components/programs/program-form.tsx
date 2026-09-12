'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '../../lib/auth-context';
import { previewUrl } from '../../lib/preview';
import { usePersonaKeyOptions, useVenueOptions } from '../../lib/reference-data';
import { MediaSelect } from '../media/media-select';

interface ProgramDetail {
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  cadence: string | null;
  isOngoing: boolean;
}

function toDateInputValue(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

export function ProgramForm({ id }: { id?: string }): React.JSX.Element {
  const { request } = useAuth();
  const router = useRouter();
  const personaKeyOptions = usePersonaKeyOptions();
  const venueOptions = useVenueOptions();

  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [cadence, setCadence] = useState('');
  const [personaKey, setPersonaKey] = useState('');
  const [venueId, setVenueId] = useState('');
  const [residencyFrom, setResidencyFrom] = useState('');
  const [residencyTo, setResidencyTo] = useState('');
  const [isOngoing, setIsOngoing] = useState(false);
  const [heroId, setHeroId] = useState('');
  const [slug, setSlug] = useState<string | null>(null);

  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    request<ProgramDetail>(`admin/programs/${id}`)
      .then((program) => {
        setSlug(program.slug);
        setName(program.name);
        setSubtitle(program.subtitle ?? '');
        setDescription(program.description ?? '');
        setCadence(program.cadence ?? '');
        setIsOngoing(program.isOngoing);
      })
      .catch(() => {
        setError('Could not load this program.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, request]);

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        name,
        subtitle: subtitle || undefined,
        description: description || undefined,
        cadence: cadence || undefined,
        personaKey: personaKey || undefined,
        venueId: venueId || undefined,
        residencyFrom: residencyFrom || undefined,
        residencyTo: residencyTo || undefined,
        isOngoing,
        heroId: heroId || undefined,
      };
      if (id) {
        await request(`admin/programs/${id}`, { method: 'PATCH', body });
      } else {
        await request('admin/programs', { method: 'POST', body });
      }
      router.push('/programs');
    } catch {
      setError('Could not save this program. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-fg-muted text-sm">Loading…</p>;

  const preview = slug ? previewUrl(`/programs/${slug}`) : null;

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h2 text-fg-strong">{id ? 'Edit program' : 'New program'}</h1>
        {preview ? (
          <a href={preview} target="_blank" rel="noopener noreferrer" className="text-accent text-sm underline">
            Preview live →
          </a>
        ) : null}
      </div>
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
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="subtitle" className="text-fg-strong text-sm font-medium">
            Subtitle
          </label>
          <input
            id="subtitle"
            value={subtitle}
            onChange={(event) => {
              setSubtitle(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="personaKey" className="text-fg-strong text-sm font-medium">
              Persona
            </label>
            <select
              id="personaKey"
              value={personaKey}
              onChange={(event) => {
                setPersonaKey(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            >
              {personaKeyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="venueId" className="text-fg-strong text-sm font-medium">
              Venue
            </label>
            <select
              id="venueId"
              value={venueId}
              onChange={(event) => {
                setVenueId(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            >
              {venueOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="cadence" className="text-fg-strong text-sm font-medium">
            Cadence (e.g. Weekly, Monthly)
          </label>
          <input
            id="cadence"
            value={cadence}
            onChange={(event) => {
              setCadence(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="residencyFrom" className="text-fg-strong text-sm font-medium">
              Residency from
            </label>
            <input
              id="residencyFrom"
              type="date"
              value={toDateInputValue(residencyFrom)}
              onChange={(event) => {
                setResidencyFrom(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            />
          </div>
          <div>
            <label htmlFor="residencyTo" className="text-fg-strong text-sm font-medium">
              Residency to
            </label>
            <input
              id="residencyTo"
              type="date"
              value={toDateInputValue(residencyTo)}
              onChange={(event) => {
                setResidencyTo(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            />
          </div>
        </div>
        <div>
          <label htmlFor="description" className="text-fg-strong text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <MediaSelect label="Hero image" value={heroId} onChange={setHeroId} />
        <label className="flex items-center gap-2 text-sm text-fg-strong">
          <input
            type="checkbox"
            checked={isOngoing}
            onChange={(event) => {
              setIsOngoing(event.target.checked);
            }}
            className="h-4 w-4"
          />
          Ongoing
        </label>

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
          {saving ? 'Saving…' : id ? 'Save changes' : 'Create program'}
        </button>
      </form>
    </div>
  );
}
