import { faker } from '@faker-js/faker';
import {
  ContentStatus,
  Currency,
  EventKind,
  EventStatus,
  InquirySource,
  InquiryStatus,
} from '@prisma/client';

import { slugify } from '@dj/utils';

import type { ExtendedPrismaClient } from '../src/client.js';

import type { SeedLogger } from './logger.js';

/**
 * Demo seed — explicitly synthetic volume data for local development.
 *
 * Development only. Never runs in preview or production.
 *
 * Everything generated here is fake and must read as fake: event titles are
 * built from a synthetic-night vocabulary, and inquiry names come from faker.
 * That distinction matters — the content seed carries real harvested copy,
 * this one carries invented filler, and the two must never be confused when
 * someone is deciding what is safe to publish.
 *
 * The generator is seeded with a fixed value so screenshots, visual
 * regression baselines and e2e assertions stay stable across runs.
 */
const FAKER_SEED = 20260910;

/** Reads unmistakably as placeholder copy in any screenshot. */
const DEMO_PREFIX = '[DEMO]';

export async function seedDemo(prisma: ExtendedPrismaClient, log: SeedLogger): Promise<void> {
  log.section('demo (synthetic)');
  faker.seed(FAKER_SEED);

  const personas = await prisma.persona.findMany({ select: { id: true, key: true } });
  const venues = await prisma.venue.findMany({ select: { id: true, city: true } });
  const programs = await prisma.program.findMany({ select: { id: true } });

  if (personas.length === 0 || venues.length === 0) {
    log.warn('no personas or venues found — run the content seed first. Skipping demo.');
    return;
  }

  const now = new Date('2026-09-10T00:00:00.000Z');

  // --- events -------------------------------------------------------------
  // Spread across three years so the past archive, the year grouping and the
  // upcoming list all have something to render.
  const EVENT_COUNT = 60;
  let eventsCreated = 0;

  for (let i = 0; i < EVENT_COUNT; i += 1) {
    const startsAt = faker.date.between({
      from: new Date('2023-09-01T00:00:00.000Z'),
      to: new Date('2027-03-01T00:00:00.000Z'),
    });
    // Club sets run late; a 4-hour slot starting at 22:00 is typical.
    startsAt.setUTCHours(faker.number.int({ min: 16, max: 21 }), 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + faker.number.int({ min: 2, max: 5 }) * 3600_000);

    const isPast = startsAt < now;
    const persona = faker.helpers.arrayElement(personas);
    const venue = faker.helpers.arrayElement(venues);
    const kind = faker.helpers.arrayElement([
      EventKind.CLUB,
      EventKind.CLUB,
      EventKind.CLUB,
      EventKind.WEDDING,
      EventKind.CORPORATE,
      EventKind.FESTIVAL,
      EventKind.PRIVATE,
    ]);

    const title = `${DEMO_PREFIX} ${faker.helpers.arrayElement([
      'Night Shift',
      'Afterglow',
      'Basslines',
      'Frequency',
      'Midnight Circuit',
      'Sundown Session',
      'Voltage',
      'Reverb Room',
    ])} Vol. ${String(i + 1)}`;

    const slug = slugify(`demo ${title} ${String(startsAt.getUTCFullYear())} ${String(i)}`);

    await prisma.event.upsert({
      where: { slug },
      create: {
        slug,
        title,
        kind,
        eventStatus: isPast ? EventStatus.COMPLETED : EventStatus.ANNOUNCED,
        description: faker.lorem.paragraph(),
        personaId: persona.id,
        venueId: venue.id,
        programId:
          kind === EventKind.CLUB && programs.length > 0
            ? faker.helpers.arrayElement(programs).id
            : null,
        startsAt,
        endsAt,
        isPast,
        isFree: kind === EventKind.CLUB ? faker.datatype.boolean() : false,
        ticketPriceMin: kind === EventKind.CLUB ? 500 : null,
        ticketPriceMax: kind === EventKind.CLUB ? 2000 : null,
        currency: Currency.INR,
        ageRestriction: kind === EventKind.CLUB ? '21+' : null,
        attendanceEstimate: faker.number.int({ min: 80, max: 1200 }),
        isFeatured: i < 3,
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(startsAt.getTime() - 30 * 86400_000),
        sortIndex: i,
      },
      update: {},
    });
    eventsCreated += 1;
  }
  log.step(`events: ${String(eventsCreated)} across 2023-2027`);

  // --- booking inquiries --------------------------------------------------
  // Spread across the pipeline so the admin Kanban has something in every
  // column and the funnel metrics are non-trivial.
  const INQUIRY_COUNT = 40;
  const statuses = [
    InquiryStatus.NEW,
    InquiryStatus.NEW,
    InquiryStatus.CONTACTED,
    InquiryStatus.QUOTED,
    InquiryStatus.NEGOTIATING,
    InquiryStatus.BOOKED,
    InquiryStatus.BOOKED,
    InquiryStatus.LOST,
    InquiryStatus.SPAM,
  ];

  for (let i = 0; i < INQUIRY_COUNT; i += 1) {
    const createdAt = faker.date.between({
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: now,
    });
    const status = faker.helpers.arrayElement(statuses);
    const budgetMin = faker.helpers.arrayElement([15000, 25000, 40000, 60000, 100000]);

    await prisma.bookingInquiry.upsert({
      // Reference is the natural key, so a re-run updates rather than piles up.
      where: { reference: `INQ-2026-D${String(i).padStart(3, '0')}` },
      create: {
        reference: `INQ-2026-D${String(i).padStart(3, '0')}`,
        name: `${DEMO_PREFIX} ${faker.person.fullName()}`,
        email: faker.internet.email().toLowerCase(),
        phone: `+9198${faker.string.numeric(8)}`,
        eventType: faker.helpers.arrayElement([
          EventKind.WEDDING,
          EventKind.WEDDING,
          EventKind.CORPORATE,
          EventKind.PRIVATE,
          EventKind.CLUB,
        ]),
        eventDate: faker.date.between({ from: now, to: new Date('2027-06-01T00:00:00.000Z') }),
        city: faker.helpers.arrayElement(['Bengaluru', 'Chennai', 'Goa', 'Hyderabad', 'Mumbai']),
        guestCount: faker.number.int({ min: 50, max: 800 }),
        durationHours: faker.helpers.arrayElement([3, 4, 5, 6]),
        budgetMin,
        budgetMax: budgetMin * 2,
        currency: Currency.INR,
        personaId: faker.helpers.arrayElement(personas).id,
        message: faker.lorem.sentences(2),
        status,
        source: faker.helpers.arrayElement([
          InquirySource.WEBSITE_FORM,
          InquirySource.WEBSITE_FORM,
          InquirySource.INSTAGRAM,
          InquirySource.REFERRAL,
        ]),
        spamScore: status === InquiryStatus.SPAM ? faker.number.int({ min: 70, max: 100 }) : 0,
        // SPAM is never notified, which is what the retry cron's partial
        // index filters on.
        notifiedAt: status === InquiryStatus.SPAM ? null : createdAt,
        autoRespondedAt: status === InquiryStatus.SPAM ? null : createdAt,
        createdAt,
      },
      update: {},
    });
  }
  log.step(`booking inquiries: ${String(INQUIRY_COUNT)} across the pipeline`);

  // --- page views ---------------------------------------------------------
  const paths = ['/', '/felicitous', '/trinitrocosmic', '/tnt', '/music', '/events', '/book'];
  const views = Array.from({ length: 500 }, () => ({
    path: faker.helpers.arrayElement(paths),
    visitorHash: faker.string.alphanumeric(32),
    deviceType: faker.helpers.arrayElement(['mobile', 'mobile', 'mobile', 'desktop', 'tablet']),
    country: faker.helpers.arrayElement(['IN', 'IN', 'IN', 'AE', 'US', 'GB']),
    createdAt: faker.date.between({ from: new Date('2026-06-01T00:00:00.000Z'), to: now }),
  }));
  await prisma.pageView.createMany({ data: views, skipDuplicates: true });
  log.step('page views: 500');
}
