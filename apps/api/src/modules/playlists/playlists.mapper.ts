import type { PlaylistDetail, PlaylistSummary } from '@dj/contracts';

import { toMediaImage } from '../../common/base';
import { toSeoMeta, type SeoRow } from '../../common/base/seo.mapper';
import { toTrackSummary } from '../tracks/tracks.mapper';

interface PlaylistRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  isFeatured: boolean;
  totalDurationSec: number | null;
  cover?: Parameters<typeof toMediaImage>[0];
  persona?: { slug: string } | null;
  _count?: { tracks: number };
  tracks?: { note: string | null; track: Parameters<typeof toTrackSummary>[0] }[];
  seoMeta?: SeoRow | null;
}

export function toPlaylistSummary(row: PlaylistRow): PlaylistSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    personaSlug: row.persona?.slug ?? null,
    isFeatured: row.isFeatured,
    // Denormalised on write, so a card can show the runtime without loading
    // and summing every track.
    totalDurationSec: row.totalDurationSec,
    trackCount: row._count?.tracks ?? row.tracks?.length ?? 0,
    cover: toMediaImage(row.cover),
  };
}

export function toPlaylistDetail(row: PlaylistRow): PlaylistDetail {
  return {
    ...toPlaylistSummary(row),
    // Order comes from the query, which sorts by the fractional sortIndex.
    tracks: (row.tracks ?? []).map((entry) => ({
      ...toTrackSummary(entry.track),
      note: entry.note,
    })),
    seo: toSeoMeta(row.seoMeta),
  };
}
