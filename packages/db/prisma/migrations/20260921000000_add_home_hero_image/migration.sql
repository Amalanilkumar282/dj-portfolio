-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN "homeHeroImageMediaId" TEXT;

-- AddForeignKey
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_homeHeroImageMediaId_fkey" FOREIGN KEY ("homeHeroImageMediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
