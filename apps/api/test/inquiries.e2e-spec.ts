import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/infra/prisma/prisma.service';

import { base, body, createTestApp, http as client, requiredEnv } from './harness';

/**
 * Booking inquiries — the public form, spam heuristics, and the admin
 * pipeline.
 *
 * `TURNSTILE_SECRET_KEY` and `RESEND_API_KEY` are placeholders in every
 * non-production environment (see `CloudinaryService`'s comment for the
 * established pattern), so Turnstile verification is skipped rather than
 * enforced, and mail sends are logged and skipped rather than attempted —
 * `POST /inquiries` must still succeed and return fast either way. Real
 * verification and delivery are integration gaps this suite cannot close
 * without live credentials; see STATUS.md.
 *
 * Requires Postgres with migrations, `seed:system` and `seed:admin`.
 */

const PREFIX = 'e2e-inquiries';

let app: INestApplication;
let prisma: PrismaService;
let ownerToken = '';

const http = (ip?: string) => client(app, ip);

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
  await prisma.client.bookingInquiry.deleteMany({ where: { email: { contains: PREFIX } } });
  await app.close();
});

describe('POST /inquiries', () => {
  it('creates a real row, returns a reference fast, and is visible to admin', async () => {
    const started = Date.now();

    const response = await http()
      .post(`${base}/inquiries`)
      .send({
        name: `${PREFIX} Client`,
        email: `${PREFIX}@example.test`,
        eventType: 'WEDDING',
        message: 'Looking to book for a February wedding in Bengaluru.',
        turnstileToken: 'placeholder-token',
      })
      .expect(201);

    // Generous ceiling for a CI machine; the point is "did not wait on Resend".
    expect(Date.now() - started).toBeLessThan(2000);

    const result = body(response) as { reference: string; whatsappUrl: string | null };
    expect(result.reference).toMatch(/^INQ-\d{4}-\d{4}$/);

    const row = await prisma.client.bookingInquiry.findUnique({ where: { reference: result.reference } });
    expect(row).not.toBeNull();
    expect(row?.status).toBe('NEW');

    const admin = await http()
      .get(`${base}/admin/inquiries?q=${encodeURIComponent(result.reference)}`)
      .set('authorization', ownerToken)
      .expect(200);
    expect((body(admin).data as { reference: string }[]).some((i) => i.reference === result.reference)).toBe(
      true,
    );
  });

  it('routes an honeypot hit to SPAM without a 422', async () => {
    const response = await http()
      .post(`${base}/inquiries`)
      .send({
        name: `${PREFIX} Bot`,
        email: `${PREFIX}-bot@example.test`,
        website: 'http://spam.example',
        turnstileToken: 'placeholder-token',
      })
      .expect(201);

    const reference = (body(response) as { reference: string }).reference;
    const row = await prisma.client.bookingInquiry.findUnique({ where: { reference } });
    expect(row?.status).toBe('SPAM');
    expect(row?.honeypotTripped).toBe(true);
  });

  it('rejects an unknown field', async () => {
    const response = await http()
      .post(`${base}/inquiries`)
      .send({
        name: `${PREFIX} Client`,
        email: `${PREFIX}@example.test`,
        turnstileToken: 'placeholder-token',
        isAdmin: true,
      })
      .expect(422);

    expect(body(response).code).toBe('VALIDATION_FAILED');
  });

  it('is rate-limited tighter than the global default', async () => {
    const ip = '198.51.100.240';
    const attempt = () =>
      http(ip)
        .post(`${base}/inquiries`)
        .send({
          name: `${PREFIX} Rate`,
          email: `${PREFIX}-rate@example.test`,
          turnstileToken: 'placeholder-token',
        });

    await attempt().expect(201);
    await attempt().expect(201);
    await attempt().expect(201);
    await attempt().expect(429);
  });
});

describe('admin pipeline', () => {
  it('moves status, assigns a note, and soft-deletes', async () => {
    const created = await http()
      .post(`${base}/inquiries`)
      .send({
        name: `${PREFIX} Pipeline`,
        email: `${PREFIX}-pipeline@example.test`,
        turnstileToken: 'placeholder-token',
      })
      .expect(201);

    const reference = (body(created) as { reference: string }).reference;
    const row = await prisma.client.bookingInquiry.findUnique({ where: { reference } });
    if (!row) throw new Error('fixture inquiry not found');

    await http()
      .patch(`${base}/admin/inquiries/${row.id}`)
      .set('authorization', ownerToken)
      .send({ status: 'CONTACTED' })
      .expect(200);

    const noted = await http()
      .post(`${base}/admin/inquiries/${row.id}/notes`)
      .set('authorization', ownerToken)
      .send({ body: 'Called, following up next week.' })
      .expect(201);
    expect((body(noted).notes as { body: string }[]).length).toBe(1);

    await http()
      .delete(`${base}/admin/inquiries/${row.id}`)
      .set('authorization', ownerToken)
      .expect(204);
  });

  it('requires authentication for the admin surface', async () => {
    await http().get(`${base}/admin/inquiries`).expect(401);
  });
});
