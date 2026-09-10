# Runbook — data subject access request

Someone asks what personal data you hold about them, or asks for it to be
deleted. Usually a past enquirer or a newsletter subscriber.

## What personal data exists

| Data                                       | Table                          | Source                   |
| ------------------------------------------ | ------------------------------ | ------------------------ |
| Name, email, phone, message, event details | `booking_inquiries`            | The booking form         |
| Internal notes about an enquiry            | `inquiry_notes`                | Admin                    |
| Email, name                                | `newsletter_subscribers`       | Footer signup            |
| `ipHash` (salted, not reversible)          | both above                     | Request metadata         |
| `visitorHash` (salted daily)               | `page_views`                   | Analytics                |
| Testimonial author name and quote          | `testimonials`                 | Provided for publication |
| Admin login IP and user agent              | `refresh_tokens`, `audit_logs` | Admin users only         |

**No raw IP addresses are stored anywhere.** Hashes are salted and not
reversible, so `page_views` cannot be linked back to an individual — which is
also why the analytics are cookieless and need no consent banner.

## 1. Verify identity

Do not act on an unverified email. Reply to the address **on record** and ask
them to confirm from it. Otherwise the request is itself a data leak.

## 2. Access request — what we hold

```sql
-- enquiries, with notes
SELECT i.*, n.body, n."createdAt" AS "noteCreatedAt"
FROM booking_inquiries i
LEFT JOIN inquiry_notes n ON n."inquiryId" = i.id
WHERE lower(i.email) = lower('<email>');

-- newsletter
SELECT email, name, status, "confirmedAt", "unsubscribedAt", source, tags
FROM newsletter_subscribers WHERE lower(email) = lower('<email>');

-- testimonials
SELECT "authorName", quote, "venueOrEvent", "eventDate", status
FROM testimonials WHERE "authorName" ILIKE '%<name>%';
```

Export as JSON or CSV and send it to the verified address.

**Include the internal notes.** They are personal data about the requester and
are in scope. Redact only genuinely third-party information — another
person's contact details mentioned in a note, for example.

## 3. Deletion request

Bear in mind a **completed booking is a business record** and there is a
legitimate-interest basis for retaining a minimal transaction record. What must
go is the contactable personal data.

```sql
BEGIN;

-- 1. remove notes, which may quote the person
DELETE FROM inquiry_notes
WHERE "inquiryId" IN (
  SELECT id FROM booking_inquiries WHERE lower(email) = lower('<email>')
);

-- 2. anonymise rather than delete, preserving the business record
UPDATE booking_inquiries SET
  name = 'Erased at request',
  email = concat('erased+', id, '@invalid'),   -- keeps the unique index usable
  phone = NULL,
  message = NULL,
  "venueText" = NULL,
  "ipHash" = NULL,
  "userAgent" = NULL,
  "utmSource" = NULL, "utmMedium" = NULL, "utmCampaign" = NULL,
  "referrerUrl" = NULL, "landingPath" = NULL
WHERE lower(email) = lower('<email>');

-- 3. newsletter: hard delete, there is no reason to keep it
DELETE FROM newsletter_subscribers WHERE lower(email) = lower('<email>');

COMMIT;
```

Then:

- **Unpublish and delete any testimonial** attributed to them, if asked.
  Remember content deletes are soft, so purge it or wait out the 30-day window.
- **Remove them from the Resend audience**, or they will still receive mail.
  This step is outside the database and is easy to forget.
- `page_views` needs nothing — the hash is not linkable.

Note the `booking_inquiries` soft-delete extension means a `DELETE` there
becomes an `UPDATE`. The anonymisation above is deliberate rather than a
workaround: it satisfies the request while keeping the row count and revenue
history intact.

## 4. Respond and record

Reply within **30 days** confirming what was done. Log it:

| Date | Type     | Subject | Action | By  |
| ---- | -------- | ------- | ------ | --- |
| —    | None yet |         |        |     |

Keep this log minimal — it is itself personal data.

## Retention that happens automatically

| Data                   | Retained                            |
| ---------------------- | ----------------------------------- |
| Raw `page_views`       | 90 days, then rolled up and dropped |
| `audit_logs`           | 2 years                             |
| Soft-deleted content   | 30 days, then purged                |
| `SPAM` enquiries       | 30 days                             |
| Expired refresh tokens | Pruned nightly                      |
| Idempotency keys       | 24 hours                            |

Cite these when answering a retention question.
