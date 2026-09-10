# Runbook — secret rotation

Rotate on a schedule, and immediately on any suspicion of compromise.

| Secret                | Cadence                    | Rotating it logs admins out?         |
| --------------------- | -------------------------- | ------------------------------------ |
| `JWT_ACCESS_SECRET`   | 6 months                   | No, with the dual-secret window      |
| `JWT_REFRESH_SECRET`  | 6 months                   | **Yes**, unless the window is used   |
| `COOKIE_SECRET`       | 6 months                   | Yes                                  |
| `API_KEY`             | 12 months                  | No                                   |
| `REVALIDATE_SECRET`   | 12 months                  | No                                   |
| `PREVIEW_TOKEN`       | 12 months                  | No                                   |
| `TOTP_ENCRYPTION_KEY` | **Do not rotate casually** | See below                            |
| `ANALYTICS_HASH_SALT` | Do not rotate casually     | Breaks visitor-uniqueness continuity |
| Cloudinary API secret | 12 months                  | No                                   |
| Resend API key        | 12 months                  | No                                   |
| Database password     | 12 months                  | No                                   |

## JWT secrets — the dual-secret window

Rotating naively invalidates every live token and logs everyone out. With one
extra environment variable it does not.

1. Generate the new secret: `openssl rand -base64 48`.
2. Set `JWT_ACCESS_SECRET_PREVIOUS` to the **current** value, and
   `JWT_ACCESS_SECRET` to the new one. Deploy.
3. The verifier tries the current secret, then the previous one. **Signing
   always uses the current one.** Existing tokens keep working; new tokens use
   the new secret.
4. Wait longer than the token TTL — 15 minutes for access, 30 days for refresh.
5. Remove `JWT_ACCESS_SECRET_PREVIOUS`. Deploy.

For `JWT_REFRESH_SECRET` the window is 30 days, which is a long time to hold
two secrets. In a compromise you do **not** want the window at all — rotate
directly, log everyone out, and tell them to log in again. That is the point.

## `REVALIDATE_SECRET`

Shared between the API and `apps/web`. **A mismatch means published content
silently stops appearing** — the single most common cause of that symptom.

Rotate both together:

1. Set the new value in Vercel (`apps/web`) first and deploy.
2. Set it in Railway and deploy.
3. Between the two deploys, webhooks fail with 401 — they are retried, and the
   weekly `revalidate-all` cron is the backstop, so no content is permanently
   stale.
4. Verify: publish something trivial in admin and confirm it appears.

## `API_KEY`

The API must accept both during the overlap, or every page breaks between
deploys.

1. Add `API_KEY_PREVIOUS` on the API with the current value; set the new
   `API_KEY`. Deploy the API first.
2. Update `API_KEY` in both Vercel projects. Deploy.
3. Remove `API_KEY_PREVIOUS`. Deploy.

**API first.** Doing it the other way round takes the site down.

## `TOTP_ENCRYPTION_KEY` — read before touching

`totpSecret` values are encrypted with this key. Rotating it **without
re-encrypting makes every enrolled second factor unusable** and locks admins
out of their own accounts.

If it must be rotated:

1. Write a one-off script that decrypts every `totpSecret` with the old key and
   re-encrypts with the new one, in a single transaction.
2. Run it in a maintenance window, with a fresh database backup taken first.
3. Verify by logging in with TOTP before considering it done.

If it has been compromised, the safer path is to **disable 2FA for all users,
rotate, and require re-enrolment.** Losing enrolment is annoying; locking the
only owner out of production is worse.

## Cloudinary API secret

1. Generate an additional key pair in the Cloudinary console — do not delete
   the old one yet.
2. Update Railway and deploy.
3. Verify an upload end to end from admin.
4. Delete the old key pair.

The secret is server-only and never reaches a frontend, so no frontend deploy
is involved.

## Resend API key

1. Create a new key in Resend.
2. Update Railway and deploy.
3. **Send a real test enquiry and confirm both emails arrive.**
4. Revoke the old key.

> **Outstanding action:** the legacy repository committed a live-looking Resend
> key (`djfelicitous/.env.local`). That directory is deleted, but the key may
> still be valid and may exist in backups of that folder. **Revoke it in the
> Resend console.**
> [`../../06-roadmap/STATUS.md`](../../06-roadmap/STATUS.md) gap #3.

## Database password

1. Reset the role password in the Neon console.
2. Update `DATABASE_URL` and `DIRECT_URL` in Railway **and**
   `packages/db/.env` for anyone working locally.
3. Deploy. Expect a brief connection error as clients reconnect.
4. Update the 1Password entry.

## After any rotation

- [ ] Old secret revoked at the provider, not merely replaced in config
- [ ] 1Password updated
- [ ] `pnpm check:env` passes
- [ ] The affected path verified end to end — login, publish, upload, or email
- [ ] Date logged below

| Date | Secret   | Reason | By  |
| ---- | -------- | ------ | --- |
| —    | None yet |        |     |
