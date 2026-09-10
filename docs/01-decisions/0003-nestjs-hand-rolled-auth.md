# 0003 — Hand-rolled authentication in NestJS

**Status:** Accepted · **Date:** 2026-09-10

## Context

Between one and five admin users. No social login, no public sign-up, no
multi-tenancy. Requirements: password login, rotating refresh tokens, RBAC,
TOTP two-factor, session revocation and brute-force lockout.

## Decision

Implement it in NestJS: argon2id hashing, a 15-minute access JWT, and an opaque
rotating refresh token stored as a sha256 hash and delivered in an httpOnly
cookie. RBAC via `Role` × `Permission` with a `@RequirePermissions` guard.

## Consequences

- Prisma stays the single source of truth for users, roles and sessions.
- Nest guards compose naturally with the rest of the request pipeline.
- No vendor, no per-seat cost, no external dependency in the login path.
- **We own the security-critical code**, so it gets a 100% coverage
  requirement and an e2e matrix covering lockout, rotation and reuse
  detection. Anything less on auth is theatre.
- Roughly 400 lines to write and maintain.

Reuse of an already-rotated refresh token revokes the whole token family. That
is the standard detection for a stolen token and it is not optional.

## Alternatives rejected

- **Better Auth.** Excellent library, but Node/Next-runtime-first and it wants
  to own the session tables. Sitting it in front of a Nest API means either
  duplicating the session model or giving up Prisma as the source of truth.
- **Auth.js v5.** Same shape of problem; strongest when the Next app _is_ the
  backend, which here it is not.
- **Clerk.** Fastest to ship and genuinely good, but an external dependency and
  a recurring cost in the critical path of a single-admin site.
