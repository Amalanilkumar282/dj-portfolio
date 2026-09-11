import { Injectable } from '@nestjs/common';

import { anyDeletionState, ContentStatus, Prisma, publishedWhere } from '@dj/db';

import { SEO_SELECT } from '../../common/base';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * Relations a venue list or detail may include.
 *
 * Fixed fragment rather than a caller-supplied shape — the include allowlist
 * that keeps the API from being asked for an arbitrary relation graph.
 */
const INCLUDE_FRAGMENTS = {
  seo: { seoMeta: { select: SEO_SELECT } },
} as const;

/** Always selected: the event count every venue card and detail page needs. */
const EVENT_COUNT = { _count: { select: { events: true } } } as const;

@Injectable()
export class VenuesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildInclude(include: string[]): Record<string, unknown> {
    const base: Record<string, unknown> = { ...EVENT_COUNT };

    for (const key of include) {
      // Indexed as possibly-missing rather than cast to `keyof`: the keys
      // arrive from a validated query string, and asserting presence would
      // turn an unknown include into an `undefined` spread instead of a
      // no-op.
      const fragment = (INCLUDE_FRAGMENTS as Record<string, object | undefined>)[key];
      if (fragment) Object.assign(base, fragment);
    }

    return base;
  }

  // ── public reads ─────────────────────────────────────────────────────────

  async listPublished(options: {
    city?: string | undefined;
    q?: string | undefined;
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    include: string[];
  }) {
    return this.prisma.client.venue.findMany({
      where: {
        ...publishedWhere(),
        ...(options.city ? { city: { equals: options.city, mode: 'insensitive' } } : {}),
        // Trigram index on name makes this a mid-word match, not a prefix.
        ...(options.q ? { name: { contains: options.q, mode: 'insensitive' } } : {}),
        // Spread last so a filter above cannot overwrite the keyset OR-clause
        // and silently disable pagination.
        ...(options.keyset ?? {}),
      },
      orderBy: options.orderBy,
      take: options.take,
      include: this.buildInclude(options.include),
    });
  }

  async findPublishedBySlug(slug: string, include: string[]) {
    return this.prisma.client.venue.findFirst({
      where: { slug, ...publishedWhere() },
      include: this.buildInclude(include),
    });
  }

  /** Slugs for `generateStaticParams` and the sitemap. */
  async listPublishedSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.prisma.client.venue.findMany({
      where: publishedWhere(),
      orderBy: { sortIndex: 'asc' },
      select: { slug: true, updatedAt: true },
    });
  }

  // ── admin reads ──────────────────────────────────────────────────────────

  async listForAdmin(options: {
    q?: string | undefined;
    status?: ContentStatus | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    skip?: number;
  }) {
    const where = {
      ...(options.status ? { status: options.status } : {}),
      ...(options.q ? { name: { contains: options.q, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.venue.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: this.buildInclude(['seo']),
      }),
      this.prisma.client.venue.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.venue.findUnique({
      where: { id },
      include: this.buildInclude(['seo']),
    });
  }

  /**
   * `findFirst` with `anyDeletionState()`, not `findUnique`. A soft-deleted
   * venue still occupies its `slug` at the database level, but a plain
   * `findUnique` is narrowed by the soft-delete extension to
   * `deletedAt: null` and so reports the slug free — `SlugService`'s
   * auto-generated path would then hand back a slug the database
   * immediately rejects. See `anyDeletionState()`.
   */
  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.venue.findFirst({
      where: { slug, ...anyDeletionState() },
      select: { id: true },
    });

    return existing != null && existing.id !== exceptId;
  }

  /**
   * `@@unique([name, city])`, so a duplicate is possible without ever
   * touching the slug. Checked proactively so the 409 names the right
   * fields — left to Postgres, the error surfaces as a P2002 against a
   * composite key the caller has no vocabulary for. `anyDeletionState()` for
   * the same reason as `isSlugTaken`: a soft-deleted venue still holds its
   * (name, city) pair.
   */
  async isNameCityTaken(name: string, city: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.venue.findFirst({
      where: { name, city, ...anyDeletionState() },
      select: { id: true },
    });

    return existing != null && existing.id !== exceptId;
  }

  // ── writes ───────────────────────────────────────────────────────────────

  async create(data: Prisma.VenueCreateInput) {
    return this.prisma.client.venue.create({
      data,
      include: this.buildInclude(['seo']),
    });
  }

  async update(id: string, data: Prisma.VenueUpdateInput) {
    return this.prisma.client.venue.update({
      where: { id },
      data,
      include: this.buildInclude(['seo']),
    });
  }

  async updateStatus(
    id: string,
    data: { status: ContentStatus; publishedAt?: Date | null; scheduledAt?: Date | null },
  ) {
    return this.prisma.client.venue.update({
      where: { id },
      data,
      include: this.buildInclude(['seo']),
    });
  }

  async softDelete(id: string): Promise<void> {
    // The Prisma extension rewrites this into an UPDATE stamping deletedAt.
    await this.prisma.client.venue.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.venue.update({
      // The explicit deletedAt filter is required: without it the soft-delete
      // extension hides the very row being restored.
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
      include: this.buildInclude(['seo']),
    });
  }

  /** One transaction, because drag-and-drop sends a whole permutation. */
  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.venue.update({
          where: { id: entry.id },
          data: { sortIndex: entry.sortIndex },
        }),
      ),
    );
  }
}
