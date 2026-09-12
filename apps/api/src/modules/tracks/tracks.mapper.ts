import type { TrackAdminDetail, TrackDetail, TrackSummary } from '@dj/contracts';
import type { ContentStatus } from '@dj/db';

import { toMediaImage } from '../../common/base';
import { toSeoMeta, type SeoRow } from '../../common/base/seo.mapper';

/**
 * Loosely typed rather than depending on generated per-query Prisma types.
 *
 * Those types are structurally different for every `include` combination, so
 * naming them would mean a distinct mapper per query. Optional fields here are
 * the ones only present when the caller asked for that relation.
 */
interface TrackRow {
  id: string;
  slug: string;
  title: string;
  artistLabel: string;
  type: string;
  bpm: number | null;
  musicalKey: string | null;
  durationSec: number | null;
  releaseDate: Date | null;
  isFeatured: boolean;
  playCount: number;
  likeCount: number;
  artwork?: Parameters<typeof toMediaImage>[0];
  persona?: { slug: string } | null;
  description?: string | null;
  soundcloudTrackId?: string | null;
  embedUrl?: string | null;
  tags?: string[];
  genres?: { genre: { slug: string; name: string } }[];
  streamLinks?: { platform: string; url: string }[];
  audio?: { secureUrl: string; waveformPeaks: unknown } | null;
  seoMeta?: SeoRow | null;
}

/** The admin row, which carries the publish-workflow columns. */
interface TrackAdminRow extends TrackRow {
  status: ContentStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  sortIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toTrackSummary(row: TrackRow): TrackSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    artistLabel: row.artistLabel,
    type: row.type as TrackSummary['type'],
    bpm: row.bpm,
    musicalKey: row.musicalKey,
    durationSec: row.durationSec,
    releaseDate: row.releaseDate,
    isFeatured: row.isFeatured,
    artwork: toMediaImage(row.artwork),
    personaSlug: row.persona?.slug ?? null,
    soundcloudTrackId: row.soundcloudTrackId ?? null,
    // Hand-curated figures. Never presented as live counts — see
    // docs/07-content/brand.md. Platform sync is Phase 13.
    playCount: row.playCount,
    likeCount: row.likeCount,
  };
}

export function toTrackDetail(row: TrackRow): TrackDetail {
  return {
    ...toTrackSummary(row),
    description: row.description ?? null,
    embedUrl: row.embedUrl ?? null,
    tags: row.tags ?? [],
    genres: (row.genres ?? []).map((link) => ({
      slug: link.genre.slug,
      name: link.genre.name,
    })),
    streamLinks: (row.streamLinks ?? []).map((link) => ({
      platform: link.platform as TrackDetail['streamLinks'][number]['platform'],
      url: link.url,
    })),
    // Computed at upload and stored, so the waveform renders without
    // downloading the audio file.
    waveformPeaks: Array.isArray(row.audio?.waveformPeaks)
      ? (row.audio.waveformPeaks as number[])
      : null,
    audioUrl: row.audio?.secureUrl ?? null,
    seo: toSeoMeta(row.seoMeta),
  };
}

/**
 * The admin shape. Kept separate from `toTrackDetail` so a public response
 * cannot accidentally disclose that a draft exists, or when something is
 * scheduled.
 */
export function toTrackAdminDetail(row: TrackAdminRow): TrackAdminDetail {
  return {
    ...toTrackDetail(row),
    status: row.status,
    publishedAt: row.publishedAt,
    scheduledAt: row.scheduledAt,
    sortIndex: row.sortIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
