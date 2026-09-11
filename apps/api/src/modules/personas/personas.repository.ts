import { Injectable } from '@nestjs/common';

import { anyDeletionState, ContentStatus, type PersonaKey, Prisma, publishedWhere } from '@dj/db';

import { MEDIA_IMAGE_SELECT } from '../../common/base';
import { PrismaService } from '../../infra/prisma/prisma.service';

/** SEO columns the mapper reads. Selected explicitly so nothing over-fetches. */
const SEO_SELECT = {
  title: true,
  description: true,
  keywords: true,
  canonicalUrl: true,
  ogTitle: true,
  ogDescription: true,
  noIndex: true,
  noFollow: true,
} as const;

/**
 * Relations a persona list or detail may include.
 *
 * Fixed fragments rather than a caller-supplied shape: this is the N+1 and
 * over-fetch guard from the include allowlist. A client can ask for
 * `?include=genres` and gets exactly this, never an arbitrary depth.
 */
const INCLUDE_FRAGMENTS = {
  genres: {
    genres: {
      orderBy: { sortIndex: 'asc' },
      select: { isPrimary: true, genre: { select: { slug: true, name: true } } },
    },
  },
  socialLinks: {
    socialLinks: {
      where: { isVisible: true },
      orderBy: { sortIndex: 'asc' },
      select: {
        platform: true,
        url: true,
        handle: true,
        followerCount: true,
        isPrimary: true,
      },
    },
  },
  seo: { seoMeta: { select: SEO_SELECT } },
} as const;

@Injectable()
export class PersonasRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Builds a Prisma include from the validated allowlist. */
  private buildInclude(include: string[]): Record<string, unknown> {
    const base: Record<string, unknown> = {
      heroMedia: { select: MEDIA_IMAGE_SELECT },
      avatarMedia: { select: MEDIA_IMAGE_SELECT },
    };

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

  /**
   * Published personas.
   *
   * `publishedWhere()` is composed here rather than being implicit, because
   * publish state is legitimately different per caller — the admin methods
   * below deliberately omit it. See packages/db/src/extensions/publish.ts.
   */
  async listPublished(options: {
    featured?: boolean | undefined;
    q?: string | undefined;
    /** Keyset predicate from a decoded cursor, built by CursorService. */
    keyset?: Record<string, unknown> | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    include: string[];
  }) {
    return this.prisma.client.persona.findMany({
      where: {
        ...publishedWhere(),
        ...(options.featured === undefined ? {} : { isFeatured: options.featured }),
        // Trigram index on stageName makes this a mid-word match, not a prefix.
        ...(options.q ? { stageName: { contains: options.q, mode: 'insensitive' } } : {}),
        // Spread last so the keyset OR-clause cannot be overwritten by a
        // filter above it, which would silently disable pagination.
        ...(options.keyset ?? {}),
      },
      orderBy: options.orderBy,
      take: options.take,
      include: this.buildInclude(options.include),
    });
  }

  async findPublishedBySlug(slug: string, include: string[]) {
    return this.prisma.client.persona.findFirst({
      where: { slug, ...publishedWhere() },
      include: this.buildInclude(include),
    });
  }

  /** Slugs for `generateStaticParams` and the sitemap. */
  async listPublishedSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.prisma.client.persona.findMany({
      where: publishedWhere(),
      orderBy: { sortIndex: 'asc' },
      select: { slug: true, updatedAt: true },
    });
  }

  // ── admin reads ──────────────────────────────────────────────────────────

  /** Every status, so the admin can see drafts. */
  async listForAdmin(options: {
    status?: ContentStatus | undefined;
    q?: string | undefined;
    orderBy: Record<string, 'asc' | 'desc'>[];
    take: number;
    skip?: number;
  }) {
    const where = {
      ...(options.status ? { status: options.status } : {}),
      ...(options.q ? { stageName: { contains: options.q, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await this.prisma.client.$transaction([
      this.prisma.client.persona.findMany({
        where,
        orderBy: options.orderBy,
        take: options.take,
        ...(options.skip ? { skip: options.skip } : {}),
        include: this.buildInclude(['genres', 'socialLinks', 'seo']),
      }),
      this.prisma.client.persona.count({ where }),
    ]);

    return { rows, total };
  }

  async findByIdForAdmin(id: string) {
    return this.prisma.client.persona.findUnique({
      where: { id },
      include: this.buildInclude(['genres', 'socialLinks', 'seo']),
    });
  }

  /**
   * `findFirst` with `anyDeletionState()`, not `findUnique`. A soft-deleted
   * persona still occupies its `slug` at the database level — soft delete
   * only rewrites `DELETE`, it does not relax the unique constraint — but a
   * plain `findUnique` is narrowed by the soft-delete extension to
   * `deletedAt: null` and so reports the slug free. `SlugService`'s
   * auto-generated path then hands back a slug it believes is guaranteed
   * available, which the database immediately rejects: a caller who never
   * supplied a slug at all gets an unexplained 409. See `anyDeletionState()`.
   */
  async isSlugTaken(slug: string, exceptId?: string): Promise<boolean> {
    const existing = await this.prisma.client.persona.findFirst({
      where: { slug, ...anyDeletionState() },
      select: { id: true },
    });

    return existing != null && existing.id !== exceptId;
  }

  // ── writes ───────────────────────────────────────────────────────────────

  async create(data: Prisma.PersonaCreateInput) {
    return this.prisma.client.persona.create({
      data,
      include: this.buildInclude(['genres', 'socialLinks', 'seo']),
    });
  }

  async update(id: string, data: Prisma.PersonaUpdateInput) {
    return this.prisma.client.persona.update({
      where: { id },
      data,
      include: this.buildInclude(['genres', 'socialLinks', 'seo']),
    });
  }

  async updateStatus(
    id: string,
    data: { status: ContentStatus; publishedAt?: Date | null; scheduledAt?: Date | null },
  ) {
    return this.prisma.client.persona.update({
      where: { id },
      data,
      include: this.buildInclude(['genres', 'socialLinks', 'seo']),
    });
  }

  async softDelete(id: string): Promise<void> {
    // The Prisma extension rewrites this into an UPDATE stamping deletedAt,
    // so the row stays recoverable from the admin trash for 30 days.
    await this.prisma.client.persona.delete({ where: { id } });
  }

  async restore(id: string) {
    return this.prisma.client.persona.update({
      // The explicit deletedAt filter is required: without it the soft-delete
      // extension hides the very row being restored.
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
      include: this.buildInclude(['genres', 'socialLinks', 'seo']),
    });
  }

  /** One transaction, because drag-and-drop sends a whole permutation. */
  async reorder(entries: { id: string; sortIndex: number }[]): Promise<void> {
    await this.prisma.client.$transaction(
      entries.map((entry) =>
        this.prisma.client.persona.update({
          where: { id: entry.id },
          data: { sortIndex: entry.sortIndex },
        }),
      ),
    );
  }

  /** Replaces the genre set wholesale, so removals actually take effect. */
  async setGenres(personaId: string, genreSlugs: string[]): Promise<void> {
    const genres = await this.prisma.client.genre.findMany({
      where: { slug: { in: genreSlugs } },
      select: { id: true, slug: true },
    });

    // Preserve the caller's order; the first becomes the primary genre.
    const ordered = genreSlugs
      .map((slug) => genres.find((genre) => genre.slug === slug))
      .filter((genre): genre is { id: string; slug: string } => genre != null);

    await this.prisma.client.$transaction([
      this.prisma.client.personaGenre.deleteMany({ where: { personaId } }),
      this.prisma.client.personaGenre.createMany({
        data: ordered.map((genre, index) => ({
          personaId,
          genreId: genre.id,
          isPrimary: index === 0,
          sortIndex: index,
        })),
        skipDuplicates: true,
      }),
    ]);
  }

  /**
   * Everything a persona landing page needs, in two queries.
   *
   * This is the backend-for-frontend concession described in
   * docs/02-architecture/backend.md. The alternative is eight round trips per
   * page render; here it is one `findFirst` with a bounded include, plus one
   * transaction of counts.
   *
   * Every nested list is `take`-limited. Without that, a persona with 200
   * events would pull all of them into a page that shows five.
   */
  async findPageData(slug: string, now: Date) {
    const persona = await this.prisma.client.persona.findFirst({
      where: { slug, ...publishedWhere() },
      include: {
        heroMedia: { select: MEDIA_IMAGE_SELECT },
        avatarMedia: { select: MEDIA_IMAGE_SELECT },
        ...INCLUDE_FRAGMENTS.genres,
        ...INCLUDE_FRAGMENTS.socialLinks,
        ...INCLUDE_FRAGMENTS.seo,

        tracks: {
          where: { ...publishedWhere(), isFeatured: true },
          orderBy: [{ sortIndex: 'asc' }, { releaseDate: 'desc' }],
          take: 8,
          include: {
            artwork: { select: MEDIA_IMAGE_SELECT },
            persona: { select: { slug: true } },
          },
        },

        playlists: {
          where: publishedWhere(),
          orderBy: { sortIndex: 'asc' },
          take: 6,
          include: {
            cover: { select: MEDIA_IMAGE_SELECT },
            persona: { select: { slug: true } },
            _count: { select: { tracks: true } },
          },
        },

        releases: {
          where: publishedWhere(),
          orderBy: { releaseDate: 'desc' },
          take: 6,
          include: {
            cover: { select: MEDIA_IMAGE_SELECT },
            persona: { select: { slug: true } },
            _count: { select: { tracks: true } },
          },
        },

        programs: {
          where: publishedWhere(),
          orderBy: { sortIndex: 'asc' },
          take: 8,
          include: {
            hero: { select: MEDIA_IMAGE_SELECT },
            persona: { select: { slug: true } },
            venue: { select: { name: true, slug: true } },
            _count: { select: { events: true } },
          },
        },

        events: {
          where: { ...publishedWhere(), startsAt: { gte: now } },
          orderBy: { startsAt: 'asc' },
          take: 6,
          include: {
            flyer: { select: MEDIA_IMAGE_SELECT },
            persona: { select: { slug: true } },
            venue: true,
            program: { select: { slug: true } },
          },
        },
      },
    });

    if (!persona) return null;

    const [pastEventCount, recentEvents] = await this.prisma.client.$transaction([
      this.prisma.client.event.count({
        where: { personaId: persona.id, ...publishedWhere(), startsAt: { lt: now } },
      }),
      this.prisma.client.event.findMany({
        where: { personaId: persona.id, ...publishedWhere(), startsAt: { lt: now } },
        orderBy: { startsAt: 'desc' },
        take: 6,
        include: {
          flyer: { select: MEDIA_IMAGE_SELECT },
          persona: { select: { slug: true } },
          venue: true,
          program: { select: { slug: true } },
        },
      }),
    ]);

    return { persona, pastEventCount, recentEvents };
  }

  /**
   * Venues this persona has played, with a per-venue event count.
   *
   * Drives the venue cloud and the gig map. Grouped in the database rather
   * than counted in JavaScript, so it stays one query however many events
   * exist.
   */
  async listVenuesPlayed(personaId: string, take = 30) {
    const grouped = await this.prisma.client.event.groupBy({
      by: ['venueId'],
      where: { personaId, venueId: { not: null }, ...publishedWhere() },
      _count: { venueId: true },
      orderBy: { _count: { venueId: 'desc' } },
      take,
    });

    const venueIds = grouped.map((row) => row.venueId).filter((id): id is string => id != null);

    if (venueIds.length === 0) return [];

    const venues = await this.prisma.client.venue.findMany({
      where: { id: { in: venueIds } },
    });

    const countById = new Map(grouped.map((row) => [row.venueId, row._count.venueId]));

    // Re-sorted to the grouped order: findMany does not preserve `in` order,
    // and the most-played venue should lead the list.
    return venueIds
      .map((id) => {
        const venue = venues.find((candidate) => candidate.id === id);
        return venue ? { ...venue, eventCount: countById.get(id) ?? 0 } : null;
      })
      .filter((row): row is NonNullable<typeof row> => row != null);
  }

  async findIdByKey(key: PersonaKey): Promise<{ id: string; slug: string } | null> {
    return this.prisma.client.persona.findUnique({
      where: { key },
      select: { id: true, slug: true },
    });
  }
}
