import { Injectable } from '@nestjs/common';

import { MEDIA_IMAGE_SELECT } from '../../common/base';
import { PrismaService } from '../../infra/prisma/prisma.service';

const INCLUDE = {
  logo: { select: MEDIA_IMAGE_SELECT },
  defaultOgImage: { select: MEDIA_IMAGE_SELECT },
  homeHeroVideoMedia: { select: { secureUrl: true } },
  homeHeroImageMedia: { select: MEDIA_IMAGE_SELECT },
} as const;

const SINGLETON_ID = 'singleton';

/** The scalar columns `SettingsService.update()` may set. */
export interface SettingsUpdateData {
  siteName?: string;
  siteTagline?: string | null;
  logoId?: string | null;
  homeHeroVideoMediaId?: string | null;
  homeHeroImageMediaId?: string | null;
  contactEmail?: string;
  bookingEmail?: string | null;
  contactPhone?: string | null;
  whatsappNumber?: string | null;
  addressCity?: string | null;
  addressRegion?: string | null;
  addressCountry?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  googleMapsUrl?: string | null;
  serviceAreaText?: string | null;
  defaultSeoTitle?: string | null;
  defaultSeoDescription?: string | null;
  defaultOgImageId?: string | null;
  twitterHandle?: string | null;
  defaultAccentColor?: string;
  featureBlogEnabled?: boolean;
  featureNewsletterEnabled?: boolean;
  featureShopEnabled?: boolean;
  bookingFormEnabled?: boolean;
  maintenanceMode?: boolean;
  responseTimePromise?: string | null;
  homeHeroEyebrow?: string | null;
  homeHeroHeadline?: string | null;
  homeHeroSubheadline?: string | null;
  homeClosingHeadline?: string | null;
  homeClosingSubheadline?: string | null;
  homeShowIdentities?: boolean;
  homeShowShows?: boolean;
  homeShowDiscography?: boolean;
  homeShowResidencies?: boolean;
  homeShowVenues?: boolean;
  homeShowGallery?: boolean;
  homeShowVideos?: boolean;
  homeShowServices?: boolean;
  homeShowTestimonials?: boolean;
}

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `upsert`, not `findUnique`: the singleton row is seeded by `seed:system`
   * in every real environment, but a scratch test database may not have run
   * it yet, and `SiteSettings` has no create endpoint of its own — this is
   * the only write path that can ever produce the row.
   */
  async get() {
    return this.prisma.client.siteSettings.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
      include: INCLUDE,
    });
  }

  async update(data: SettingsUpdateData) {
    return this.prisma.client.siteSettings.upsert({
      where: { id: SINGLETON_ID },
      update: data,
      create: { id: SINGLETON_ID, ...data },
      include: INCLUDE,
    });
  }
}
