# 0021 — The `auth/` coverage gate was inert; closing part of it, not all of it

**Status:** Accepted · **Date:** 2026-09-11 (during Group A completion)

## Context

`testing.md` states the target plainly: _"Auth is at 100% because we
hand-rolled it. Anything less there is theatre."_ `vitest.config.ts` already
carried a coverage threshold for it — `{ lines: 80, functions: 80, branches:
70, statements: 80 }` on `src/modules/auth/**` — from an earlier session.

Running it for the first time this session found two separate problems.

**The gate had never actually run.** `@vitest/coverage-v8` — the provider the
config names — was never installed. `pnpm test` is `vitest run` with no
`--coverage` flag, so the threshold was never invoked in the normal pipeline
either. The config read as enforced; it had done nothing since it was
written.

**Once installed, `auth/` measured 17.92% line coverage, not 80%.**
`TotpService` and `PasswordService` had zero unit tests before this session —
now 98%+ each, with 34 new tests covering secret encryption, recovery-code
hashing, the epoch-tolerance window, zxcvbn scoring and the
`burnVerifyTime()` no-enumeration path. But `AuthService` (520 lines, 8
injected dependencies), `AuthController`, `AuthRepository`,
`RefreshTokenService` and `AuthCookieService` remain at 0% **unit** coverage.

That is not the same as untested. The auth e2e suite (36 tests) exercises
exactly the security-critical paths through those classes at the HTTP
boundary: no user enumeration, both lockouts, refresh rotation, **reuse
revoking the whole token family**, CSRF, the full RBAC matrix. What is
missing is unit-level coverage of the same logic in isolation — which the
literal 80%-line-coverage number requires and the e2e suite, by its nature,
cannot produce no matter how thorough it is.

Writing genuine unit tests for `AuthService` means mocking eight
dependencies (`AuthRepository`, `PasswordService`, `TotpService`,
`RefreshTokenService`, `RbacService`, `AuditService`, `JwtService`,
`ConfigService`) faithfully enough that the tests catch real regressions
rather than merely mirroring the implementation. That is a substantial,
separate piece of work — comparable in size to everything else done this
session — and rushing it at the end of a long session is a worse outcome
than being honest that it remains open.

## Decision

- `@vitest/coverage-v8` is now installed and pinned to the `vitest` major
  version, so the gate is at least capable of running.
- `TotpService` and `PasswordService` unit tests are written and pass at
  ~98% line coverage each.
- The threshold in `vitest.config.ts` is **left as-is** — not loosened to
  make the number pass, not tightened to 100% while most of the directory
  has no unit tests. Silently adjusting a gate to match the current state
  would hide exactly the gap this ADR exists to record.
- The gap is recorded honestly in `STATUS.md` rather than the Phase 3 exit
  criterion being marked complete: coverage of `AuthService`,
  `AuthController`, `AuthRepository`, `RefreshTokenService` and
  `AuthCookieService` remains **e2e-only**.

## Consequences

- Running `pnpm --filter @dj/api test -- --coverage` **fails** on the
  `auth/**` threshold today. This is expected and documented, not a
  regression to chase down — see `STATUS.md` gap #7.
- The normal pipeline (`pnpm test`, CI) is unaffected: it does not pass
  `--coverage`, so this failure is not blocking anything today. It will need
  to be revisited before `--coverage` is wired into CI as a gate.
- The next session picking this up should mock the eight dependencies once,
  as reusable fixtures, and write `AuthService`'s test file per method
  (`login`, `refresh`, `logout`, `logoutAll`, `changePassword`,
  `enrollTotp`, `verifyTotpEnrollment`, `disableTotp`) — the lockout and
  reuse-detection branches are the ones most worth the mocking cost, since
  they are also the ones a unit test can exercise far more cheaply than an
  e2e run (no real argon2 work, no real token issuance needed to hit every
  branch).

## Alternatives considered

**Lower the threshold to match today's ~18%.** Rejected outright: that is
the gate quietly agreeing to theatre, which is the exact failure mode
`testing.md`'s own wording was written to prevent.

**Skip `TotpService`/`PasswordService` too, and leave the whole gap for
later as one piece of work.** Rejected: those two were genuinely tractable
in this session, are now at ~98%, and finding the inert-provider bug only
happened _because_ the gate was finally run — leaving it untouched would
have meant this bug shipped undiscovered for another session.
