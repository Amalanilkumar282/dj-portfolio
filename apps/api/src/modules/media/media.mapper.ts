import type { MediaAssetAdminDetail } from '@dj/contracts';

interface MediaAssetRow {
  id: string;
  publicId: string;
  resourceType: string;
  format: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  pages: number | null;
  secureUrl: string;
  folder: string;
  purpose: string;
  originalFilename: string | null;
  dominantColor: string | null;
  blurDataUrl: string | null;
  altText: string | null;
  caption: string | null;
  credit: string | null;
  tags: string[];
  focalX: number | null;
  focalY: number | null;
  waveformPeaks: unknown;
  isSensitive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toMediaAdminDetail(row: MediaAssetRow): MediaAssetAdminDetail {
  return {
    id: row.id,
    publicId: row.publicId,
    resourceType: row.resourceType as MediaAssetAdminDetail['resourceType'],
    format: row.format,
    bytes: row.bytes,
    width: row.width,
    height: row.height,
    durationSec: row.durationSec,
    pages: row.pages,
    secureUrl: row.secureUrl,
    folder: row.folder,
    purpose: row.purpose as MediaAssetAdminDetail['purpose'],
    originalFilename: row.originalFilename,
    dominantColor: row.dominantColor,
    blurDataUrl: row.blurDataUrl,
    altText: row.altText,
    caption: row.caption,
    credit: row.credit,
    tags: row.tags,
    focalX: row.focalX,
    focalY: row.focalY,
    waveformPeaks: Array.isArray(row.waveformPeaks) ? (row.waveformPeaks as number[]) : null,
    isSensitive: row.isSensitive,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
