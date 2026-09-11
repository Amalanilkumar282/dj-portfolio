# 0020 — Uniqueness pre-checks must see soft-deleted rows

**Status:** Accepted · **Date:** 2026-09-11 (during Phase 4, building Venues)

## Context

`SlugService.resolve()` has two paths. A caller-supplied slug that collides is
a 409 the editor needs to see. A slug it auto-derives from a title is meant to
be **guaranteed available** — that guarantee is the entire reason the
auto-derive path exists rather than just using the raw slugified title.

Both paths depend on a repository's `isSlugTaken(candidate)` check answering
correctly. It did not, for every soft-deletable model with one: `isSlugTaken`
called `prisma.<model>.findUnique({ where: { slug } })`, and the soft-delete
Prisma extension narrows every read to `deletedAt: null` unless the caller's
`where` already mentions `deletedAt`. A `slug`-only `where` does not, so the
check is silently scoped to live rows only.

A soft-deleted row still occupies its `slug` at the database level — soft
delete rewrites `DELETE` into `UPDATE ... SET deletedAt`, it does not touch
`@unique`. So: soft-delete a persona named "Test", then create a new one
named "Test" — `isSlugTaken('test')` reports `false` (the trashed row is
invisible to it), `SlugService` returns `test` unchanged believing it is free,
and the actual `INSERT` hits the real unique constraint and fails.

For a caller-supplied slug this degrades gracefully: the request still 409s,
just via `PrismaExceptionFilter`'s generic `P2002` handling (`UNIQUE_CONSTRAINT`,
`/slug`, "Already taken") rather than `SlugService`'s own `ConflictException`
(`SLUG_TAKEN`, "The slug \"x\" is already in use") — different code, same
shape, same status. For the **auto-derive** path it does not degrade
gracefully at all: a caller who supplied no slug, and has no reason to expect
one to collide, gets an unexplained 409 on a creation that should have "just
worked".

This was found building the Venues module — its own uniqueness check
(`@@unique([name, city])`) has the identical shape — and turned out to
already be present in `Personas.isSlugTaken`, the shipped exemplar every
other content module is built by copying.

## Decision

`packages/db/src/extensions/publish.ts` exports `anyDeletionState()`:

```ts
export function anyDeletionState(): Record<string, unknown> {
  return { OR: [{ deletedAt: null }, { deletedAt: { not: null } }] };
}
```

Spread into any uniqueness pre-check's `where`:

```ts
async isSlugTaken(slug: string, exceptId?: string) {
  const existing = await this.prisma.client.persona.findFirst({
    where: { slug, ...anyDeletionState() },
    select: { id: true },
  });
  return existing != null && existing.id !== exceptId;
}
```

The `OR` shape, not a bare `{}`: the soft-delete extension detects "the caller
already has an opinion about `deletedAt`" by checking for the literal key,
including inside `OR` branches (`hasExplicitDeletedAtFilter`). A
`{ deletedAt: undefined }` would work too — Prisma drops `undefined` filter
values before the query reaches Postgres — but that relies on a reader
already knowing Prisma's undefined-omission behaviour to trust the function
does what it says. The explicit `OR` needs no such knowledge.

`findFirst`, not `findUnique`: once the `where` is not exactly a unique field
plus nothing else, `findUnique` is the wrong tool regardless of the fix here.

Fixed at both sites this session: `Personas.isSlugTaken` and
`Venues.isSlugTaken` / `Venues.isNameCityTaken`. A regression test lives in
`packages/db/src/__tests__/soft-delete.int-spec.ts` (`describe('anyDeletionState')`),
proving directly that a soft-deleted row is invisible to a plain query and
visible once `anyDeletionState()` is spread in.

## Consequences

- Every future content module's `isSlugTaken` (and any other uniqueness
  pre-check) must use this from the start — `backend.md`'s "Adding a content
  module" section says so.
- The remaining models with the same latent bug (every soft-deletable model
  not yet built — Tracks, Releases, Playlists, Programs, Events, and the
  Phase 6 modules) are unaffected only because their repositories do not
  exist yet; this is not a partial fix left for later, it is the correct
  pattern being established before more code copies the broken one.
- No migration, no schema change — this is entirely an application-layer
  read-path fix.
- The behaviour it protects is subtle enough that it needs the regression
  test to stay caught: the failure mode is a 409 on an operation that
  "should" succeed, which reads like flakiness rather than a bug, and would
  not reproduce reliably without a soft-deleted row already present at the
  colliding slug.

## Alternatives considered

**A partial unique index scoped to `WHERE deleted_at IS NULL`**, so a
soft-deleted row's slug becomes reusable immediately rather than remaining
reserved until the 30-day hard-delete sweep. Rejected: it changes an
intentional product behaviour (a slug in the trash stays reserved so a
restore cannot collide with something created in the meantime, and so two
different pages can never simultaneously claim the same public URL) into an
accidental one, to fix what is actually an application bug in the read path.
The reservation is correct; only the pre-check's blindness to it was wrong.

**Have the exception filter recognise this specific P2002 case and translate
it into `SlugService`'s nicer error.** Papers over the auto-derive guarantee
being broken rather than restoring it — the caller who supplied no slug would
still get a 409 for a reason they cannot see or act on, just with better
wording.
