'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '../../lib/auth-context';
import { previewUrl } from '../../lib/preview';
import { useGenreOptions, usePersonaKeyOptions } from '../../lib/reference-data';
import { MediaSelect } from '../media/media-select';

interface PersonaDetail {
  key: string;
  slug: string;
  stageName: string;
  subtitle: string | null;
  tagline: string | null;
  bio: string;
  homeCity: string | null;
  country: string | null;
  memberNames: string[];
  genres: { slug: string }[];
  isFeatured: boolean;
  isDuo: boolean;
}

export function PersonaForm({ id }: { id?: string }): React.JSX.Element {
  const { request } = useAuth();
  const router = useRouter();
  const personaKeyOptions = usePersonaKeyOptions();
  const genreOptions = useGenreOptions();

  const [key, setKey] = useState('');
  const [stageName, setStageName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [bio, setBio] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [country, setCountry] = useState('');
  const [memberNames, setMemberNames] = useState('');
  const [genreSlugs, setGenreSlugs] = useState<string[]>([]);
  const [heroMediaId, setHeroMediaId] = useState('');
  const [avatarMediaId, setAvatarMediaId] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isDuo, setIsDuo] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);

  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    request<PersonaDetail>(`admin/personas/${id}`)
      .then((persona) => {
        setKey(persona.key);
        setSlug(persona.slug);
        setStageName(persona.stageName);
        setSubtitle(persona.subtitle ?? '');
        setTagline(persona.tagline ?? '');
        setBio(persona.bio);
        setHomeCity(persona.homeCity ?? '');
        setCountry(persona.country ?? '');
        setMemberNames(persona.memberNames.join(', '));
        setGenreSlugs(persona.genres.map((genre) => genre.slug));
        setIsFeatured(persona.isFeatured);
        setIsDuo(persona.isDuo);
      })
      .catch(() => {
        setError('Could not load this persona.');
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
        key: key || undefined,
        stageName,
        subtitle: subtitle || undefined,
        tagline: tagline || undefined,
        bio,
        homeCity: homeCity || undefined,
        country: country || undefined,
        memberNames: memberNames
          ? memberNames.split(',').map((name) => name.trim()).filter(Boolean)
          : undefined,
        genreSlugs,
        heroMediaId: heroMediaId || undefined,
        avatarMediaId: avatarMediaId || undefined,
        isFeatured,
        isDuo,
      };
      if (id) {
        await request(`admin/personas/${id}`, { method: 'PATCH', body });
      } else {
        await request('admin/personas', { method: 'POST', body });
      }
      router.push('/personas');
    } catch {
      setError('Could not save this persona. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-fg-muted text-sm">Loading…</p>;

  const preview = slug ? previewUrl(`/${slug}`) : null;

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h2 text-fg-strong">{id ? 'Edit persona' : 'New persona'}</h1>
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
          <label htmlFor="key" className="text-fg-strong text-sm font-medium">
            Key
          </label>
          <select
            id="key"
            required={!id}
            disabled={Boolean(id)}
            value={key}
            onChange={(event) => {
              setKey(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong disabled:opacity-60"
          >
            {personaKeyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {id ? <p className="text-fg-muted mt-1 text-xs">The key cannot change after creation.</p> : null}
        </div>
        <div>
          <label htmlFor="stageName" className="text-fg-strong text-sm font-medium">
            Stage name
          </label>
          <input
            id="stageName"
            required
            value={stageName}
            onChange={(event) => {
              setStageName(event.target.value);
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
        <div>
          <label htmlFor="tagline" className="text-fg-strong text-sm font-medium">
            Tagline
          </label>
          <input
            id="tagline"
            value={tagline}
            onChange={(event) => {
              setTagline(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="bio" className="text-fg-strong text-sm font-medium">
            Bio
          </label>
          <textarea
            id="bio"
            required
            rows={5}
            value={bio}
            onChange={(event) => {
              setBio(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="homeCity" className="text-fg-strong text-sm font-medium">
              Home city
            </label>
            <input
              id="homeCity"
              value={homeCity}
              onChange={(event) => {
                setHomeCity(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            />
          </div>
          <div>
            <label htmlFor="country" className="text-fg-strong text-sm font-medium">
              Country
            </label>
            <input
              id="country"
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            />
          </div>
        </div>
        <div>
          <label htmlFor="memberNames" className="text-fg-strong text-sm font-medium">
            Member names (comma-separated, for duo acts)
          </label>
          <input
            id="memberNames"
            value={memberNames}
            onChange={(event) => {
              setMemberNames(event.target.value);
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
        <MediaSelect label="Hero image" value={heroMediaId} onChange={setHeroMediaId} />
        <MediaSelect label="Avatar image" value={avatarMediaId} onChange={setAvatarMediaId} />
        <div className="flex gap-6">
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
          <label className="flex items-center gap-2 text-sm text-fg-strong">
            <input
              type="checkbox"
              checked={isDuo}
              onChange={(event) => {
                setIsDuo(event.target.checked);
              }}
              className="h-4 w-4"
            />
            Duo act
          </label>
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
          {saving ? 'Saving…' : id ? 'Save changes' : 'Create persona'}
        </button>
      </form>
    </div>
  );
}
