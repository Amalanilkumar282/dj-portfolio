import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/infra/prisma/prisma.service';

import { base, body, createTestApp, http as client, requiredEnv } from './harness';

/**
 * The newsletter's double opt-in: subscribe -> confirm -> unsubscribe.
 *
 * `RESEND_API_KEY` is a placeholder in this environment, so
 * `NewsletterService.subscribe()` logs and skips the confirmation email
 * rather than sending it — the row and its `confirmToken` are still written
 * for real, which is what this spec reads directly rather than through a
 * mailbox it cannot have.
 *
 * Requires Postgres with migrations, `seed:system` and `seed:admin`.
 */

const PREFIX = 'e2e-newsletter';

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
  await prisma.client.newsletterSubscriber.deleteMany({ where: { email: { contains: PREFIX } } });
  await app.close();
});

describe('double opt-in', () => {
  it('subscribes PENDING, confirms to CONFIRMED, then unsubscribes', async () => {
    const email = `${PREFIX}@example.test`;

    await http().post(`${base}/newsletter/subscribe`).send({ email, turnstileToken: 'x' }).expect(204);

    const pending = await prisma.client.newsletterSubscriber.findUnique({ where: { email } });
    expect(pending?.status).toBe('PENDING');
    expect(pending?.confirmToken).not.toBeNull();

    await http()
      .post(`${base}/newsletter/confirm`)
      .send({ token: pending?.confirmToken })
      .expect(204);

    const confirmed = await prisma.client.newsletterSubscriber.findUnique({ where: { email } });
    expect(confirmed?.status).toBe('CONFIRMED');
    expect(confirmed?.confirmedAt).not.toBeNull();

    await http()
      .post(`${base}/newsletter/unsubscribe`)
      .send({ token: confirmed?.unsubscribeToken })
      .expect(204);

    const unsubscribed = await prisma.client.newsletterSubscriber.findUnique({ where: { email } });
    expect(unsubscribed?.status).toBe('UNSUBSCRIBED');
  });

  it('rejects an invalid confirmation token', async () => {
    const response = await http()
      .post(`${base}/newsletter/confirm`)
      .send({ token: 'not-a-real-token' })
      .expect(404);
    expect(body(response).code).toBe('NOT_FOUND');
  });

  it('lists subscribers to admins only', async () => {
    await http().get(`${base}/admin/newsletter`).expect(401);

    await http().get(`${base}/admin/newsletter`).set('authorization', ownerToken).expect(200);
  });
});
