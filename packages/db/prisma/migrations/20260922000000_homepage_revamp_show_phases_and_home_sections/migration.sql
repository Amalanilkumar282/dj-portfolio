-- AlterTable
ALTER TABLE "events" ADD COLUMN     "earlyBirdPriceMax" DECIMAL(10,2),
ADD COLUMN     "earlyBirdUntil" TIMESTAMP(3),
ADD COLUMN     "onSaleFrom" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "homeClosingHeadline" TEXT,
ADD COLUMN     "homeClosingSubheadline" TEXT,
ADD COLUMN     "homeHeroEyebrow" TEXT,
ADD COLUMN     "homeHeroHeadline" TEXT,
ADD COLUMN     "homeHeroSubheadline" TEXT,
ADD COLUMN     "homeShowDiscography" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "homeShowGallery" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "homeShowIdentities" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "homeShowResidencies" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "homeShowServices" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "homeShowShows" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "homeShowTestimonials" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "homeShowVenues" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "homeShowVideos" BOOLEAN NOT NULL DEFAULT true;

