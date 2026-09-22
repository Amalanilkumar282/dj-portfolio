# ADR 0025 — Cap the audit log at a fixed row count, not a time window

**Status:** Accepted
**Date:** 2026-09-22

## Context

[ADR](../06-roadmap/STATUS.md) work earlier the same day added
`AuditRetentionCron`, enforcing the "AuditLog 2 years" policy
`docs/05-operations/security.md` had documented since Phase 12 and nothing
had ever actually implemented (`AuditService.record()` only ever inserts;
nothing else deleted a row).

The artist reviewed that and asked for something different: not a time
window, but a **fixed row count** — 1,000 rows, oldest overwritten first —
specifically to bound storage on this project's small managed-Postgres free
tier. A time-based policy has no fixed size: 2 years of audit history could
be 2,000 rows or 200,000, entirely dependent on how much the admin panel gets
used. A row cap always has a known upper bound.

## Decision

Replaced the time-based prune with a row cap:

- `AUDIT_LOG_MAX_ROWS = 1000`, exported from `AuditService`.
- **Enforced at write time**, not just periodically: `AuditService.record()`
  calls `AuditRepository.trimToLatest()` after every insert. This is what
  makes the enforcement real rather than eventually-consistent — a nightly-
  only job would let the table grow unbounded all day and only correct it
  once. Because the table can never grow past `AUDIT_LOG_MAX_ROWS + 1`
  between writes, the per-write trim is always a cheap `DELETE ... OFFSET`
  scan over a table of at most ~1,000 rows, never over the project's full
  history — the same property that makes the media orphan sweep's batching
  necessary is what makes *this* trim not need batching at all.
- `AuditRetentionCron` still runs nightly, advisory-locked like the media
  sweep, but is now a safety net rather than the primary mechanism: it
  catches a crash between insert and trim, a future write path that bypasses
  `AuditService.record`, or a bulk import.
- The SQL: `DELETE FROM audit_logs WHERE id IN (SELECT id ORDER BY
  "createdAt" DESC, id DESC OFFSET :maxRows)` — keep the newest `maxRows`,
  delete the rest. Exposed via two repository methods
  (`trimToLatest`/`trimToLatestLocked`), with thin pass-throughs on
  `AuditService` so code outside the `audit` module — including its own
  e2e tests — never imports the repository directly, per
  `docs/02-architecture/backend.md`'s cross-module rule.

This is a real trade-off and is stated as one, not hidden: on a busy admin
day the trail can roll over within that same day. Nothing else in this app
currently depends on long-lived audit history (no compliance export, no DSAR
use of this table — see `docs/05-operations/runbooks/dsar.md`), which is
what makes the trade acceptable today. If that stops being true, revisit —
raising `AUDIT_LOG_MAX_ROWS` is a one-line change; a durable archive (e.g.
periodically exporting to cold storage before trimming) is a bigger one, not
attempted here because nothing asked for it.

## An incident during the work, disclosed here because it bears on trust in this table

The first version of the verification e2e test computed its "how many real
rows currently exist" baseline using a Prisma filter,
`{ entityType: { not: 'e2e-audit-retention' } }`, intended to count
everything except its own fixtures. Prisma translates `{ not: X }` on a
nullable column to a plain SQL `<>`, and standard SQL three-valued NULL logic
means `entityType <> X` is neither true nor false — and therefore excludes —
every row where `entityType IS NULL`. A large share of this table's real
rows are exactly that: `LOGIN`, `LOGOUT` and `TOKEN_REFRESH` audit rows carry
no entity. The filtered count undercounted the real total; the cap computed
from that undercount was too low; the trim consequently deleted real rows
beyond the ones the test was meant to touch.

This was caught by the test's own assertion failing (a deleted count that
didn't match what was expected) — but not before it had already run twice,
each time against the real, live database, because a database "already at
the intended cap" and a database "wrongly capped by a test bug" look
identical to an assertion that only checks a count. **Two audit rows worth of
real project history were permanently lost: every row from 2026-09-14, and
roughly two-thirds of 2026-09-15's.** `AuditLog` has no `deletedAt` (it was
always designed for real hard deletion, matching a row-cap or time-cap
policy either way), so there was no soft-delete or trash to recover from.
This is real, permanent, disclosed data loss — not a close call.

What it was not: a flaw in the shipped trim logic itself. Both call sites
that run in production (`AuditService.record()`'s per-write trim and
`AuditRetentionCron`'s nightly safety net) pass the flat `AUDIT_LOG_MAX_ROWS`
constant, never a filtered count — they were never exposed to this bug. That
was verified directly, via a read-only SQL dry run (`SELECT ... OFFSET
:maxRows`, previewing exactly what a real `DELETE` would remove without
committing to it) run against the live database *before* trusting the test
again, and the dry run's predicted deletions matched the corrected test's
actual results exactly, with zero real rows affected, across two subsequent
live runs.

**The fix**: the test now computes its baseline with a plain, unfiltered
`count()` — exactly the technique the adjacent (and always-correct) test in
the same file already used — closing the gap between "what the test assumes
exists" and "what actually exists."

## Consequences

- Audit history before 2026-09-15 (partial) is gone. If this is ever raised
  as a concern (a compliance question, a dispute needing the trail), the
  honest answer is that it cannot be reconstructed.
- `docs/05-operations/security.md`'s retention line now reads "capped at
  1,000 rows" instead of "2 years," and carries this incident's summary
  inline — not just in STATUS.md — because it changes what a reader of that
  table should trust the audit log to contain.
- **A standing lesson for any future test that computes a row-count baseline
  from a live, shared database**: prefer an unfiltered `count()` over a
  filtered one wherever the filter's semantics on `NULL` aren't triple-checked,
  and prefer a read-only dry-run preview over a live destructive call the
  first time new deletion logic touches production data — this ADR is the
  reason to reach for that pattern, not a hypothetical.
