'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '../../lib/auth-context';
import { previewUrl } from '../../lib/preview';
import { usePersonaKeyOptions, useTrackOptions } from '../../lib/reference-data';
import { MediaSelect } from '../media/media-select';

interface PlaylistDetail {
  slug: string;
  title: string;
  description: string | null;
  isFeatured: boolean;
  tracks: { id: string; title: string; artistLabel: string }[];
}

export function PlaylistForm({ id }: { id?: string }): React.JSX.Element {
  const { request } = useAuth();
  const router = useRouter();
  const personaKeyOptions = usePersonaKeyOptions();
  const trackOptions = useTrackOptions();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [personaKey, setPersonaKey] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [coverId, setCoverId] = useState('');
  const [trackIds, setTrackIds] = useState<string[]>([]);
  const [slug, setSlug] = useState<string | null>(null);

  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    request<PlaylistDetail>(`admin/playlists/${id}`)
      .then((playlist) => {
        setSlug(playlist.slug);
        setTitle(playlist.title);
        setDescription(playlist.description ?? '');
        setIsFeatured(playlist.isFeatured);
        setTrackIds(playlist.tracks.map((track) => track.id));
      })
      .catch(() => {
        setError('Could not load this playlist.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, request]);

  function toggleTrack(trackId: string): void {
    setTrackIds((current) =>
      current.includes(trackId) ? current.filter((value) => value !== trackId) : [...current, trackId],
    );
  }

  function move(index: number, direction: -1 | 1): void {
    setTrackIds((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      const [item] = next.splice(index, 1);
      if (item === undefined) return current;
      next.splice(target, 0, item);
      return next;
    });
  }

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        title,
        description: description || undefined,
        personaKey: personaKey || undefined,
        isFeatured,
        coverId: coverId || undefined,
        trackIds,
      };
      if (id) {
        await request(`admin/playlists/${id}`, { method: 'PATCH', body });
      } else {
        await request('admin/playlists', { method: 'POST', body });
      }
      router.push('/playlists');
    } catch {
      setError('Could not save this playlist. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-fg-muted text-sm">Loading…</p>;

  const preview = slug ? previewUrl(`/music/playlists/${slug}`) : null;
  const selectedTracks = trackIds
    .map((trackId) => trackOptions.find((track) => track.id === trackId))
    .filter((track): track is (typeof trackOptions)[number] => Boolean(track));

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h2 text-fg-strong">{id ? 'Edit playlist' : 'New playlist'}</h1>
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
        <MediaSelect label="Cover art" value={coverId} onChange={setCoverId} />

        <div>
          <span className="text-fg-strong text-sm font-medium">
            Tracks, in order ({selectedTracks.length} selected)
          </span>
          {selectedTracks.length > 0 ? (
            <ul className="border-border bg-surface mt-1 divide-y divide-border rounded-md border">
              {selectedTracks.map((track, index) => (
                <li key={track.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-fg-strong">
                    {track.title} <span className="text-fg-muted">— {track.artistLabel}</span>
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => {
                        move(index, -1);
                      }}
                      className="text-fg-muted text-xs underline disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === selectedTracks.length - 1}
                      onClick={() => {
                        move(index, 1);
                      }}
                      className="text-fg-muted text-xs underline disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        toggleTrack(track.id);
                      }}
                      className="text-danger text-xs underline"
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <details className="mt-2">
            <summary className="text-accent cursor-pointer text-sm">Add tracks…</summary>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {trackOptions
                .filter((track) => !trackIds.includes(track.id))
                .map((track) => (
                  <label key={track.id} className="flex items-center gap-2 text-sm text-fg-secondary">
                    <input
                      type="checkbox"
                      onChange={() => {
                        toggleTrack(track.id);
                      }}
                      className="h-4 w-4"
                    />
                    {track.title} — {track.artistLabel}
                  </label>
                ))}
            </div>
          </details>
        </div>

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
          {saving ? 'Saving…' : id ? 'Save changes' : 'Create playlist'}
        </button>
      </form>
    </div>
  );
}
