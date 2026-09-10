# 0006 — No Redis at launch

**Status:** Accepted · **Date:** 2026-09-10

## Context

The default instinct is to add Redis for caching, sessions and a job queue.
Each of those needs examining separately against this system's actual shape.

## Decision

Ship without Redis. Use an in-process `cache-manager` LRU behind an interface,
and let Next.js's tag-based Data Cache do the real caching work.

## Consequences

Taking the three usual reasons in turn:

- **Caching.** Next.js's Data Cache absorbs virtually all public read traffic;
  the API sees close to zero requests per second in steady state. At one
  replica an in-process LRU is strictly faster than a network round trip to
  Redis.
- **Sessions.** There are none to store. Access tokens are stateless JWTs and
  refresh tokens live in a Postgres table.
- **Jobs.** Six cron jobs, each wrapped in a Postgres advisory lock. See
  ADR 0007.

The cache sits behind an interface, so `REDIS_URL` being present swaps in
Upstash with a one-line module change.

**Redis becomes mandatory when either of these happens:**

1. The API runs more than one replica — an in-process cache is then incoherent.
2. BullMQ arrives, which needs Redis by construction.

## Alternatives rejected

- **Upstash Redis from day one.** Real cost and a real operational dependency,
  bought before there is a problem to solve. Easy to add later, and the
  trigger conditions above are written down so it does not get forgotten.
