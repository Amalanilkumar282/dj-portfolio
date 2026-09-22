import type { VideoAdminDetail, VideoDetail, VideoSummary } from '@dj/contracts';
import type { ContentStatus } from '@dj/db';

import { toMediaImage, type MediaAssetRow } from '../../common/base';

interface VideoRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  provider: string;
  providerVideoId: string | null;
  embedUrl: string | null;
  durationSec: number | null;
  isFeatured: boolean;
  transcript?: string | null;
  persona?: { slug: string; key: string } | null;
  event?: { slug: string } | null;
  thumbnail?: MediaAssetRow | null;
  hostedMedia?: { secureUrl: string } | null;
}

interface VideoAdminRow extends VideoRow {
  hostedMediaId: string | null;
  thumbnailId: string | null;
  eventId: string | null;
  status: ContentStatus;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  sortIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toVideoSummary(row: VideoRow): VideoSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    provider: row.provider as VideoSummary['provider'],
    providerVideoId: row.providerVideoId,
    embedUrl: row.embedUrl,
    hostedUrl: row.hostedMedia?.secureUrl ?? null,
    thumbnail: toMediaImage(row.thumbnail),
    durationSec: row.durationSec,
    personaSlug: row.persona?.slug ?? null,
    eventSlug: row.event?.slug ?? null,
    isFeatured: row.isFeatured,
  };
}

export function toVideoDetail(row: VideoRow): VideoDetail {
  return {
    ...toVideoSummary(row),
    transcript: row.transcript ?? null,
  };
}

export function toVideoAdminDetail(row: VideoAdminRow): VideoAdminDetail {
  return {
    ...toVideoDetail(row),
    hostedMediaId: row.hostedMediaId,
    thumbnailId: row.thumbnailId,
    personaKey: (row.persona?.key as VideoAdminDetail['personaKey']) ?? null,
    eventId: row.eventId,
    status: row.status,
    publishedAt: row.publishedAt,
    scheduledAt: row.scheduledAt,
    sortIndex: row.sortIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
