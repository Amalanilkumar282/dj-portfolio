import { Injectable } from '@nestjs/common';

import {
  anyDeletionState,
  Prisma,
  runWithHardDelete,
  type MediaPurpose,
  type MediaResourceType,
} from '@dj/db';

import { PrismaService } from '../../infra/prisma/prisma.service';

/** One relation this asset may occupy, for the 409 reference listing. */
export interface MediaReference {
  entity: string;
  id: string;
  title: string;
}

/**
 * The scalar columns `MediaService.confirm()` writes.
 *
 * Declared locally rather than reusing `Prisma.MediaAssetUncheckedCreateInput`
 * so the service does not need to import the Prisma namespace — only
 * `*.repository.ts` and `infra/` may, per `dj/prisma-only-in-repositories`.
 */
export interface MediaCreateData {
  publicId: string;
  resourceType: string;
  format: string;
  version: number | null;
  bytes: number;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  durationSec: number | null;
  pages: number | null;
  secureUrl: string;
  folder: string;
  purpose: string;
  originalFilename: string | null;
  etag: string | null;
  colors: [string, number][] | null;
  dominantColor: string | null;
  blurDataUrl: string | null;
  altText: string | null;
  caption: string | null;
  credit: string | null;
  tags: string[];
  uploadedById: string | null;
}

/** The scalar columns `MediaService.update()` may set. */
export interface MediaUpdateData {
  altText?: string | null;
  caption?: string | null;
  credit?: string | null;
  tags?: string[];
  focalX?: number | null;
  focalY?: number | null;
  isSensitive?: boolean;
}

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: MediaCreateData) {
    return this.prisma.client.mediaAsset.create({
      data: {
        ...data,
        resourceType: data.resourceType as MediaResourceType,
        purpose: data.purpose as MediaPurpose,
        colors: data.colors ?? Prisma.JsonNull,
      },
    });
  }

  async findByIdForAdmin(id: string) {
    // `anyDeletionState()`: the admin detail view must still resolve a
    // soft-deleted asset (the trash view links to it), unlike every public
    // read which relies on the extension's default live-only filter.
    return this.prisma.client.mediaAsset.findFirst({ where: { id, ...anyDeletionState() } });
  }

  async isPublicIdTaken(publicId: string): Promise<boolean> {
    const existing = await this.prisma.client.mediaAsset.findFirst({
      where: { publicId, ...anyDeletionState() },
      select: { id: true },
    });
    return existing != null;
  }

  /** For server-side uploads that overwrite in place (the EPK PDF regenerator). */
  async findByPublicId(publicId: string) {
    return this.prisma.client.mediaAsset.findFirst({ where: { publicId, ...anyDeletionState() } });
  }

  async listForAdmin(options: {
    q?: string | undefined;
    purpose?: string | undefined;
    resourceType?: string | undefined;
    trashed?: boolean | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    skip?: number;
  }) {
    const where = {
      ...(options.trashed ? { deletedAt: { not: null } } : {}),
      ...(options.purpose ? { purpose: options.purpose as never } : {}),
      ...(options.resourceType ? { resourceType: options.resourceType as never } : {}),
      ...(options.q
        ? {
            OR: [
              { originalFilename: { contains: options.q, mode: 'insensitive' as const } },
              { altText: { contains: options.q, mode: 'insensitive' as const } },
              { publicId: { contains: options.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.mediaAsset.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
      }),
      this.prisma.client.mediaAsset.count({ where }),
    ]);

    return { rows, total };
  }

  async update(id: string, data: MediaUpdateData) {
    return this.prisma.client.mediaAsset.update({ where: { id }, data });
  }

  /** For `MediaService.recordServerUpload()` re-uploading in place. */
  async updateServerUploadStats(id: string, data: { bytes: number; secureUrl: string }) {
    return this.prisma.client.mediaAsset.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.client.mediaAsset.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.mediaAsset.update({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
  }

  /**
   * A genuine hard delete. Only reachable through `runWithHardDelete` — the
   * nightly orphan sweeper is the sole legitimate caller. See
   * `packages/db/src/context.ts`.
   */
  async hardDelete(id: string): Promise<void> {
    await runWithHardDelete(() => this.prisma.client.mediaAsset.delete({ where: { id } }));
  }

  /**
   * Purges assets soft-deleted longer than `cutoff`, both DB row and (via
   * `onCandidate`) the Cloudinary original.
   *
   * The whole run — lock, list, per-item purge — happens inside **one**
   * interactive transaction, which is what makes `pg_try_advisory_xact_lock`
   * safe under pgbouncer's transaction-mode pooling: the lock is scoped to
   * the transaction and is guaranteed released at commit, on the same
   * connection throughout. A session-level `pg_advisory_lock` would NOT be
   * safe here — the physical connection can be handed to an unrelated
   * pgbouncer client before an explicit unlock ever runs.
   *
   * `take` bounds one run (default 200) so a large backlog cannot hold the
   * transaction, and therefore a connection, open indefinitely. `onCandidate`
   * does the Cloudinary destroy call before the DB row is hard-deleted, so a
   * crash between the two leaves the DB row for the next run to retry rather
   * than orphaning the Cloudinary asset.
   */
  async sweepOrphans(
    cutoff: Date,
    take: number,
    onCandidate: (asset: {
      id: string;
      publicId: string;
      resourceType: string;
    }) => Promise<void>,
  ): Promise<{ ran: boolean; processed: number }> {
    return this.prisma.client.$transaction(
      async (tx) => {
        const [lockRow] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtext('media-orphan-sweep')) AS locked`;

        if (!lockRow?.locked) return { ran: false, processed: 0 };

        const candidates = await tx.mediaAsset.findMany({
          where: { deletedAt: { lt: cutoff } },
          select: { id: true, publicId: true, resourceType: true },
          take,
        });

        for (const asset of candidates) {
          await onCandidate(asset);
          await runWithHardDelete(() => tx.mediaAsset.delete({ where: { id: asset.id } }));
        }

        return { ran: true, processed: candidates.length };
      },
      { timeout: 120_000, maxWait: 5_000 },
    );
  }

  /**
   * What would be lost by deleting this asset, across every relation that
   * can point at a `MediaAsset`.
   *
   * `galleryItems` is listed separately from the rest: its `mediaId` is
   * **required** (`onDelete: Cascade`), unlike every other relation here
   * which is optional (`onDelete: SetNull`) — so it cannot be cleared by a
   * force-delete the way the others can. See `clearNullableReferences`.
   */
  async countReferences(id: string): Promise<{ nullable: number; galleryItems: number }> {
    const client = this.prisma.client;
    const counts = await client.$transaction([
      client.persona.count({ where: { OR: [{ heroMediaId: id }, { avatarMediaId: id }, { bgVideoMediaId: id }] } }),
      client.event.count({ where: { flyerId: id } }),
      client.track.count({ where: { OR: [{ artworkId: id }, { audioId: id }] } }),
      client.playlist.count({ where: { coverId: id } }),
      client.release.count({ where: { coverId: id } }),
      client.post.count({ where: { coverId: id } }),
      client.testimonial.count({ where: { avatarId: id } }),
      client.brand.count({ where: { OR: [{ logoId: id }, { logoMonoId: id }] } }),
      client.service.count({ where: { imageId: id } }),
      client.pressAsset.count({ where: { mediaId: id } }),
      client.video.count({ where: { OR: [{ thumbnailId: id }, { hostedMediaId: id }] } }),
      client.gearItem.count({ where: { imageId: id } }),
      client.experienceEntry.count({ where: { logoId: id } }),
      client.venue.count({ where: { logoId: id } }),
      client.program.count({ where: { heroId: id } }),
      client.seoMeta.count({ where: { ogImageId: id } }),
      client.siteSettings.count({ where: { OR: [{ logoId: id }, { defaultOgImageId: id }] } }),
      // `GalleryItem` has no `deletedAt` of its own (only `Gallery` is a
      // soft-delete model), and Prisma's soft-delete extension only narrows
      // queries on the model it's actually scoped to — a relation filter
      // like `gallery: {...}` here is a query on `GalleryItem`, not on
      // `Gallery`, so it is NOT auto-narrowed. Without `deletedAt: null`
      // spelled out explicitly, a gallery the admin deleted (soft-deleted:
      // `Gallery.deletedAt` set, but its `GalleryItem` rows untouched —
      // there is no cascading soft-delete for them) would count as "still
      // referencing" its media forever, permanently blocking deletion of an
      // asset the admin had already removed every visible reference to.
      client.galleryItem.count({ where: { mediaId: id, gallery: { deletedAt: null } } }),
    ]);

    const galleryItems = counts.pop() ?? 0;
    return { nullable: counts.reduce((sum, n) => sum + n, 0), galleryItems };
  }

  /** Names of a sample of the referencing rows, for the 409 body. */
  async listReferences(id: string, take = 20): Promise<MediaReference[]> {
    const client = this.prisma.client;
    const [personas, events, tracks, playlists, testimonials, brands, services] = await client.$transaction([
      client.persona.findMany({
        where: { OR: [{ heroMediaId: id }, { avatarMediaId: id }, { bgVideoMediaId: id }] },
        take,
        select: { id: true, stageName: true },
      }),
      client.event.findMany({ where: { flyerId: id }, take, select: { id: true, title: true } }),
      client.track.findMany({
        where: { OR: [{ artworkId: id }, { audioId: id }] },
        take,
        select: { id: true, title: true },
      }),
      client.playlist.findMany({ where: { coverId: id }, take, select: { id: true, title: true } }),
      client.testimonial.findMany({ where: { avatarId: id }, take, select: { id: true, authorName: true } }),
      client.brand.findMany({
        where: { OR: [{ logoId: id }, { logoMonoId: id }] },
        take,
        select: { id: true, name: true },
      }),
      client.service.findMany({ where: { imageId: id }, take, select: { id: true, name: true } }),
    ]);

    return [
      ...personas.map((r) => ({ entity: 'Persona', id: r.id, title: r.stageName })),
      ...events.map((r) => ({ entity: 'Event', id: r.id, title: r.title })),
      ...tracks.map((r) => ({ entity: 'Track', id: r.id, title: r.title })),
      ...playlists.map((r) => ({ entity: 'Playlist', id: r.id, title: r.title })),
      ...testimonials.map((r) => ({ entity: 'Testimonial', id: r.id, title: r.authorName })),
      ...brands.map((r) => ({ entity: 'Brand', id: r.id, title: r.name })),
      ...services.map((r) => ({ entity: 'Service', id: r.id, title: r.name })),
    ].slice(0, take);
  }

  /**
   * Nulls every nullable reference to this asset in one transaction. Called
   * only after the service has confirmed `galleryItems` (the one non-nullable
   * relation) is zero.
   */
  async clearNullableReferences(id: string): Promise<void> {
    const client = this.prisma.client;
    await client.$transaction([
      client.persona.updateMany({ where: { heroMediaId: id }, data: { heroMediaId: null } }),
      client.persona.updateMany({ where: { avatarMediaId: id }, data: { avatarMediaId: null } }),
      client.persona.updateMany({ where: { bgVideoMediaId: id }, data: { bgVideoMediaId: null } }),
      client.event.updateMany({ where: { flyerId: id }, data: { flyerId: null } }),
      client.track.updateMany({ where: { artworkId: id }, data: { artworkId: null } }),
      client.track.updateMany({ where: { audioId: id }, data: { audioId: null } }),
      client.playlist.updateMany({ where: { coverId: id }, data: { coverId: null } }),
      client.release.updateMany({ where: { coverId: id }, data: { coverId: null } }),
      client.post.updateMany({ where: { coverId: id }, data: { coverId: null } }),
      client.testimonial.updateMany({ where: { avatarId: id }, data: { avatarId: null } }),
      client.brand.updateMany({ where: { logoId: id }, data: { logoId: null } }),
      client.brand.updateMany({ where: { logoMonoId: id }, data: { logoMonoId: null } }),
      client.service.updateMany({ where: { imageId: id }, data: { imageId: null } }),
      client.pressAsset.updateMany({ where: { mediaId: id }, data: { mediaId: null } }),
      client.video.updateMany({ where: { thumbnailId: id }, data: { thumbnailId: null } }),
      client.video.updateMany({ where: { hostedMediaId: id }, data: { hostedMediaId: null } }),
      client.gearItem.updateMany({ where: { imageId: id }, data: { imageId: null } }),
      client.experienceEntry.updateMany({ where: { logoId: id }, data: { logoId: null } }),
      client.venue.updateMany({ where: { logoId: id }, data: { logoId: null } }),
      client.program.updateMany({ where: { heroId: id }, data: { heroId: null } }),
      client.seoMeta.updateMany({ where: { ogImageId: id }, data: { ogImageId: null } }),
      client.siteSettings.updateMany({ where: { logoId: id }, data: { logoId: null } }),
      client.siteSettings.updateMany({ where: { defaultOgImageId: id }, data: { defaultOgImageId: null } }),
    ]);
  }
}
