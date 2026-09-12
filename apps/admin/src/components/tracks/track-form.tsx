'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '../../lib/auth-context';
import { previewUrl } from '../../lib/preview';
import { useGenreOptions, usePersonaKeyOptions } from '../../lib/reference-data';
import { MediaSelect } from '../media/media-select';

interface TrackDetail {
  slug: string;
  title: string;
  artistLabel: string;
  personaSlug: string | null;
  type: string;
  description: string | null;
  bpm: number | null;
  durationSec: number | null;
  isFeatured: boolean;
  genres: { slug: string }[];
  tags: string[];
}

const TRACK_TYPES = ['ORIGINAL', 'REMIX', 'LIVE_SET', 'MIX', 'PODCAST', 'COLLABORATION'];

export function TrackForm({ id }: { id?: string }): React.JSX.Element {
  const { request } = useAuth();
  const router = useRouter();
  const personaKeyOptions = usePersonaKeyOptions();
  const genreOptions = useGenreOptions();

  const [title, setTitle] = useState('');
  const [artistLabel, setArtistLabel] = useState('');
  const [personaKey, setPersonaKey] = useState('');
  const [type, setType] = useState('ORIGINAL');
  const [description, setDescription] = useState('');
  const [bpm, setBpm] = useState('');
  const [durationSec, setDurationSec] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [genreSlugs, setGenreSlugs] = useState<string[]>([]);
  const [tags, setTags] = useState('');
  const [artworkId, setArtworkId] = useState('');
  const [audioId, setAudioId] = useState('');
  const [slug, setSlug] = useState<string | null>(null);

  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    request<TrackDetail>(`admin/tracks/${id}`)
      .then((track) => {
        setSlug(track.slug);
        setTitle(track.title);
        setArtistLabel(track.artistLabel);
        setPersonaKey(''); // resolved server-side from personaSlug; re-selecting is a known limitation of this pass
        setType(track.type);
        setDescription(track.description ?? '');
        setBpm(track.bpm != null ? String(track.bpm) : '');
        setDurationSec(track.durationSec != null ? String(track.durationSec) : '');
        setIsFeatured(track.isFeatured);
        setGenreSlugs(track.genres.map((genre) => genre.slug));
        setTags(track.tags.join(', '));
      })
      .catch(() => {
        setError('Could not load this track.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, request]);

  function toggleGenre(slugValue: string): void {
    setGenreSlugs((current) =>
      current.includes(slugValue) ? current.filter((value) => value !== slugValue) : [...current, slugValue],
    );
  }

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
        description: description || undefined,
        bpm: bpm ? Number(bpm) : undefined,
        durationSec: durationSec ? Number(durationSec) : undefined,
        isFeatured,
        genreSlugs,
        tags: tags ? tags.split(',').map((tag) => tag.trim()).filter(Boolean) : undefined,
        artworkId: artworkId || undefined,
        audioId: audioId || undefined,
      };
      if (id) {
        await request(`admin/tracks/${id}`, { method: 'PATCH', body });
      } else {
        await request('admin/tracks', { method: 'POST', body });
      }
      router.push('/tracks');
    } catch {
      setError('Could not save this track. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-fg-muted text-sm">Loading…</p>;

  const preview = slug ? previewUrl(`/music/${slug}`) : null;

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h2 text-fg-strong">{id ? 'Edit track' : 'New track'}</h1>
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
              {TRACK_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="bpm" className="text-fg-strong text-sm font-medium">
              BPM
            </label>
            <input
              id="bpm"
              type="number"
              value={bpm}
              onChange={(event) => {
                setBpm(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            />
          </div>
          <div>
            <label htmlFor="durationSec" className="text-fg-strong text-sm font-medium">
              Duration (seconds)
            </label>
            <input
              id="durationSec"
              type="number"
              value={durationSec}
              onChange={(event) => {
                setDurationSec(event.target.value);
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
        <div>
          <label htmlFor="tags" className="text-fg-strong text-sm font-medium">
            Tags (comma-separated)
          </label>
          <input
            id="tags"
            value={tags}
            onChange={(event) => {
              setTags(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <span className="text-fg-strong text-sm font-medium">Genres</span>
          <div className="mt-1 flex flex-wrap gap-3">
            {genreOptions.map((genre) => (
              <label key={genre.slug} className="flex items-center gap-1.5 text-sm text-fg-secondary">
                <input
                  type="checkbox"
                  checked={genreSlugs.includes(genre.slug)}
                  onChange={() => {
                    toggleGenre(genre.slug);
                  }}
                  className="h-4 w-4"
                />
                {genre.name}
              </label>
            ))}
          </div>
        </div>
        <MediaSelect label="Artwork" value={artworkId} onChange={setArtworkId} />
        <MediaSelect label="Audio file" value={audioId} onChange={setAudioId} />
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
          {saving ? 'Saving…' : id ? 'Save changes' : 'Create track'}
        </button>
      </form>
    </div>
  );
}
