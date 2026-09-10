# DJ Felicitous — project documentation

> ## Read this before writing code
>
> **This applies to every contributor, human or AI agent.**
>
> The architecture of this project is **already decided**. It was designed
> deliberately, in response to specific failures of the site it replaces, and
> it is written down. Your job is to implement it, not to re-derive it.
>
> **Before touching code, read, in this order:**
>
> 1. [`00-overview.md`](00-overview.md) — what this product is and who it is for.
> 2. [`06-roadmap/STATUS.md`](06-roadmap/STATUS.md) — **what phase we are in and what
>    is actually done.** Always read this. It is the live state of the project.
> 3. The [`02-architecture/`](02-architecture/) document covering the area you are
>    about to change.
> 4. Any [`01-decisions/`](01-decisions/) ADR that area references.
>
> **The rules:**
>
> - **Do not deviate from a documented decision.** If you believe a decision is
>   wrong, write a new ADR in [`01-decisions/`](01-decisions/) proposing the
>   change and raise it — do not silently do something else. An undocumented
>   deviation is worse than a documented mistake, because the next session
>   cannot tell which one it is looking at.
> - **Do not skip phases.** Phases have exit criteria for a reason. Building
>   Phase 7 before Phase 4 means building on an API that does not exist yet.
> - **Update [`06-roadmap/STATUS.md`](06-roadmap/STATUS.md) before you finish.**
>   Tick what you completed, note what you did not, and say why. The next
>   session starts from that file.
> - **Never invent content.** No placeholder testimonials, no fabricated venues,
>   no made-up press quotes, no invented gig dates, no guessed prices. See
>   [`07-content/brand.md`](07-content/brand.md) — the previous site did all of
>   these and it is part of why it is being replaced.

---

## What this project is

A dynamic portfolio and booking site for **DJ Felicitous**, a Bengaluru-based
DJ and producer who performs under four artist identities. It replaces a
static site whose content could only be changed by editing TypeScript files.

The single most important requirement: **the artist manages 100% of the
content himself, through an admin panel, without a developer.**

The three apps:

| App          | Domain                   | What it is                                              |
| ------------ | ------------------------ | ------------------------------------------------------- |
| `apps/web`   | `djfelicitous.com`       | The public site. Server-rendered, cinematic, SEO-first. |
| `apps/admin` | `admin.djfelicitous.com` | The CMS. Where the artist works.                        |
| `apps/api`   | `api.djfelicitous.com`   | NestJS. Owns the database and all business rules.       |

## How to find things

### By task

| I need to…                               | Read                                                                                                                                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Get the project running locally          | [`05-operations/local-setup.md`](05-operations/local-setup.md)                                                                         |
| Know what to build next                  | [`06-roadmap/STATUS.md`](06-roadmap/STATUS.md), then [`06-roadmap/phases.md`](06-roadmap/phases.md)                                    |
| Add or change a database model           | [`02-architecture/data-model.md`](02-architecture/data-model.md), [`05-operations/migrations.md`](05-operations/migrations.md)         |
| Add an API endpoint                      | [`02-architecture/backend.md`](02-architecture/backend.md), [`02-architecture/api-conventions.md`](02-architecture/api-conventions.md) |
| Add a public page                        | [`02-architecture/frontend.md`](02-architecture/frontend.md), [`02-architecture/seo.md`](02-architecture/seo.md)                       |
| Style something                          | [`03-design-system/tokens.md`](03-design-system/tokens.md) — **never hardcode a colour**                                               |
| Add an animation or 3D scene             | [`03-design-system/motion.md`](03-design-system/motion.md) — **every effect needs a fallback**                                         |
| Handle images, video or audio            | [`02-architecture/media-pipeline.md`](02-architecture/media-pipeline.md)                                                               |
| Make content update on the live site     | [`02-architecture/caching-and-revalidation.md`](02-architecture/caching-and-revalidation.md)                                           |
| Add an admin screen                      | [`02-architecture/admin.md`](02-architecture/admin.md)                                                                                 |
| Work on login, roles or permissions      | [`02-architecture/auth-and-rbac.md`](02-architecture/auth-and-rbac.md)                                                                 |
| Write a test                             | [`04-conventions/testing.md`](04-conventions/testing.md)                                                                               |
| Know when a PR is finished               | [`04-conventions/definition-of-done.md`](04-conventions/definition-of-done.md)                                                         |
| Deploy, or debug production              | [`05-operations/deployment.md`](05-operations/deployment.md), [`05-operations/runbooks/`](05-operations/runbooks/)                     |
| Understand why the old site was scrapped | [`07-content/legacy-audit.md`](07-content/legacy-audit.md)                                                                             |

### By directory

```
docs/
├─ 00-overview.md            product, audience, goals, non-goals, glossary
├─ 01-decisions/             ADRs. Numbered, immutable once accepted.
├─ 02-architecture/          how each part of the system works
├─ 03-design-system/         tokens, theming, typography, motion, a11y
├─ 04-conventions/           code style, git, testing, definition of done
├─ 05-operations/            setup, env, migrations, deploy, security, runbooks
├─ 06-roadmap/               masterplan, phases, STATUS (live), backlog
└─ 07-content/               content model guide, legacy audit, brand rules
```

[`06-roadmap/masterplan.md`](06-roadmap/masterplan.md) is the original approved
plan in full. It is the most detailed single document here and the tie-breaker
if two docs appear to disagree. The other documents are task-focused views of
the same decisions.

## The invariants

These are enforced by ESLint rules, database constraints and CI gates, not by
good intentions. If you find yourself fighting one, you are probably about to
reintroduce a bug the previous site had.

| Invariant                                               | Enforced by                         |
| ------------------------------------------------------- | ----------------------------------- |
| No `'use client'` in `page.tsx` / `layout.tsx`          | `dj/no-client-in-route-files`       |
| No raw colour literals in app code                      | `dj/no-raw-color-literals`          |
| Prisma only inside `*.repository.ts` and `infra/`       | `dj/prisma-only-in-repositories`    |
| No `$queryRawUnsafe` / `$executeRawUnsafe`              | `dj/no-unsafe-prisma-raw`           |
| Content is never hard-deleted                           | soft-delete Prisma extension        |
| Published content always has a `publishedAt`            | DB `CHECK` constraint               |
| In-page images always have alt text                     | DB `CHECK` constraint               |
| One `site_settings` row, ever                           | DB `CHECK` constraint               |
| Every heavy visual effect has a reduced-motion fallback | `<MotionGate>`, phase exit criteria |
| Every internal link resolves 200                        | Playwright link crawl               |
| `schema.prisma` never drifts from `prisma/migrations`   | `pnpm db:migrate:check` in CI       |

## Conventions in this documentation

- **Decisions** live in ADRs and are immutable once accepted; a reversal is a
  new ADR that supersedes the old one.
- **Architecture** documents describe the current intended design. They are
  updated in the same PR as the code that changes them.
- **STATUS.md** is the only document that changes on every session.
- Code references use repo-relative paths, e.g.
  `packages/db/prisma/schema.prisma`.
