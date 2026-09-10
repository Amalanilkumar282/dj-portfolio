# 0005 — Pooled Neon connection; no Accelerate, no serverless driver

**Status:** Accepted · **Date:** 2026-09-10

## Context

Neon offers a direct endpoint, a PgBouncer pooler endpoint, an HTTP/WebSocket
serverless driver, and Prisma additionally sells Accelerate. The API is a
long-lived container (ADR 0007), not a serverless function.

## Decision

- `DATABASE_URL` → the `-pooler` endpoint with
  `?pgbouncer=true&connection_limit=10&pool_timeout=20`
- `DIRECT_URL` → the unpooled endpoint, used for migrations and DDL only
- Region `ap-southeast-1` (Singapore), matching the API host
- Scale-to-zero **disabled** in production, enabled on preview branches

## Consequences

- `pgbouncer=true` is required, not cosmetic: it makes Prisma skip prepared
  statements, which PgBouncer transaction mode cannot support.
- `connection_limit=10` is set explicitly rather than left to Prisma's
  `num_cpus * 2 + 1`, which on a 4-vCPU container opens 9 connections per
  replica and can exhaust the Neon ceiling.
- Migrations and the post-migrate SQL must use `DIRECT_URL` — DDL and advisory
  locks need a session, which transaction-mode pooling cannot hold.
- Scale-to-zero off in production because a 500ms cold start on the first
  booking-form submission of the day is unacceptable.

## Alternatives rejected

- **Prisma Accelerate.** Adds a network hop and a recurring cost to solve
  serverless connection explosion, a problem a persistent container does not
  have.
- **Neon serverless driver adapter.** HTTP/WebSocket transport is a real win at
  the edge and a real loss in a long-lived Node process, where TCP plus
  connection pooling is simply faster.
- **Direct endpoint only.** Works today at one replica, then fails the first
  time the service is scaled.
