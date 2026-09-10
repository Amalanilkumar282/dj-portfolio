# Security

Auth-specific detail is in
[`../02-architecture/auth-and-rbac.md`](../02-architecture/auth-and-rbac.md).
This is the checklist for everything else.

## Headers

| Header                      | Value                                                   |
| --------------------------- | ------------------------------------------------------- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload`          |
| `Content-Security-Policy`   | nonce-based, `'strict-dynamic'`, **no `unsafe-inline`** |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                       |
| `Permissions-Policy`        | camera, microphone, geolocation denied                  |
| `X-Content-Type-Options`    | `nosniff`                                               |
| `X-Frame-Options`           | `DENY` on admin                                         |

CSP allowlist:

```
script-src   'self' 'nonce-{n}' 'strict-dynamic'
img-src      'self' data: blob: res.cloudinary.com
media-src    'self' res.cloudinary.com
frame-src    w.soundcloud.com open.spotify.com www.youtube-nocookie.com
             challenges.cloudflare.com
connect-src  'self' plausible.io
font-src     'self'
```

Only three embed hosts, and `youtube-nocookie` rather than `youtube`. JSON-LD
and the theme bootstrap use nonces, which is what makes dropping
`unsafe-inline` possible at all.

## Input

- `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` globally.
  An unknown property is a **422**, not silently dropped — silent dropping is
  how frontends ship irreproducible bugs.
- Zod on every body, query and param.
- `@db.VarChar` caps on user-facing strings.
- `express.json({ limit: '256kb' })`. Uploads bypass the API entirely — that is
  the point of direct-to-Cloudinary
  ([ADR 0008](../01-decisions/0008-cloudinary-signed-direct-upload.md)).
- **HTML and oEmbed markup are sanitised on write, not on render**, so every
  consumer is safe by default rather than each one having to remember.

## Injection

Prisma parameterises everything. The few raw sites use `Prisma.sql` tagged
templates, and `$queryRawUnsafe` / `$executeRawUnsafe` are banned by lint. The
one exception is `packages/db/scripts/post-migrate.ts`, which executes a
trusted version-controlled DDL file with no interpolation, and carries a
line-level disable saying so.

Rich text is stored as **Tiptap JSON, never HTML**
([ADR 0010](../01-decisions/0010-tiptap-json-storage.md)). There is no HTML
string to sanitise, because the renderer only renders node types it recognises.
That is a structural XSS defence rather than a filtering one.

## Rate limits

| Endpoint                       | Limit                                         |
| ------------------------------ | --------------------------------------------- |
| Global                         | 120/min/IP                                    |
| `POST /auth/login`             | 10/15min/IP + per-account exponential lockout |
| `POST /inquiries`              | 3/hour/IP + Turnstile + honeypot + spam score |
| `POST /newsletter/subscribe`   | 5/hour/IP, double opt-in                      |
| `POST /analytics/page-view`    | 60/min/IP                                     |
| `POST /media/upload-signature` | 30/min/user                                   |

The booking form has four layers because it is the one unauthenticated write
that creates a row and sends email. Spam score is a heuristic over link count,
all-caps ratio and disposable-email domains; high scores go to `SPAM` **without
notifying**.

## Secrets

- Never committed. `gitleaks` in CI.
- `CLOUDINARY_API_SECRET` is server-only and never reaches a frontend.
- `totpSecret` is AES-256-GCM encrypted at rest, so a database read alone does
  not yield a working second factor.
- JWT rotation uses a dual-secret verification window, so rotating does not log
  everyone out. See [`runbooks/secret-rotation.md`](runbooks/secret-rotation.md).

> **Outstanding:** the legacy repository had a live-looking Resend API key
> committed in `djfelicitous/.env.local`. That directory has been deleted, but
> the key may still be valid in the Resend account and may exist in backups.
> **Rotate it.**
> [`../06-roadmap/STATUS.md`](../06-roadmap/STATUS.md) gap #3.

## Personal data

Inventory:

| Data                                | Where                          | Retention                                                 |
| ----------------------------------- | ------------------------------ | --------------------------------------------------------- |
| Enquiry name, email, phone, message | `booking_inquiries`            | Indefinite (business record); `SPAM` purged after 30 days |
| Subscriber email                    | `newsletter_subscribers`       | Until unsubscribe                                         |
| `PageView.visitorHash`              | `page_views`                   | Raw rows 90 days, then rolled up                          |
| `ipHash`                            | inquiries, subscribers         | With the parent row                                       |
| Admin login IP and user agent       | `refresh_tokens`, `audit_logs` | Tokens pruned on expiry; audit 2 years                    |

**No raw IP addresses are stored anywhere.** `visitorHash` and `ipHash` are
salted daily hashes, which is what keeps the analytics cookieless and
consent-free under GDPR.

Retention: raw page views 90 days · audit logs 2 years · soft-deleted content
30 days then purged · spam enquiries 30 days.

Subject access request: [`runbooks/dsar.md`](runbooks/dsar.md).

## Dependencies

- Dependabot, weekly, grouped.
- `pnpm audit --audit-level=high` gates CI.
- `pnpm.overrides` for transitive fixes.
- Lockfile committed; `--frozen-lockfile` in CI.

## Access

- GitHub branch protection on `main`: PR required, CI must pass, no force push.
- 2FA on GitHub, Vercel, Railway, Neon, Cloudinary and Resend.
- Least-privilege API tokens for CI.
- One `SUPER_ADMIN` in production, with TOTP mandatory. Additional people get
  `EDITOR`.

## Pre-launch review (Phase 12)

- [ ] `pnpm security-review` and a manual pass over this document
- [ ] CSP tightened with no `unsafe-inline`; verify no console violations
- [ ] `SWAGGER_ENABLED=false` in production and `/api/docs` unreachable
- [ ] Auth e2e matrix green, `auth/` at 100% coverage
- [ ] Rate limits verified by load test
- [ ] `gitleaks` clean over full history
- [ ] `pnpm audit` clean at high and above
- [ ] Legacy Resend key rotated
- [ ] A restore drill completed — an untested backup is not a backup
- [ ] All platform accounts on 2FA
- [ ] Runbooks written and dated
