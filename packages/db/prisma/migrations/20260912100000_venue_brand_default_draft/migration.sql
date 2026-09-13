-- Venue and Brand were the only two publishable models defaulting to
-- PUBLISHED at the column level; every other publishable model defaults to
-- DRAFT. A create call that omits `status` (the admin's "New venue" form,
-- and any future one that does the same) relied on `VenuesService.create()`
-- only setting `publishedAt` when `status` was *explicitly* passed — so an
-- omitted status hit this column default of PUBLISHED with a null
-- `publishedAt`, and the `venues_published_has_date` CHECK constraint
-- (added under ADR 0019) rejected the insert with a raw 500. Found via the
-- Group E admin "New venue" screen. Existing rows are untouched; this only
-- changes what a future omitted-status insert defaults to.
ALTER TABLE "venues" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE "brands" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
