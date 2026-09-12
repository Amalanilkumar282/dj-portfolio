'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '../../lib/auth-context';
import { previewUrl } from '../../lib/preview';
import { usePersonaKeyOptions } from '../../lib/reference-data';
import { MediaSelect } from '../media/media-select';

interface ReleaseDetail {
  slug: string;
  title: string;
  artistLabel: string;
  type: string;
  label: string | null;
  description: string | null;
  isFeatured: boolean;
}

const RELEASE_TYPES = ['ALBUM', 'EP', 'SINGLE', 'COMPILATION'];

export function ReleaseForm({ id }: { id?: string }): React.JSX.Element {
  const { request } = useAuth();
  const router = useRouter();
  const personaKeyOptions = usePersonaKeyOptions();

  const [title, setTitle] = useState('');
  const [artistLabel, setArtistLabel] = useState('');
  const [personaKey, setPersonaKey] = useState('');
  const [type, setType] = useState('SINGLE');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [coverId, setCoverId] = useState('');
  const [slug, setSlug] = useState<string | null>(null);

  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    request<ReleaseDetail>(`admin/releases/${id}`)
      .then((release) => {
        setSlug(release.slug);
        setTitle(release.title);
        setArtistLabel(release.artistLabel);
        setType(release.type);
        setLabel(release.label ?? '');
        setDescription(release.description ?? '');
        setIsFeatured(release.isFeatured);
      })
      .catch(() => {
        setError('Could not load this release.');
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
        title,
        artistLabel,
        personaKey: personaKey || undefined,
        type,
        label: label || undefined,
        description: description || undefined,
        isFeatured,
        coverId: coverId || undefined,
      };
      if (id) {
        await request(`admin/releases/${id}`, { method: 'PATCH', body });
      } else {
        await request('admin/releases', { method: 'POST', body });
      }
      router.push('/releases');
    } catch {
      setError('Could not save this release. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-fg-muted text-sm">Loading…</p>;

  const preview = slug ? previewUrl(`/music/albums/${slug}`) : null;

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h2 text-fg-strong">{id ? 'Edit release' : 'New release'}</h1>
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
          <label htmlFor="title" className="text-fg-strong text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            required
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="artistLabel" className="text-fg-strong text-sm font-medium">
            Artist label
          </label>
          <input
            id="artistLabel"
            required
            value={artistLabel}
            onChange={(event) => {
              setArtistLabel(event.target.value);
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
            <label htmlFor="type" className="text-fg-strong text-sm font-medium">
              Type
            </label>
            <select
              id="type"
              value={type}
              onChange={(event) => {
                setType(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            >
              {RELEASE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="label" className="text-fg-strong text-sm font-medium">
            Record label
          </label>
          <input
            id="label"
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
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
        <MediaSelect label="Cover art" value={coverId} onChange={setCoverId} />
        <label className="flex items-center gap-2 text-sm text-fg-strong">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(event) => {
              setIsFeatured(event.target.checked);
            }}
            className="h-4 w-4"
          />
          Featured
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
          {saving ? 'Saving…' : id ? 'Save changes' : 'Create release'}
        </button>
      </form>
    </div>
  );
}
