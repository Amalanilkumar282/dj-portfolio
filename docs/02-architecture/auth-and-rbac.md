# Authentication and authorisation

Hand-rolled in NestJS —
[ADR 0003](../01-decisions/0003-nestjs-hand-rolled-auth.md).
**Status: not yet built.** Phase 3 specification.

Auth exists for **admin only**. There is no public login and no fan accounts
([`../00-overview.md`](../00-overview.md) non-goals).

> Because we own this code, it carries a **100% coverage requirement** and a
> full e2e matrix. Anything less on auth is theatre.

---

## Token model

| Token   | Lifetime          | Storage                         | Transport                                                                 |
| ------- | ----------------- | ------------------------------- | ------------------------------------------------------------------------- |
| Access  | 15 min            | In memory, client side          | `Authorization: Bearer`                                                   |
| Refresh | 30 days, rotating | sha256 hash in `refresh_tokens` | httpOnly, Secure, SameSite=Strict cookie, `Domain=admin.djfelicitous.com` |

Only the **hash** of the refresh token is stored, so a database leak yields no
usable tokens. The cookie is scoped to the admin subdomain, so the public
origin never carries a session
([ADR 0002](../01-decisions/0002-separate-admin-app.md)).

### Rotation and reuse detection

Every refresh issues a new token and revokes the old one, recording
`replacedById` and sharing a `familyId`.

**Presenting an already-rotated token revokes the entire family** and writes an
`AuditLog` row with `TOKEN_REUSE_DETECTED`. This is the standard detection for
a stolen token: either the attacker or the legitimate user will present the old
one, and revoking everything forces a fresh login. It is not optional.

`User.passwordChangedAt` is a global revocation stamp — bumping it invalidates
every token issued earlier without scanning the table.

### Endpoints

```
POST /api/v1/auth/login            # email + password (+ TOTP if enrolled)
POST /api/v1/auth/refresh          # rotates; reuse revokes the family
POST /api/v1/auth/logout           # revokes this token
POST /api/v1/auth/logout-all       # revokes every token for the user
POST /api/v1/auth/password/change  # bumps passwordChangedAt
POST /api/v1/auth/password/forgot  # single-use, expiring token
POST /api/v1/auth/password/reset
POST /api/v1/auth/2fa/enroll       # returns otpauth:// URI + recovery codes
POST /api/v1/auth/2fa/verify
POST /api/v1/auth/2fa/disable      # requires password re-entry
POST /api/v1/auth/invite/accept
```

---

## Passwords

argon2id via `@node-rs/argon2` (prebuilt binaries, so no native toolchain on
Windows). OWASP interactive parameters, defined once in
`packages/db/seed/admin.ts` as `ARGON2_OPTIONS` and reused by the auth service
— **change them in both places or neither**:

```ts
{ algorithm: 2 /* argon2id */, memoryCost: 19_456, timeCost: 2, parallelism: 1 }
```

Minimum 12 characters, checked against a local top-10k breached list via
`zxcvbn`. Local list, not an HTTP call to a breach API on every login.

---

## Brute force

Two independent limits, because either alone is defeatable:

- **Per account** — `failedLoginCount` and `lockedUntil`, backing off
  exponentially. Stops password spraying at one account.
- **Per IP** — 10 attempts per 15 minutes via the throttler. Stops credential
  stuffing across accounts.

**No user enumeration.** Unknown email and wrong password must return an
identical body _and take a comparable amount of time_. That means running a
dummy argon2 verify on the unknown-email path — otherwise the timing
difference is the enumeration oracle.

---

## Two-factor

TOTP, **mandatory for `SUPER_ADMIN`**.

- `totpSecret` is AES-256-GCM encrypted at rest, so a database read alone does
  not yield a working second factor.
- `totpRecoveryCodes` are argon2 hashes of one-time codes, consumed on use.
- Disabling 2FA requires re-entering the password.

---

## RBAC

`Role` × `Permission`, joined by `RolePermission`. Permission keys are
`resource:action`.

Actions: `read` (list + detail), `write` (create + update), `delete`,
`publish`. **`publish` is separate from `write` on purpose** — an editor may
draft freely while only the owner decides what goes live.

| Role          | Grants                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------- |
| `SUPER_ADMIN` | Everything (104 permissions). TOTP mandatory.                                            |
| `EDITOR`      | All content and enquiries (91). No users, roles, settings, redirects, or media deletion. |
| `VIEWER`      | Read-only (28). No users or roles.                                                       |

Media deletion is withheld from `EDITOR` because it cascades into published
pages.

Seeded by `seed:system`, which is idempotent and **replaces the grant set
wholesale** — so removing a permission from `seed/data/rbac.ts` actually
revokes it on the next deploy rather than leaving it granted forever.

### Enforcement

```ts
@Controller('admin/events')
@UseGuards(JwtAccessGuard, PermissionsGuard)
export class EventsAdminController {
  @Patch(':id/publish')
  @RequirePermissions('event:publish')
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    /* ... */
  }
}
```

The global guard chain is Throttler → JwtAccess → Permissions, registered in
that order, and **denies by default**. `@Public()` opts out. Nothing is ever
protected by accident of omission.

**The API is the only enforcement point.** Admin UI gating — rendering the
sidebar from the session's permission set, and the `<Can>` component — is UX,
not security. It is done server-side rather than by hiding elements with CSS,
but it is still not the control.

---

## Other controls

- **CSRF** — double-submit token on every cookie-authenticated write. The
  refresh cookie is `SameSite=Strict`, but the token is defence in depth.
- **Audit** — every auth action writes an `AuditLog` row: `LOGIN`,
  `LOGIN_FAILED`, `LOGOUT`, `LOGOUT_ALL`, `PASSWORD_CHANGE`, `TOKEN_REFRESH`,
  `TOKEN_REUSE_DETECTED`, `TWO_FA_ENABLE`, `TWO_FA_DISABLE`, `ROLE_CHANGE`.
- **Login alerts** — email on login from a new IP or user agent.
- **JWT secret rotation** — a dual-secret verification window, so rotating does
  not log everyone out. Runbook:
  [`../05-operations/runbooks/secret-rotation.md`](../05-operations/runbooks/secret-rotation.md).

---

## Phase 3 exit criteria

The e2e matrix must cover:

- login success, wrong password, unknown email (identical response and timing),
  locked account
- refresh rotation; **reuse of a rotated token revokes the family**
- 2FA enrolment, verification, and the recovery-code path
- every role against every endpoint class
- CSRF rejection
- `logout-all` and password-change revocation

Plus: `auth/` at 100% coverage, and an `AuditLog` row for every auth action.
