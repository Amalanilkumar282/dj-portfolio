# Observability

## Structured logging

Pino, JSON to stdout, drained by Railway. Every line carries `reqId`, `userId`,
`route`, `statusCode` and `responseTime`.

`reqId` honours an inbound `x-request-id` and is echoed in the response — which
is what makes a user-reported error traceable. It also appears in every RFC
9457 problem response as `requestId`, so a screenshot of an error is enough to
find the log line.

**Redacted:** `authorization`, `cookie`, `set-cookie`, `password`,
`currentPassword`, `totp`. Add to the redaction list whenever a new sensitive
field appears — an access log with a password in it is a breach.

`/health` is excluded from access logging, or the uptime monitor drowns
everything else.

## Business events as first-class logs

```ts
log.info({ event: 'inquiry.created', reference, city, eventType }, 'inquiry created');
log.info({ event: 'content.published', entity: 'track', slug }, 'content published');
```

"How many booking enquiries last month?" is then answerable from logs without
touching the database. Events worth logging: `inquiry.created`,
`inquiry.status_changed`, `content.published`, `media.uploaded`,
`auth.login_failed`, `token.reuse_detected`, `mail.failed`,
`cloudinary.drift`, `revalidate.failed`.

## Sentry

`@sentry/nestjs` in the API with `SentryGlobalFilter` **ahead of**
`AllExceptionsFilter`, and `@sentry/nextjs` in both frontends.

`tracesSampleRate: 0.2` in production, `1.0` in development.
`profilesSampleRate: 0.1`. Releases tagged with the git SHA; source maps
uploaded in CI.

`beforeSend` scrubs `password`, `token`, `cookie`, `authorization` and **email
addresses from enquiry payloads** — an enquiry body in an error report is
personal data leaving the system.

Session replay off by default.

## Alerts

| Condition                               | Route                                                            |
| --------------------------------------- | ---------------------------------------------------------------- |
| `/health/ready` failing 2 minutes       | WhatsApp + email                                                 |
| Public site down 5 minutes              | WhatsApp + email                                                 |
| Error rate spike (Sentry)               | Email                                                            |
| `token.reuse_detected`                  | Email — **investigate immediately**, it means a token was stolen |
| `mail.failed` on a booking notification | WhatsApp — this is lost revenue                                  |
| `cloudinary.drift` non-zero             | Email, weekly digest                                             |
| `revalidate.failed` repeatedly          | Email — content is not reaching the site                         |
| Neon storage or compute nearing quota   | Email                                                            |

The two that matter most are the booking-notification failure and
`token.reuse_detected`: one costs money directly, the other is a security
incident.

## Uptime

Better Stack or UptimeRobot:

- `GET https://api.djfelicitous.com/health/ready` every minute
- `GET https://djfelicitous.com` every 5 minutes
- `GET https://admin.djfelicitous.com/login` every 15 minutes

## Core Web Vitals

Vercel Speed Insights for real-user data, plus a `web-vitals` beacon posting to
`POST /api/v1/analytics/page-view`, rolled up nightly into `DailyMetric`
(`lcpP75Ms`, `inpP75Ms`, `clsP75`) and surfaced on the admin dashboard.

Lighthouse CI runs on every preview deploy with the budgets from
[`../02-architecture/frontend.md`](../02-architecture/frontend.md) as hard
assertions. Field data and lab data disagree; both are tracked.

## Slow queries

```ts
prisma.$on('query', (e) => {
  if (e.duration > 200) log.warn({ query: e.query, duration: e.duration }, 'slow_query');
});
```

Sampled in production. In development a query **counter** warns above 8 per
request — the N+1 canary, enforced by the e2e suite.

## Metrics

Railway's built-in CPU, memory and RPS graphs are sufficient at launch.
`@willsoto/nestjs-prometheus` exposes `/metrics` behind an API key but is not
scraped until there is a Grafana to point at it. Deliberately not built yet.

## Debugging a production issue

1. **Get the `requestId`** from the error response or the user's screenshot.
2. Search Railway logs for it — you get the full request context.
3. Check Sentry for the stack trace on the same release.
4. If it is data-shaped, reproduce against a Neon branch from before the
   incident rather than against production.
5. If content is not appearing, use the checklist in
   [`../02-architecture/caching-and-revalidation.md`](../02-architecture/caching-and-revalidation.md)
   — it is usually a `REVALIDATE_SECRET` mismatch.
6. Record anything non-obvious in [`runbooks/incident.md`](runbooks/incident.md).
