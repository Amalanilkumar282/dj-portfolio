# Runbook — incident response

## Triage

| Symptom                     | Severity                     | First check                                                                 |
| --------------------------- | ---------------------------- | --------------------------------------------------------------------------- |
| Public site down            | **P1**                       | Vercel status, then `/health/ready`                                         |
| Booking form failing        | **P1** — direct revenue loss | API logs for `POST /inquiries`                                              |
| Booking emails not arriving | **P1**                       | Resend dashboard, then `notifiedAt IS NULL` count                           |
| Admin cannot log in         | P2                           | API logs for `auth.login_failed`                                            |
| Content not updating        | P2                           | [Revalidation checklist](../../02-architecture/caching-and-revalidation.md) |
| Site slow                   | P2                           | Neon compute, Railway CPU, Sentry performance                               |
| Images not loading          | P3                           | Cloudinary status                                                           |

## P1 — public site down

1. Check <https://vercel-status.com>. If it is Vercel, there is nothing to do
   but communicate.
2. Otherwise check the last deploy. **Roll back in the Vercel dashboard** — it
   is instant and always the right first move. Diagnose afterwards.
3. If the site is up but pages error, the API is likely down. Note that
   _static_ pages should survive an API outage entirely; if they do not,
   something is dynamic that should not be.

## P1 — booking form failing

Every minute here is a potentially lost booking.

1. Check `POST /api/v1/inquiries` in the Railway logs. Look for the status code
   and the `requestId`.
2. **429?** Someone is being rate-limited, possibly legitimately. Check whether
   a single IP is hammering it.
3. **422?** A contract mismatch between web and API. Roll back whichever
   deployed most recently.
4. **500?** Read the Sentry trace. If the database is unreachable, see below.
5. **Immediate mitigation:** the WhatsApp deep link on `/contact` and `/book`
   does not depend on the API. If the form is broken and cannot be fixed
   quickly, make WhatsApp the prominent path.
6. Enquiries submitted during an outage are **lost** — there is no client-side
   queue. Say so honestly if the artist asks.

## P1 — booking emails not arriving

The enquiry rows may be fine while the notification is not.

```sql
SELECT count(*) FROM booking_inquiries
WHERE "notifiedAt" IS NULL AND status <> 'SPAM' AND "deletedAt" IS NULL;
```

1. A non-zero count means the retry cron has work pending or is failing. Check
   Railway logs for `mail.failed`.
2. Check the Resend dashboard for bounces, and check the domain's SPF, DKIM and
   DMARC records — a DNS change can silently break deliverability.
3. Trigger the retry job manually rather than waiting for 04:00.
4. **Check the artist's spam folder.** This is the single most common cause,
   and the least dramatic.
5. Meanwhile, read the pending enquiries out of the database and forward them
   by hand. Do not let a mail problem cost a booking.

## Database unreachable

1. Check the Neon console for the project status and compute state.
2. Confirm production has **scale-to-zero disabled** — if it was enabled, cold
   starts look exactly like an outage.
3. Check connection count against the quota. Exhaustion means
   `connection_limit` is wrong, or something is opening clients per request
   instead of reusing the singleton.
4. Confirm `DATABASE_URL` still points at the **pooler** endpoint with
   `pgbouncer=true`. Losing that parameter causes prepared-statement errors
   that read as random failures.

## Suspected compromise

Treat `token.reuse_detected` as a real incident, not noise. It means a refresh
token was presented twice, which usually means one was stolen.

1. The token family is already revoked automatically. Confirm in `audit_logs`.
2. `POST /auth/logout-all` for the affected user.
3. Force a password change and re-enrol TOTP.
4. Review `audit_logs` for that actor: what was created, changed or deleted?
5. Check `media_assets` for unexpected `deletedAt` stamps. The 30-day
   soft-delete window means media is recoverable.
6. Rotate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` —
   [`secret-rotation.md`](secret-rotation.md).
7. If content was destroyed, [`restore.md`](restore.md).

## Bad deploy that ran a migration

**Reverting the container does not revert the schema.** Prisma migrations are
forward-only.

1. Is the old code compatible with the new schema? Additive changes usually
   are, which is the entire reason destructive changes are expand/contract
   across two deploys.
2. If compatible: roll back the image and fix forward.
3. If not: write a new migration that reverses the change and deploy that. Do
   not hand-edit the migration history.
4. If data was lost, restore to a Neon branch from before the deploy, verify,
   then repoint.

## After any incident

Write it down here, dated: what happened, what the actual cause was, what was
done, and what would have prevented it. Add an alert if none fired, and a test
if one could have caught it.

| Date | Incident | Cause | Follow-up |
| ---- | -------- | ----- | --------- |
| —    | None yet |       |           |
