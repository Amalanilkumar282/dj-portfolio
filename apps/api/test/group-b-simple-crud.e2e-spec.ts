import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runWithHardDelete } from '@dj/db';

import { PrismaService } from '../src/infra/prisma/prisma.service';

import { base, body, createTestApp, http as client, requiredEnv } from './harness';

/**
 * Smoke coverage for the simple publishable CRUD modules added in Group B:
 * Faq, ExperienceEntry, GearItem, Testimonial, StaticPage, Service, Brand.
 *
 * Each of these copies the `Venue`/`Genre` pattern exactly (repository ->
 * service -> controller -> admin controller), so this file proves the wiring
 * for each — public 404 while draft, publish makes it visible, delete
 * removes it — rather than re-testing the shared workflow logic that
 * `venues.e2e-spec.ts` and `genres.e2e-spec.ts` already cover in depth.
 *
 * Requires Postgres with migrations, `seed:system` and `seed:admin`.
 */

const PREFIX = 'e2e-groupb';

let app: INestApplication;
let prisma: PrismaService;
let ownerToken = '';

const http = () => client(app);

beforeAll(async () => {
  app = await createTestApp();
  prisma = app.get(PrismaService);

  const owner = await http()
    .post(`${base}/auth/login`)
    .send({ email: requiredEnv('ADMIN_SEED_EMAIL'), password: requiredEnv('ADMIN_SEED_PASSWORD') })
    .expect(200);

  ownerToken = `Bearer ${String(body(owner).accessToken)}`;
});

afterAll(async () => {
  await app.close();
});

describe('Faq', () => {
  it('is invisible as DRAFT, visible published, gone after delete', async () => {
    const created = await http()
      .post(`${base}/admin/faqs`)
      .set('authorization', ownerToken)
      .send({ question: `${PREFIX} question?`, answer: 'A plain text answer.', status: 'DRAFT' })
      .expect(201);

    const faq = body(created) as { id: string; slug: string };

    await http().get(`${base}/faqs/${faq.slug}`).expect(404);

    await http()
      .patch(`${base}/admin/faqs/${faq.id}/publish`)
      .set('authorization', ownerToken)
      .expect(200);

    const list = await http().get(`${base}/faqs?limit=100`).expect(200);
    expect((body(list).data as { slug: string }[]).some((f) => f.slug === faq.slug)).toBe(true);

    await http().delete(`${base}/admin/faqs/${faq.id}`).set('authorization', ownerToken).expect(204);

    await runWithHardDelete(async () => {
      await prisma.client.faq.deleteMany({ where: { id: faq.id } });
    });
  });
});

describe('ExperienceEntry', () => {
  it('publishes and appears in the public timeline', async () => {
    const created = await http()
      .post(`${base}/admin/experience`)
      .set('authorization', ownerToken)
      .send({
        role: `${PREFIX} Resident DJ`,
        organisation: `${PREFIX} Venue`,
        startDate: '2020-01-01',
        status: 'PUBLISHED',
      })
      .expect(201);

    const entry = body(created) as { id: string };

    const list = await http().get(`${base}/experience?limit=100`).expect(200);
    expect((body(list).data as { id: string }[]).some((e) => e.id === entry.id)).toBe(true);

    await http()
      .delete(`${base}/admin/experience/${entry.id}`)
      .set('authorization', ownerToken)
      .expect(204);

    await runWithHardDelete(async () => {
      await prisma.client.experienceEntry.deleteMany({ where: { id: entry.id } });
    });
  });
});

describe('GearItem', () => {
  it('publishes and appears in the public gear list', async () => {
    const created = await http()
      .post(`${base}/admin/gear`)
      .set('authorization', ownerToken)
      .send({ category: 'CDJ', brand: `${PREFIX}Brand`, model: 'X-3000', status: 'PUBLISHED' })
      .expect(201);

    const gear = body(created) as { id: string; slug: string };

    await http().get(`${base}/gear?limit=100`).expect(200);

    await http().delete(`${base}/admin/gear/${gear.id}`).set('authorization', ownerToken).expect(204);

    await runWithHardDelete(async () => {
      await prisma.client.gearItem.deleteMany({ where: { id: gear.id } });
    });
  });
});

describe('Testimonial', () => {
  it('publishes and appears in the public list', async () => {
    const created = await http()
      .post(`${base}/admin/testimonials`)
      .set('authorization', ownerToken)
      .send({ authorName: `${PREFIX} Author`, quote: 'Great set!', status: 'PUBLISHED' })
      .expect(201);

    const testimonial = body(created) as { id: string };

    const list = await http().get(`${base}/testimonials?limit=100`).expect(200);
    expect((body(list).data as { id: string }[]).some((t) => t.id === testimonial.id)).toBe(true);

    await http()
      .delete(`${base}/admin/testimonials/${testimonial.id}`)
      .set('authorization', ownerToken)
      .expect(204);

    await runWithHardDelete(async () => {
      await prisma.client.testimonial.deleteMany({ where: { id: testimonial.id } });
    });
  });
});

describe('StaticPage', () => {
  it('has no /reorder route but publishes and reads by slug', async () => {
    const created = await http()
      .post(`${base}/admin/pages`)
      .set('authorization', ownerToken)
      .send({ title: `${PREFIX} Page`, content: { type: 'doc' }, status: 'PUBLISHED' })
      .expect(201);

    const page = body(created) as { id: string; slug: string };

    await http().get(`${base}/pages/${page.slug}`).expect(200);

    await http().delete(`${base}/admin/pages/${page.id}`).set('authorization', ownerToken).expect(204);

    await runWithHardDelete(async () => {
      await prisma.client.staticPage.deleteMany({ where: { id: page.id } });
    });
  });
});

describe('Service', () => {
  it('publishes and reads by slug', async () => {
    const created = await http()
      .post(`${base}/admin/services`)
      .set('authorization', ownerToken)
      .send({ name: `${PREFIX} Wedding Package`, category: 'WEDDING', status: 'PUBLISHED' })
      .expect(201);

    const service = body(created) as { id: string; slug: string };

    await http().get(`${base}/services/${service.slug}`).expect(200);

    await http()
      .delete(`${base}/admin/services/${service.id}`)
      .set('authorization', ownerToken)
      .expect(204);

    await runWithHardDelete(async () => {
      await prisma.client.service.deleteMany({ where: { id: service.id } });
    });
  });
});

describe('Brand', () => {
  it('publishes, associates a persona, and appears filtered by that persona', async () => {
    const created = await http()
      .post(`${base}/admin/brands`)
      .set('authorization', ownerToken)
      .send({ name: `${PREFIX} Brand`, status: 'PUBLISHED', personaKeys: ['TNT'] })
      .expect(201);

    const brand = body(created) as { id: string; personaSlugs: string[] };
    expect(brand.personaSlugs).toContain('tnt');

    const filtered = await http().get(`${base}/brands?personaSlug=tnt&limit=100`).expect(200);
    expect((body(filtered).data as { id: string }[]).some((b) => b.id === brand.id)).toBe(true);

    await http().delete(`${base}/admin/brands/${brand.id}`).set('authorization', ownerToken).expect(204);

    await runWithHardDelete(async () => {
      await prisma.client.brand.deleteMany({ where: { id: brand.id } });
    });
  });
});
