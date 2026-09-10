-- ============================================================================
--  Post-migration SQL: database objects Prisma cannot express.
--
--  WHY THIS IS NOT A PRISMA MIGRATION
--  Prisma has no datamodel syntax for partial indexes, CHECK constraints or
--  GENERATED columns. If they live inside prisma/migrations, then
--  `prisma migrate diff --from-migrations --to-schema-datamodel` reports every
--  one of them as a pending removal, and the `migrate:check` CI gate — whose
--  entire job is catching "someone edited schema.prisma without generating a
--  migration" — can never pass. Keeping prisma/migrations purely
--  Prisma-generated makes that gate exact.
--
--  CONTRACT
--  Every statement here MUST be idempotent (IF NOT EXISTS / DROP IF EXISTS),
--  because this file is re-applied after every `migrate deploy` — locally via
--  `pnpm db:post-migrate`, and in the Railway pre-deploy command.
--
--  Column names are Prisma-default camelCase (quoted); only table names are
--  snake_case, via @@map.
--
--  Verified by src/__tests__/schema.int-spec.ts, which asserts every index
--  and constraint below actually exists — otherwise a run that silently
--  skipped this file would leave the database slow and permissive with
--  nothing to show for it.
--
--  See docs/05-operations/migrations.md
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Partial indexes for published content
--    The highest-leverage item in the schema. The public site only ever reads
--    PUBLISHED, non-deleted rows, so indexing that subset turns the hot
--    queries into index-only scans over a fraction of each table.
-- ----------------------------------------------------------------------------

-- Upcoming events. `isPast` is maintained by the hourly cron so this stays a
-- boolean predicate: Postgres rejects non-immutable now() in an index
-- predicate outright.
CREATE INDEX IF NOT EXISTS "events_published_upcoming"
  ON "events" ("startsAt" ASC)
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL AND "isPast" = false;

CREATE INDEX IF NOT EXISTS "events_published_past"
  ON "events" ("startsAt" DESC)
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL AND "isPast" = true;

CREATE INDEX IF NOT EXISTS "tracks_published_ordered"
  ON "tracks" ("sortIndex" ASC, "releaseDate" DESC)
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "tracks_published_featured"
  ON "tracks" ("sortIndex" ASC)
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL AND "isFeatured" = true;

CREATE INDEX IF NOT EXISTS "playlists_published_ordered"
  ON "playlists" ("sortIndex" ASC)
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "personas_published_ordered"
  ON "personas" ("sortIndex" ASC)
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "posts_published_recent"
  ON "posts" ("publishedAt" DESC)
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "testimonials_published_featured"
  ON "testimonials" ("sortIndex" ASC)
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;

-- Scheduled-publish sweep: the five-minute cron scans exactly this set.
CREATE INDEX IF NOT EXISTS "personas_scheduled" ON "personas" ("scheduledAt")
  WHERE "status" = 'DRAFT' AND "scheduledAt" IS NOT NULL AND "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "tracks_scheduled" ON "tracks" ("scheduledAt")
  WHERE "status" = 'DRAFT' AND "scheduledAt" IS NOT NULL AND "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "events_scheduled" ON "events" ("scheduledAt")
  WHERE "status" = 'DRAFT' AND "scheduledAt" IS NOT NULL AND "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "posts_scheduled" ON "posts" ("scheduledAt")
  WHERE "status" = 'DRAFT' AND "scheduledAt" IS NOT NULL AND "deletedAt" IS NULL;

-- Media orphan sweeper: soft-deleted assets awaiting the Cloudinary purge.
CREATE INDEX IF NOT EXISTS "media_assets_pending_purge"
  ON "media_assets" ("deletedAt" ASC)
  WHERE "deletedAt" IS NOT NULL;

-- Inquiry notification retry: rows whose notification email has not gone out.
-- A dropped notification costs a booking, so this scan runs every night.
CREATE INDEX IF NOT EXISTS "booking_inquiries_pending_notify"
  ON "booking_inquiries" ("createdAt" ASC)
  WHERE "notifiedAt" IS NULL AND "status" <> 'SPAM' AND "deletedAt" IS NULL;

-- ----------------------------------------------------------------------------
-- 2. Weighted full-text search on blog posts
--    A GENERATED column, so the vector can never drift from the content it
--    indexes. Deliberately absent from schema.prisma: no application code
--    reads or writes it, only the raw-SQL search query does.
--
--    `to_tsvector` with an explicit regconfig literal is immutable, which is
--    what makes it legal in a GENERATED ALWAYS expression.
-- ----------------------------------------------------------------------------
ALTER TABLE "posts"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("excerpt", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("contentText", '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS "posts_search_idx"
  ON "posts" USING gin ("searchVector");

-- ----------------------------------------------------------------------------
-- 3. Integrity guards
--    Each of these encodes an invariant the application also enforces. Having
--    it at the storage layer too means a bug in a service, a bad migration or
--    a manual psql session cannot leave the database in a state that would
--    render a broken page or emit invalid structured data.
-- ----------------------------------------------------------------------------

-- site_settings is a singleton. Without this, a second row is one careless
-- `create` away and the site would silently read whichever came back first.
ALTER TABLE "site_settings" DROP CONSTRAINT IF EXISTS "site_settings_singleton";
ALTER TABLE "site_settings"
  ADD CONSTRAINT "site_settings_singleton" CHECK ("id" = 'singleton');

-- A rating is absent or 1-5. Out of range would emit invalid Review JSON-LD.
ALTER TABLE "testimonials" DROP CONSTRAINT IF EXISTS "testimonials_rating_range";
ALTER TABLE "testimonials"
  ADD CONSTRAINT "testimonials_rating_range"
  CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5));

-- Price and budget bands must not be inverted.
ALTER TABLE "services" DROP CONSTRAINT IF EXISTS "services_price_band";
ALTER TABLE "services"
  ADD CONSTRAINT "services_price_band"
  CHECK ("priceFrom" IS NULL OR "priceTo" IS NULL OR "priceFrom" <= "priceTo");

ALTER TABLE "booking_inquiries" DROP CONSTRAINT IF EXISTS "booking_inquiries_budget_band";
ALTER TABLE "booking_inquiries"
  ADD CONSTRAINT "booking_inquiries_budget_band"
  CHECK ("budgetMin" IS NULL OR "budgetMax" IS NULL OR "budgetMin" <= "budgetMax");

ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_ticket_price_band";
ALTER TABLE "events"
  ADD CONSTRAINT "events_ticket_price_band"
  CHECK (
    "ticketPriceMin" IS NULL OR "ticketPriceMax" IS NULL
    OR "ticketPriceMin" <= "ticketPriceMax"
  );

-- An event cannot end before it starts.
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_time_order";
ALTER TABLE "events"
  ADD CONSTRAINT "events_time_order"
  CHECK ("endsAt" IS NULL OR "endsAt" >= "startsAt");

-- A past role must not end before it began.
ALTER TABLE "experience_entries" DROP CONSTRAINT IF EXISTS "experience_entries_date_order";
ALTER TABLE "experience_entries"
  ADD CONSTRAINT "experience_entries_date_order"
  CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

-- PUBLISHED content must carry a publishedAt, so sitemap lastmod and the
-- Article/Event/MusicRecording JSON-LD date fields are never null on a live
-- page.
ALTER TABLE "personas" DROP CONSTRAINT IF EXISTS "personas_published_has_date";
ALTER TABLE "personas"
  ADD CONSTRAINT "personas_published_has_date"
  CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL);

ALTER TABLE "tracks" DROP CONSTRAINT IF EXISTS "tracks_published_has_date";
ALTER TABLE "tracks"
  ADD CONSTRAINT "tracks_published_has_date"
  CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL);

ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_published_has_date";
ALTER TABLE "events"
  ADD CONSTRAINT "events_published_has_date"
  CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL);

ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_published_has_date";
ALTER TABLE "posts"
  ADD CONSTRAINT "posts_published_has_date"
  CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL);

-- Alt text is required on in-page images. The admin blocks publish without it;
-- this makes the invariant true at the storage layer too. The legacy site had
-- no alt text on any of its 33 images. OG images and logos are exempt: they
-- are never rendered as page content.
ALTER TABLE "media_assets" DROP CONSTRAINT IF EXISTS "media_assets_image_alt_text";
ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_image_alt_text"
  CHECK (
    "resourceType" <> 'IMAGE'
    OR "purpose" IN ('OG_IMAGE', 'LOGO')
    OR "altText" IS NOT NULL
  );
