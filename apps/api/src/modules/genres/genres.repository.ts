import { Injectable } from '@nestjs/common';

import { Prisma, publishedWhere } from '@dj/db';

import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * Genre data access.
 *
 * Genres are a taxonomy, so this repository differs from the publishable ones
 * in two ways worth knowing before copying it:
 *
 * - **There is no `publishedWhere()` on the genre itself.** A genre has no
 *   `status`. Publish state only enters when filtering by *usage*, where the
 *   question is whether any published content carries the tag.
 * - **`delete` is a real DELETE.** `Genre` is not in the soft-delete model set,
 *   and both join tables cascade. See `countReferences`.
 */
@Injectable()
export class GenresRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Counts for the admin list and the delete guard. */
  private static readonly COUNT_SELECT = {
    _count: { select: { personas: true, tracks: true } },
  } as const;

  // ── public reads ─────────────────────────────────────────────────────────

  async list(options: {
    q?: string | undefined;
    inUse?: boolean | undefined;
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
  }) {
    return this.prisma.client.genre.findMany({
      where: {
        ...(options.q ? { name: { contains: options.q, mode: 'insensitive' } } : {}),
        // "In use" means attached to something the public can actually see, so
        // the filter reaches through the join into the owning content's
        // publish state. A genre tagged only on drafts is not in use.
        ...(options.inUse
          ? {
              OR: [
                { personas: { some: { persona: publishedWhere() } } },
                { tracks: { some: { track: publishedWhere() } } },
              ],
            }
          : {}),
        // Spread last so a filter above cannot overwrite the keyset OR-clause
        // and silently disable pagination.
        ...(options.keyset ?? {}),
      },
      orderBy: options.orderBy,
      take: options.take,
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.client.genre.findUnique({ where: { slug } });
  }

  /** Slugs for `generateStaticParams` and the sitemap. */
  async listSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.prisma.client.genre.findMany({
      orderBy: { sortIndex: 'asc' },
      select: { slug: true, updatedAt: true },
    });
  }

  // ── admin reads ──────────────────────────────────────────────────────────

  async listForAdmin(options: {
    q?: string | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    skip?: number;
  }) {
    const where = options.q ? { name: { contains: options.q, mode: 'insensitive' as const } } : {};

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.genre.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: GenresRepository.COUNT_SELECT,
      }),
      this.prisma.client.genre.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.genre.findUnique({
      where: { id },
      include: GenresRepository.COUNT_SELECT,
    });
  }

  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.genre.findUnique({
      where: { slug },
      select: { id: true },
    });

    return existing != null && existing.id !== exceptId;
  }

  /**
   * `name` is unique too, so it needs its own check.
   *
   * Without it a duplicate name surfaces as a raw P2002 on a column the caller
   * never mentioned — the slug is what they edited, the name is what collided.
   */
  async isNameTaken(name: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.genre.findUnique({
      where: { name },
      select: { id: true },
    });

    return existing != null && existing.id !== exceptId;
  }

  // ── writes ───────────────────────────────────────────────────────────────

  async create(data: Prisma.GenreCreateInput) {
    return this.prisma.client.genre.create({
      data,
      include: GenresRepository.COUNT_SELECT,
    });
  }

  async update(id: string, data: Prisma.GenreUpdateInput) {
    return this.prisma.client.genre.update({
      where: { id },
      data,
      include: GenresRepository.COUNT_SELECT,
    });
  }

  /**
   * What would be lost by deleting this genre.
   *
   * `PersonaGenre` and `TrackGenre` both declare `onDelete: Cascade`, so a
   * delete does not fail on a foreign key — it succeeds and silently strips
   * the tag from every persona and track that carried it. The service uses
   * this to refuse instead.
   */
  async countReferences(id: string): Promise<{ personas: number; tracks: number }> {
    const [personas, tracks] = await this.prisma.client.$transaction([
      this.prisma.client.personaGenre.count({ where: { genreId: id } }),
      this.prisma.client.trackGenre.count({ where: { genreId: id } }),
    ]);

    return { personas, tracks };
  }

  /** Names of the referencing rows, so the 409 can say what is in the way. */
  async listReferences(id: string, take = 20) {
    const [personas, tracks] = await this.prisma.client.$transaction([
      this.prisma.client.personaGenre.findMany({
        where: { genreId: id },
        take,
        select: { persona: { select: { id: true, stageName: true } } },
      }),
      this.prisma.client.trackGenre.findMany({
        where: { genreId: id },
        take,
        select: { track: { select: { id: true, title: true } } },
      }),
    ]);

    return [
      ...personas.map((row) => ({
        entity: 'Persona',
        id: row.persona.id,
        title: row.persona.stageName,
      })),
      ...tracks.map((row) => ({ entity: 'Track', id: row.track.id, title: row.track.title })),
    ];
  }

  /**
   * A genuine hard delete — `Genre` has no `deletedAt`.
   *
   * Only reachable once the service has confirmed nothing references it, so
   * the cascade has nothing to cascade to.
   */
  async hardDelete(id: string): Promise<void> {
    await this.prisma.client.genre.delete({ where: { id } });
  }

  /** One transaction, because drag-and-drop sends a whole permutation. */
  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.genre.update({
          where: { id: entry.id },
          data: { sortIndex: entry.sortIndex },
        }),
      ),
    );
  }
}
