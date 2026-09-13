-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN "homeHeroVideoMediaId" TEXT;

-- AddForeignKey
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_homeHeroVideoMediaId_fkey" FOREIGN KEY ("homeHeroVideoMediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
