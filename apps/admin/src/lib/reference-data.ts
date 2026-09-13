'use client';

import { useEffect, useState } from 'react';

import { useAuth } from './auth-context';

export interface Option {
  value: string;
  label: string;
}

const PERSONA_KEY_OPTIONS: Option[] = [
  { value: '', label: '— none —' },
  { value: 'FELICITOUS', label: 'Felicitous' },
  { value: 'TRINITROCOSMIC', label: 'Trinitrocosmic' },
  { value: 'TNT', label: 'TNT' },
  { value: 'COUPLE_DUO', label: 'Felicitous x Geetz' },
];

/** The 4 persona keys are a fixed, known set — no need to fetch them. */
export function usePersonaKeyOptions(): Option[] {
  return PERSONA_KEY_OPTIONS;
}

interface ListRow {
  id: string;
  name?: string;
  title?: string;
  stageName?: string;
}

/** Shared by every "pick a related entity by id" dropdown. */
function useAdminListOptions(path: string, labelKey: 'name' | 'title' | 'stageName'): Option[] {
  const { request } = useAuth();
  const [options, setOptions] = useState<Option[]>([{ value: '', label: '— none —' }]);

  useEffect(() => {
    request<{ data: ListRow[] }>(path)
      .then((result) => {
        setOptions([
          { value: '', label: '— none —' },
          ...result.data.map((row) => ({ value: row.id, label: row[labelKey] ?? row.id })),
        ]);
      })
      .catch(() => {
        // Leave the placeholder-only list — the picker degrades to "none",
        // not to a crash, if the reference data can't be fetched.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetched once per mount
  }, []);

  return options;
}

export function useVenueOptions(): Option[] {
  return useAdminListOptions('admin/venues?perPage=100', 'name');
}

export function useProgramOptions(): Option[] {
  return useAdminListOptions('admin/programs?perPage=100', 'name');
}

interface GenreRow {
  id: string;
  slug: string;
  name: string;
}

/** Genres are keyed by slug on the write side, not id — a separate shape. */
export function useGenreOptions(): { slug: string; name: string }[] {
  const { request } = useAuth();
  const [genres, setGenres] = useState<{ slug: string; name: string }[]>([]);

  useEffect(() => {
    request<{ data: GenreRow[] }>('admin/genres?perPage=100')
      .then((result) => {
        setGenres(result.data.map((row) => ({ slug: row.slug, name: row.name })));
      })
      .catch(() => {
        setGenres([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetched once per mount
  }, []);

  return genres;
}

interface TrackRow {
  id: string;
  title: string;
  artistLabel: string;
}

/** Every track, for the Playlist track-picker (checkboxes, not a dropdown). */
export function useTrackOptions(): TrackRow[] {
  const { request } = useAuth();
  const [tracks, setTracks] = useState<TrackRow[]>([]);

  useEffect(() => {
    request<{ data: TrackRow[] }>('admin/tracks?perPage=200')
      .then((result) => {
        setTracks(result.data);
      })
      .catch(() => {
        setTracks([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetched once per mount
  }, []);

  return tracks;
}
