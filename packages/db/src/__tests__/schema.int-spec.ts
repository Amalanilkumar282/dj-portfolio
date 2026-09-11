import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integration tests for everything the raw-SQL migration adds.
 *
 * `prisma migrate diff` cannot see these objects, so without these assertions
 * a future `migrate reset` that silently skipped the second migration would
 * leave the partial indexes and CHECK constraints missing and nothing would
 * notice until production got slow or accepted bad data.
 *
 * Uses a plain PrismaClient rather than the extended one: these tests are
 * about the physical schema, not application behaviour.
 */

let prisma: PrismaClient;

beforeAll(() => {
  prisma = new PrismaClient();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function indexExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint AS count
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = ${name}
  `;
  return (rows[0]?.count ?? 0n) > 0n;
}

async function constraintExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint AS count
    FROM pg_constraint
    WHERE conname = ${name}
  `;
  return (rows[0]?.count ?? 0n) > 0n;
}

describe('extensions', () => {
  it('has pg_trgm installed', async () => {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count FROM pg_extension WHERE extname = 'pg_trgm'
    `;
    expect((rows[0]?.count ?? 0n) > 0n).toBe(true);
  });
});

describe('trigram indexes', () => {
  // Prisma-generated names: these indexes are declared in schema.prisma via
  // `@@index([title(ops: raw("gin_trgm_ops"))], type: Gin)`, so they live in
  // the init migration and are covered by the migrate:check drift gate.
  const cases: [table: string, index: string][] = [
    ['events', 'events_title_idx'],
    ['tracks', 'tracks_title_idx'],
    ['playlists', 'playlists_title_idx'],
    ['posts', 'posts_title_idx'],
    ['venues', 'venues_name_idx'],
    ['booking_inquiries', 'booking_inquiries_name_idx'],
  ];

  it.each(cases)('%s has a GIN trigram index (%s)', async (_table, index) => {
    const rows = await prisma.$queryRaw<{ def: string }[]>`
      SELECT indexdef AS def FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = ${index}
    `;

    // Existence alone is not the guarantee that matters: an index of the
    // right name but the wrong method would not serve substring search.
    expect(rows[0]?.def, `${index} missing`).toBeDefined();
    expect(rows[0]?.def).toContain('USING gin');
    expect(rows[0]?.def).toContain('gin_trgm_ops');
  });

  it('serves a substring match through the trigram index', async () => {
    // The functional guarantee: `?q=` filters find mid-word matches, which
    // full-text search would miss (Bolly -> Bolly-Tech).
    const rows = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM venues WHERE name ILIKE '%itcher%' AND "deletedAt" IS NULL
    `;
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('partial indexes for published content', () => {
  const names = [
    'events_published_upcoming',
    'events_published_past',
    'tracks_published_ordered',
    'tracks_published_featured',
    'playlists_published_ordered',
    'personas_published_ordered',
    'posts_published_recent',
    'testimonials_published_featured',
    'personas_scheduled',
    'tracks_scheduled',
    'events_scheduled',
    'posts_scheduled',
    'media_assets_pending_purge',
    'booking_inquiries_pending_notify',
  ];

  it.each(names)('%s exists', async (name) => {
    expect(await indexExists(name)).toBe(true);
  });

  it('events_published_upcoming is genuinely partial', async () => {
    // A partial index that lost its predicate would still exist under the
    // right name while indexing the whole table, so assert the predicate.
    const rows = await prisma.$queryRaw<{ def: string }[]>`
      SELECT indexdef AS def FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'events_published_upcoming'
    `;
    expect(rows[0]?.def).toContain('WHERE');
    expect(rows[0]?.def).toContain('PUBLISHED');
  });
});

describe('full-text search on posts', () => {
  it('has a generated searchVector column', async () => {
    const rows = await prisma.$queryRaw<{ generated: string; type: string }[]>`
      SELECT is_generated AS generated, data_type AS type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'searchVector'
    `;
    expect(rows[0]?.type).toBe('tsvector');
    expect(rows[0]?.generated).toBe('ALWAYS');
  });

  it('has a GIN index on searchVector', async () => {
    expect(await indexExists('posts_search_idx')).toBe(true);
  });

  it('populates and weights the vector from title, excerpt and body', async () => {
    const slug = `fts-${Date.now().toString(36)}`;
    await prisma.post.create({
      data: {
        slug,
        title: 'Sangeet Playlist Guide',
        excerpt: 'Choosing music for a wedding sangeet.',
        contentText: 'Bengaluru weddings and the running order that works.',
        content: {},
      },
    });

    const rows = await prisma.$queryRaw<{ vector: string }[]>`
      SELECT "searchVector"::text AS vector FROM posts WHERE slug = ${slug}
    `;

    // 'A' weight on the title term, 'C' on a body-only term.
    expect(rows[0]?.vector).toMatch(/sangeet.*A/);
    expect(rows[0]?.vector).toContain('bengaluru');

    await prisma.post.delete({ where: { slug } });
  });
});

describe('check constraints', () => {
  const names = [
    'site_settings_singleton',
    'testimonials_rating_range',
    'services_price_band',
    'booking_inquiries_budget_band',
    'events_ticket_price_band',
    'events_time_order',
    'experience_entries_date_order',
    // Every publishable model gets this constraint, not only the original 4
    // (personas, tracks, events, posts). Venue was found missing it entirely
    // while building the Venues content module — see ADR 0019. Listed for
    // all 18 so a model added later without it fails here immediately,
    // rather than silently allowing a PUBLISHED row with no publishedAt.
    'personas_published_has_date',
    'tracks_published_has_date',
    'playlists_published_has_date',
    'releases_published_has_date',
    'venues_published_has_date',
    'events_published_has_date',
    'programs_published_has_date',
    'galleries_published_has_date',
    'videos_published_has_date',
    'testimonials_published_has_date',
    'brands_published_has_date',
    'experience_entries_published_has_date',
    'gear_items_published_has_date',
    'services_published_has_date',
    'faqs_published_has_date',
    'press_assets_published_has_date',
    'posts_published_has_date',
    'static_pages_published_has_date',
    'media_assets_image_alt_text',
  ];

  it.each(names)('%s exists', async (name) => {
    expect(await constraintExists(name)).toBe(true);
  });

  it('rejects a second site_settings row', async () => {
    await expect(prisma.siteSettings.create({ data: { id: 'second' } })).rejects.toThrow();
  });

  it('rejects an out-of-range testimonial rating', async () => {
    await expect(
      prisma.testimonial.create({
        data: { authorName: 'Range Test', quote: 'Out of range.', rating: 9 },
      }),
    ).rejects.toThrow();
  });

  it('rejects a PUBLISHED venue with no publishedAt', async () => {
    // Venue had no `published_has_date` constraint at all until this was
    // found while building the Venues module — every other publishable model
    // had it. Behavioural, not just existence: the constraint list above
    // only proves the object exists, not that it actually rejects anything.
    await expect(
      prisma.venue.create({
        data: {
          slug: `unpublished-${Date.now().toString(36)}`,
          name: 'Constraint Test Venue',
          city: 'Bengaluru',
          status: 'PUBLISHED',
          publishedAt: null,
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects an inverted service price band', async () => {
    await expect(
      prisma.service.create({
        data: {
          slug: `inverted-${Date.now().toString(36)}`,
          name: 'Inverted',
          category: 'WEDDING',
          priceFrom: 90000,
          priceTo: 10000,
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects an event ending before it starts', async () => {
    await expect(
      prisma.event.create({
        data: {
          slug: `backwards-${Date.now().toString(36)}`,
          title: 'Backwards',
          startsAt: new Date('2026-06-01T18:00:00Z'),
          endsAt: new Date('2026-06-01T12:00:00Z'),
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects PUBLISHED content with no publishedAt', async () => {
    // Without this, sitemap lastmod and Article/Event JSON-LD dates could be
    // null on a live page.
    await expect(
      prisma.track.create({
        data: {
          slug: `nodate-${Date.now().toString(36)}`,
          title: 'No Publish Date',
          artistLabel: 'Test',
          status: 'PUBLISHED',
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects a published gallery image with no alt text', async () => {
    await expect(
      prisma.mediaAsset.create({
        data: {
          publicId: `noalt-${Date.now().toString(36)}`,
          resourceType: 'IMAGE',
          purpose: 'GALLERY',
          format: 'jpg',
          bytes: 1024,
          secureUrl: 'https://res.cloudinary.com/x/noalt.jpg',
          folder: 'djf/test',
        },
      }),
    ).rejects.toThrow();
  });

  it('allows an OG image with no alt text', async () => {
    // OG images are never rendered in-page, so alt text is meaningless there.
    const publicId = `og-${Date.now().toString(36)}`;
    const asset = await prisma.mediaAsset.create({
      data: {
        publicId,
        resourceType: 'IMAGE',
        purpose: 'OG_IMAGE',
        format: 'jpg',
        bytes: 2048,
        secureUrl: `https://res.cloudinary.com/x/${publicId}.jpg`,
        folder: 'djf/test',
      },
    });

    expect(asset.altText).toBeNull();
    await prisma.mediaAsset.delete({ where: { id: asset.id } });
  });
});

describe('unique constraints', () => {
  it('rejects a duplicate venue in the same city', async () => {
    const name = `Dup Venue ${Date.now().toString(36)}`;
    // DRAFT: Venue defaults to PUBLISHED, and this test is about the
    // @@unique([name, city]) constraint, not the publish workflow. A bare
    // default would now fail `venues_published_has_date` (see ADR 0019).
    const first = await prisma.venue.create({
      data: { slug: `dup-a-${Date.now().toString(36)}`, name, city: 'Bengaluru', status: 'DRAFT' },
    });

    await expect(
      prisma.venue.create({
        data: {
          slug: `dup-b-${Date.now().toString(36)}`,
          name,
          city: 'Bengaluru',
          status: 'DRAFT',
        },
      }),
    ).rejects.toThrow();

    // The same venue name in a different city is legitimate.
    const other = await prisma.venue.create({
      data: { slug: `dup-c-${Date.now().toString(36)}`, name, city: 'Chennai', status: 'DRAFT' },
    });

    await prisma.venue.delete({ where: { id: first.id } });
    await prisma.venue.delete({ where: { id: other.id } });
  });
});

describe('seeded data', () => {
  it('has the four personas keyed by PersonaKey', async () => {
    const personas = await prisma.persona.findMany({
      where: { deletedAt: null },
      select: { key: true, slug: true, accentColor: true },
      orderBy: { sortIndex: 'asc' },
    });

    expect(personas.map((p) => p.key)).toEqual([
      'COUPLE_DUO',
      'FELICITOUS',
      'TRINITROCOSMIC',
      'TNT',
    ]);
    // Every persona must carry a real accent: the legacy `neon-pink` tokens
    // resolved to nothing.
    for (const p of personas) {
      expect(p.accentColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('has the three system roles with permissions granted', async () => {
    const roles = await prisma.role.findMany({
      where: { isSystem: true },
      include: { _count: { select: { permissions: true } } },
    });

    expect(roles.map((r) => r.key).sort()).toEqual(['EDITOR', 'SUPER_ADMIN', 'VIEWER']);
    for (const role of roles) {
      expect(role._count.permissions).toBeGreaterThan(0);
    }
  });

  it('grants SUPER_ADMIN every permission', async () => {
    const total = await prisma.permission.count();
    const owner = await prisma.role.findUniqueOrThrow({
      where: { key: 'SUPER_ADMIN' },
      include: { _count: { select: { permissions: true } } },
    });

    expect(owner._count.permissions).toBe(total);
  });

  it('does not grant EDITOR access to users, roles or settings', async () => {
    const editor = await prisma.role.findUniqueOrThrow({
      where: { key: 'EDITOR' },
      include: { permissions: { include: { permission: true } } },
    });

    const resources = new Set(editor.permissions.map((p) => p.permission.resource));
    expect(resources.has('user')).toBe(false);
    expect(resources.has('role')).toBe(false);
    expect(resources.has('settings')).toBe(false);
  });

  it('seeds every legacy route as a redirect', async () => {
    const legacy = ['/bollywood', '/psytrance', '/techno', '/couple-duo', '/discography'];
    const rows = await prisma.redirect.findMany({
      where: { fromPath: { in: legacy } },
      select: { fromPath: true, toPath: true, kind: true },
    });

    expect(rows).toHaveLength(legacy.length);
    for (const row of rows) {
      expect(row.kind).toBe('PERMANENT');
      expect(row.toPath).not.toBe(row.fromPath);
    }
  });

  it('seeds no testimonial as verified', async () => {
    // Review / AggregateRating JSON-LD is gated on isVerified, so a seed that
    // marked these true would emit unverified review markup.
    const verified = await prisma.testimonial.count({ where: { isVerified: true } });
    expect(verified).toBe(0);
  });

  it('seeds no fabricated festival or club testimonials', async () => {
    // The legacy site attributed invented quotes to venues the artist has
    // never played. This asserts they did not come across.
    const fabricated = await prisma.testimonial.count({
      where: {
        OR: [
          { venueOrEvent: { contains: 'Berghain', mode: 'insensitive' } },
          { venueOrEvent: { contains: 'Boom Festival', mode: 'insensitive' } },
          { venueOrEvent: { contains: 'Ozora', mode: 'insensitive' } },
          { venueOrEvent: { contains: 'Fabric', mode: 'insensitive' } },
          { venueOrEvent: { contains: 'Tresor', mode: 'insensitive' } },
          { venueOrEvent: { contains: 'Rainbow Serpent', mode: 'insensitive' } },
        ],
      },
    });
    expect(fabricated).toBe(0);
  });

  it('seeds tracks with real SoundCloud ids and no broken artwork paths', async () => {
    const tracks = await prisma.track.findMany({
      where: { deletedAt: null },
      select: { soundcloudTrackId: true, artworkId: true, embedUrl: true },
    });

    expect(tracks.length).toBeGreaterThanOrEqual(19);
    for (const track of tracks) {
      expect(track.soundcloudTrackId).toMatch(/^\d+$/);
      // The legacy albumArt paths all pointed at a directory that never
      // existed; artwork is attached in admin instead.
      expect(track.artworkId).toBeNull();
      expect(track.embedUrl).toContain('w.soundcloud.com');
    }
  });

  it('seeds playlists that reference real tracks in order', async () => {
    const playlists = await prisma.playlist.findMany({
      include: { tracks: { orderBy: { sortIndex: 'asc' }, include: { track: true } } },
    });

    expect(playlists.length).toBeGreaterThan(0);
    for (const playlist of playlists) {
      expect(playlist.tracks.length).toBeGreaterThan(0);
      const indices = playlist.tracks.map((t) => t.sortIndex);
      expect([...indices].sort((a, b) => a - b)).toEqual(indices);
    }
  });

  it('seeds gear that feeds the technical rider', async () => {
    const riderItems = await prisma.gearItem.count({
      where: { isRiderItem: true, deletedAt: null },
    });
    expect(riderItems).toBeGreaterThan(0);
  });

  it('seeds services with null prices rather than invented ones', async () => {
    const withPrices = await prisma.service.count({
      where: { OR: [{ priceFrom: { not: null } }, { priceTo: { not: null } }] },
    });
    expect(withPrices).toBe(0);
  });
});
