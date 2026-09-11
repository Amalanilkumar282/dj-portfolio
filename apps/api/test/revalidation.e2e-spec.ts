import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { ContentChangedEvent } from '@dj/contracts';

import { PrismaService } from '../src/infra/prisma/prisma.service';
import { RevalidationService } from '../src/infra/revalidation/revalidation.service';

import { base, body, createTestApp, http as client, requiredEnv } from './harness';

/**
 * The revalidation loop — that a content mutation actually reaches the
 * listener that tells the web app what to re-render.
 *
 * This is the subsystem whose failure mode is **complete silence**. If the
 * emit never reaches `RevalidationService`, every write still returns 200,
 * every test still passes, and the only symptom is "I published but nothing
 * changed" — the single most confusing bug this architecture can have.
 *
 * It is easy to break in two ways, both invisible:
 *
 * 1. **Two emitter instances.** A listener registered on one `EventEmitter2`
 *    never hears an event emitted on another. The `DOMAIN_EVENT_BUS` token is
 *    a `useExisting` alias precisely so there is one instance — this suite is
 *    what proves the alias resolves to the same object rather than a second
 *    one. See src/common/events.ts.
 * 2. **A missing `TAG_MAP` entry.** An entity absent from the map falls
 *    through to a sitemap-only default and never revalidates its own page.
 *    `tag-map.spec.ts` covers the map itself; this covers the wiring.
 *
 * The outbound HTTP post is not exercised — there is no web app to receive it
 * yet. What is asserted is that the handler runs with the right tags, which is
 * the part that silently breaks.
 */

let app: INestApplication;
let prisma: PrismaService;

const http = () => client(app);
let token = '';

/** Events the listener actually received, in order. */
const received: ContentChangedEvent[] = [];

beforeAll(async () => {
  app = await createTestApp();
  prisma = app.get(PrismaService);

  const revalidation = app.get(RevalidationService);

  // Spied rather than stubbed out: the real handler still resolves tags, so a
  // broken TAG_MAP entry surfaces here too. Only the outbound post is
  // suppressed, by making `revalidate` a no-op.
  vi.spyOn(revalidation, 'onContentChanged').mockImplementation(
    async (event: ContentChangedEvent) => {
      received.push(event);
      return Promise.resolve();
    },
  );

  const login = await http()
    .post(`${base}/auth/login`)
    .send({
      email: requiredEnv('ADMIN_SEED_EMAIL'),
      password: requiredEnv('ADMIN_SEED_PASSWORD'),
    })
    .expect(200);

  token = `Bearer ${String(body(login).accessToken)}`;
});

afterAll(async () => {
  vi.restoreAllMocks();
  await app.close();
});

/** Waits for the listener to fire: `@OnEvent` handlers are not awaited. */
async function drain(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50));
}

describe('a content mutation reaches the revalidation listener', () => {
  it('fires for a persona update', async () => {
    received.length = 0;

    const list = await http().get(`${base}/admin/personas`).set('authorization', token).expect(200);

    const target = (body(list).data as { id: string; slug: string; tagline: string | null }[])[0];
    if (!target) throw new Error('No personas seeded.');

    try {
      await http()
        .patch(`${base}/admin/personas/${target.id}`)
        .set('authorization', token)
        .send({ tagline: 'revalidation probe' })
        .expect(200);

      await drain();

      const event = received.find((e) => e.entity === 'persona');
      expect(event, 'no content.changed event reached the listener').toBeDefined();
      expect(event?.slug).toBe(target.slug);
      expect(event?.action).toBe('update');
    } finally {
      // Restores the artist's real copy — see testing.md.
      await http()
        .patch(`${base}/admin/personas/${target.id}`)
        .set('authorization', token)
        .send({ tagline: target.tagline })
        .expect(200);
    }
  });

  it('fires for a genre update, proving the token alias is one instance', async () => {
    // Genres inject the bus purely by `DOMAIN_EVENT_BUS`. If that token
    // resolved to a second emitter, this would receive nothing while the
    // request still returned 200.
    received.length = 0;

    const created = await http()
      .post(`${base}/admin/genres`)
      .set('authorization', token)
      .send({ name: 'e2e-reval Probe Genre', slug: 'e2e-reval-probe' })
      .expect(201);

    const genre = body(created) as { id: string; slug: string };

    try {
      await drain();

      const event = received.find((e) => e.entity === 'genre');
      expect(event, 'the DOMAIN_EVENT_BUS alias is not the same emitter').toBeDefined();
      expect(event?.slug).toBe('e2e-reval-probe');
      expect(event?.action).toBe('create');
    } finally {
      await prisma.client.genre.deleteMany({ where: { id: genre.id } });
    }
  });

  it('fires on delete, so a removed genre stops being rendered', async () => {
    const created = await http()
      .post(`${base}/admin/genres`)
      .set('authorization', token)
      .send({ name: 'e2e-reval Doomed Genre', slug: 'e2e-reval-doomed' })
      .expect(201);

    const genre = body(created) as { id: string };
    received.length = 0;

    await http().delete(`${base}/admin/genres/${genre.id}`).set('authorization', token).expect(204);

    await drain();

    // Without this, a deleted genre keeps appearing in a statically-rendered
    // filter bar until the weekly backstop cron.
    expect(received.find((e) => e.action === 'delete')).toBeDefined();
  });
});
