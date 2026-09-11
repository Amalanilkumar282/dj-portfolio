-- Six publishable models were missing `scheduledAt`, found while building the
-- Venues content module (Phase 4): every other publishable model carries
-- status + publishedAt + scheduledAt per the schema's own header comment, but
-- Venue, Brand, ExperienceEntry, GearItem, Faq and PressAsset only had the
-- first two. `BaseContentService.schedule()` needs the column on every model
-- it is used against, so this closes the gap for all six at once rather than
-- one at a time as each module gets built. See ADR 0019.

-- AlterTable
ALTER TABLE "brands" ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "experience_entries" ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "faqs" ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "gear_items" ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "press_assets" ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "venues" ADD COLUMN     "scheduledAt" TIMESTAMP(3);
