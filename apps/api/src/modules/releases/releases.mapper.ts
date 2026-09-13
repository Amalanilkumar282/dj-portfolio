import type { ReleaseAdminDetail, ReleaseDetail, ReleaseSummary } from '@dj/contracts';
import type { ContentStatus } from '@dj/db';

import { toMediaImage } from '../../common/base';
import { toSeoMeta, type SeoRow } from '../../common/base/seo.mapper';
import { toTrackSummary } from '../tracks/tracks.mapper';

interface ReleaseRow {
  id: string;
  slug: string;
  title: string;
  type: string;
  artistLabel: string;
  label: string | null;
  releaseDate: Date | null;
  isFeatured: boolean;
  cover?: Parameters<typeof toMediaImage>[0];
  persona?: { slug: string } | null;
  _count?: { tracks: number };
  description?: string | null;
  catalogNumber?: string | null;
  upc?: string | null;
  tracks?: (Parameters<typeof toTrackSummary>[0] & { trackNumber: number | null })[];
  streamLinks?: { platform: string; url: string }[];
  seoMeta?: SeoRow | null;
}

interface ReleaseAdminRow extends ReleaseRow {
  status: ContentStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  sortIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toReleaseSummary(row: ReleaseRow): ReleaseSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    type: row.type as ReleaseSummary['type'],
    artistLabel: row.artistLabel,
    label: row.label,
    releaseDate: row.releaseDate,
    cover: toMediaImage(row.cover),
    personaSlug: row.persona?.slug ?? null,
    isFeatured: row.isFeatured,
    trackCount: row._count?.tracks ?? row.tracks?.length ?? 0,
  };
}

export function toReleaseDetail(row: ReleaseRow): ReleaseDetail {
  return {
    ...toReleaseSummary(row),
    description: row.description ?? null,
    catalogNumber: row.catalogNumber ?? null,
    upc: row.upc ?? null,
    tracks: (row.tracks ?? []).map((track) => ({
      ...toTrackSummary(track),
      trackNumber: track.trackNumber,
    })),
    streamLinks: (row.streamLinks ?? []).map((link) => ({
      platform: link.platform as ReleaseDetail['streamLinks'][number]['platform'],
      url: link.url,
    })),
    seo: toSeoMeta(row.seoMeta),
  };
}

export function toReleaseAdminDetail(row: ReleaseAdminRow): ReleaseAdminDetail {
  return {
    ...toReleaseDetail(row),
    status: row.status,
    publishedAt: row.publishedAt,
    scheduledAt: row.scheduledAt,
    sortIndex: row.sortIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
