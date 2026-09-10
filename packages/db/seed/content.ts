import { ContentStatus, type PersonaKey } from '@prisma/client';

import { slugify } from '@dj/utils';

import type { ExtendedPrismaClient } from '../src/client.js';

import { seedPersonas } from './data/personas.js';
import { seedFaqs, seedGear, seedServices } from './data/site.js';
import { seedTestimonials } from './data/testimonials.js';
import { seedPlaylists, seedTracks, soundcloudEmbedUrl } from './data/tracks.js';
import { seedPersonaVenues, seedPrograms, seedVenues } from './data/venues.js';
import type { SeedLogger } from './logger.js';

/**
 * Content seed — the data harvested from the legacy static site.
 *
 * Development and preview only. Production gets structural data from
 * `seed:system` and real content through the admin panel; loading harvested
 * dev copy into production would overwrite whatever the DJ has published.
 *
 * Everything here is PUBLISHED so that local development exercises the
 * public read paths (which filter on status) rather than only the admin ones.
 *
 * Media is not attached: images live in Cloudinary and are uploaded by
 * `seed/media.ts` in Phase 5, which records publicIds. Until then the seeded
 * content is text-complete and image-free, which is the correct state for
 * testing the API and the fallback rendering.
 *
 * See docs/07-content/legacy-audit.md
 */
export async function seedContent(prisma: ExtendedPrismaClient, log: SeedLogger): Promise<void> {
  log.section('content');

  const publishedAt = new Date('2026-01-01T00:00:00.000Z');
  const live = { status: ContentStatus.PUBLISHED, publishedAt };

  // --- personas: fill in the content the system seed left blank -----------
  const personaIdByKey = new Map<PersonaKey, string>();

  for (const [index, p] of seedPersonas.entries()) {
    const persona = await prisma.persona.update({
      where: { key: p.key },
      data: {
        ...live,
        slug: p.slug,
        stageName: p.stageName,
        subtitle: p.subtitle,
        shortDescription: p.shortDescription,
        bio: p.bio,
        primaryGenreLabel: p.primaryGenreLabel,
        accentColor: p.accentColor,
        accentColorSecondary: p.accentColorSecondary,
        gradientCss: p.gradientCss,
        isFeatured: p.isFeatured,
        isDuo: p.isDuo,
        memberNames: p.memberNames,
        bpmRangeLow: p.bpmRangeLow,
        bpmRangeHigh: p.bpmRangeHigh,
        yearsActiveFrom: p.yearsActiveFrom,
        sortIndex: index,
        seoMeta: {
          upsert: {
            create: { title: p.seo.title, description: p.seo.description },
            update: { title: p.seo.title, description: p.seo.description },
          },
        },
      },
    });

    personaIdByKey.set(p.key, persona.id);

    // Genre relations, against the vocabulary the system seed created.
    const genres = await prisma.genre.findMany({
      where: { slug: { in: p.genres.map((g) => slugify(g)) } },
      select: { id: true },
    });
    await prisma.personaGenre.deleteMany({ where: { personaId: persona.id } });
    await prisma.personaGenre.createMany({
      data: genres.map((g, i) => ({
        personaId: persona.id,
        genreId: g.id,
        isPrimary: i === 0,
        sortIndex: i,
      })),
      skipDuplicates: true,
    });

    for (const [i, social] of p.socials.entries()) {
      await prisma.socialLink.upsert({
        where: { personaId_platform: { personaId: persona.id, platform: social.platform } },
        create: {
          personaId: persona.id,
          platform: social.platform,
          url: social.url,
          handle: social.handle ?? null,
          isPrimary: i === 0,
          sortIndex: i,
        },
        update: { url: social.url, handle: social.handle ?? null },
      });
    }
  }
  log.step(`personas: ${String(seedPersonas.length)} with genres, socials and SEO`);

  // --- venues -------------------------------------------------------------
  const venueIdBySlug = new Map<string, string>();
  for (const [index, v] of seedVenues.entries()) {
    const venue = await prisma.venue.upsert({
      where: { slug: v.slug },
      create: { ...v, ...live, sortIndex: index },
      update: { ...v, ...live },
    });
    venueIdBySlug.set(v.slug, venue.id);
  }
  log.step(`venues: ${String(seedVenues.length)}`);

  // --- programs (branded nights) ------------------------------------------
  for (const [index, p] of seedPrograms.entries()) {
    await prisma.program.upsert({
      where: { slug: p.slug },
      create: {
        ...live,
        slug: p.slug,
        name: p.name,
        subtitle: p.subtitle,
        description: p.description,
        cadence: p.cadence,
        isOngoing: p.isOngoing,
        personaId: personaIdByKey.get(p.personaKey) ?? null,
        venueId: venueIdBySlug.get(p.venueSlug) ?? null,
        sortIndex: index,
      },
      update: {
        ...live,
        name: p.name,
        subtitle: p.subtitle,
        description: p.description,
        cadence: p.cadence,
        isOngoing: p.isOngoing,
      },
    });
  }
  log.step(`programs: ${String(seedPrograms.length)}`);

  // NOTE: no Event rows are seeded here. The legacy data carried no dates,
  // and inventing them would put false claims on a live page. `seed:demo`
  // generates explicitly synthetic events for local development.
  const playedCount = Object.values(seedPersonaVenues).flat().length;
  log.warn(
    `no events seeded: legacy gig data had no dates (${String(playedCount)} persona-venue pairs recorded on venues instead)`,
  );

  // --- tracks -------------------------------------------------------------
  const trackIdBySlug = new Map<string, string>();
  for (const [index, t] of seedTracks.entries()) {
    const track = await prisma.track.upsert({
      where: { slug: t.slug },
      create: {
        ...live,
        slug: t.slug,
        title: t.title,
        artistLabel: t.artistLabel,
        personaId: personaIdByKey.get(t.personaKey) ?? null,
        type: t.type,
        description: t.description,
        bpm: t.bpm,
        durationSec: t.durationSec,
        releaseDate: new Date(Date.UTC(t.releaseYear, 0, 1)),
        isFeatured: t.isFeatured,
        soundcloudTrackId: t.soundcloudTrackId,
        embedUrl: soundcloudEmbedUrl(t.soundcloudTrackId),
        tags: t.tags,
        playCount: t.playCount,
        likeCount: t.likeCount,
        sortIndex: index,
        streamLinks: {
          create: [{ platform: 'SOUNDCLOUD', url: t.soundcloudUrl, sortIndex: 0 }],
        },
      },
      update: {
        ...live,
        title: t.title,
        description: t.description,
        bpm: t.bpm,
        durationSec: t.durationSec,
        isFeatured: t.isFeatured,
        tags: t.tags,
      },
    });

    trackIdBySlug.set(t.slug, track.id);

    const genres = await prisma.genre.findMany({
      where: { slug: { in: t.genreLabels.map((g) => slugify(g)) } },
      select: { id: true },
    });
    await prisma.trackGenre.createMany({
      data: genres.map((g) => ({ trackId: track.id, genreId: g.id })),
      skipDuplicates: true,
    });
  }
  log.step(`tracks: ${String(seedTracks.length)} with SoundCloud embeds and genres`);

  // --- playlists ----------------------------------------------------------
  for (const [index, p] of seedPlaylists.entries()) {
    const trackIds = p.trackSlugs
      .map((slug) => trackIdBySlug.get(slug))
      .filter((id): id is string => id != null);

    if (trackIds.length !== p.trackSlugs.length) {
      log.warn(
        `playlist ${p.slug}: ${String(p.trackSlugs.length - trackIds.length)} track(s) missing`,
      );
    }

    const durations = await prisma.track.findMany({
      where: { id: { in: trackIds } },
      select: { durationSec: true },
    });
    const totalDurationSec = durations.reduce((sum, t) => sum + (t.durationSec ?? 0), 0);

    const playlist = await prisma.playlist.upsert({
      where: { slug: p.slug },
      create: {
        ...live,
        slug: p.slug,
        title: p.title,
        description: p.description,
        personaId: personaIdByKey.get(p.personaKey) ?? null,
        isFeatured: p.isFeatured,
        totalDurationSec,
        sortIndex: index,
      },
      update: { ...live, title: p.title, description: p.description, totalDurationSec },
    });

    await prisma.playlistTrack.deleteMany({ where: { playlistId: playlist.id } });
    await prisma.playlistTrack.createMany({
      // Fractional indices spaced by 1000, so a later drag-and-drop can
      // insert between two rows without renumbering the list.
      data: trackIds.map((trackId, i) => ({
        playlistId: playlist.id,
        trackId,
        sortIndex: (i + 1) * 1000,
      })),
      skipDuplicates: true,
    });
  }
  log.step(`playlists: ${String(seedPlaylists.length)}`);

  // --- testimonials -------------------------------------------------------
  for (const [index, t] of seedTestimonials.entries()) {
    const personaId = personaIdByKey.get(t.personaKey) ?? null;
    const existing = await prisma.testimonial.findFirst({
      where: { authorName: t.authorName, personaId },
      select: { id: true },
    });

    const data = {
      ...live,
      authorName: t.authorName,
      venueOrEvent: t.venueOrEvent,
      quote: t.quote,
      personaId,
      // Unverified until the DJ confirms each one, which gates Review JSON-LD.
      isVerified: false,
      sortIndex: index,
    };

    if (existing) {
      await prisma.testimonial.update({ where: { id: existing.id }, data });
    } else {
      await prisma.testimonial.create({ data });
    }
  }
  log.step(`testimonials: ${String(seedTestimonials.length)} (all isVerified=false)`);

  // --- services -----------------------------------------------------------
  for (const [index, s] of seedServices.entries()) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      create: { ...s, ...live, sortIndex: index },
      update: { ...s, ...live },
    });
  }
  log.step(`services: ${String(seedServices.length)} (prices null = "On request")`);

  // --- faqs ---------------------------------------------------------------
  for (const [index, f] of seedFaqs.entries()) {
    await prisma.faq.upsert({
      where: { slug: f.slug },
      create: { ...f, ...live, sortIndex: index },
      update: { ...f, ...live },
    });
  }
  log.step(`faqs: ${String(seedFaqs.length)}`);

  // --- gear ---------------------------------------------------------------
  for (const [index, g] of seedGear.entries()) {
    await prisma.gearItem.upsert({
      where: { slug: g.slug },
      create: { ...g, ...live, sortIndex: index },
      update: { ...g, ...live },
    });
  }
  log.step(
    `gear: ${String(seedGear.length)} (${String(seedGear.filter((g) => g.isRiderItem).length)} on the rider)`,
  );
}
