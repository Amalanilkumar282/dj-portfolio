# 0007 — Railway hosts the NestJS API

**Status:** Accepted · **Date:** 2026-09-10

## Context

The API needs a persistent process. Four things require it:
in-process cron jobs, Postgres advisory locks held across a job, TCP
connection pooling to Neon, and an in-memory LRU cache.

## Decision

Railway, Singapore region, deployed from a Dockerfile, one replica to start.
`web` and `admin` stay on Vercel.

## Consequences

- Cron, advisory locks, pooling and in-process cache all work without extra
  infrastructure — which is what makes ADR 0006 viable.
- Migrations run as a pre-deploy command: `prisma migrate deploy && pnpm
post-migrate && pnpm seed:system`.
- Singapore keeps API↔Neon latency in single-digit milliseconds and API↔user
  around 40ms from Bengaluru.
- Private networking is available for the eventual Redis.
- Roughly $5–20/month at this scale.
- Cost: a third platform in the stack alongside Vercel and Neon.

## Alternatives rejected

- **Vercel serverless.** Rules out everything in the Context section: no
  persistent process means no in-process cron, no advisory locks held across a
  job, connection churn against Neon, and cold starts on the booking endpoint.
- **Render.** A near-tie and the fallback if Railway disappoints. Slower
  deploys, and its free tier spins down, which hurts first-load latency.
- **Fly.io.** Genuinely better technology — Anycast, Machines, multi-region —
  but it imposes volume, region and `fly.toml` decisions that a one-artist site
  will never amortise.
