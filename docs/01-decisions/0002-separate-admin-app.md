# 0002 — The admin panel is a separate Next.js app

**Status:** Accepted · **Date:** 2026-09-10

## Context

The admin panel could be a route group inside `apps/web` (`/admin`) or its own
application. The public site's entire value depends on being static, cached and
fast; the admin's depends on being dynamic and richly interactive.

## Decision

A separate `apps/admin`, deployed as its own Vercel project on
`admin.djfelicitous.com`.

## Consequences

- **The public site stays fully static/ISR.** An admin route group inside the
  same app quietly poisons that: shared middleware and any cookie-reading
  layout opts routes into dynamic rendering, and it is easy to do by accident.
- **The session cookie is scoped to `admin.djfelicitous.com`.** The public
  origin never carries an admin session, which is a large reduction in CSRF and
  XSS blast radius — an XSS on a public marketing page cannot reach the cookie.
- **Heavy admin dependencies cost the public site nothing.** TanStack Table,
  Tiptap, dnd-kit, the Cloudinary widget and react-easy-crop are large. Public
  LCP is unaffected.
- Independent deploy cadence and independent bundle budgets (public ≤145KB
  first-load, admin ≤320KB).
- Cost: a second Vercel project, a second DNS record, and some duplicated
  layout scaffolding. `packages/ui` absorbs most of the duplication.

## Alternatives rejected

- **`/admin` route group in `apps/web`.** Simpler infra, but trades away the
  caching and security properties above — the two things that matter most.
- **A separate SPA (Vite).** Loses server-side route guards, which are how RBAC
  is enforced in the UI, and loses Next.js draft mode for live preview.
