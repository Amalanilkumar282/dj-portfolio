import { Inject, Injectable } from '@nestjs/common';

import type {
  ContentChangedEvent,
  SiteSettingsAdminDetail,
  SiteSettingsDetail,
  SiteSettingsUpdateInput,
} from '@dj/contracts';
import { AuditAction } from '@dj/db';

import type { DomainEventBus } from '../../common/base';
import { DOMAIN_EVENT_BUS } from '../../common/events';
import { CONTENT_CHANGED } from '../../infra/revalidation/revalidation.service';
import { AuditService } from '../audit/audit.service';

import { toSettingsAdminDetail, toSettingsDetail } from './settings.mapper';
import { SettingsRepository, type SettingsUpdateData } from './settings.repository';

/**
 * The `SiteSettings` singleton. No create, no delete, no list — every write
 * is a `PATCH` against the one row, enforced at the database level by a
 * `CHECK (id = 'singleton')` constraint in `post-migrate.sql`.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly repository: SettingsRepository,
    private readonly audit: AuditService,
    @Inject(DOMAIN_EVENT_BUS) private readonly events: DomainEventBus,
  ) {}

  async getPublic(): Promise<SiteSettingsDetail> {
    return toSettingsDetail(await this.repository.get());
  }

  async getAdmin(): Promise<SiteSettingsAdminDetail> {
    return toSettingsAdminDetail(await this.repository.get());
  }

  async update(input: SiteSettingsUpdateInput): Promise<SiteSettingsAdminDetail> {
    const data: SettingsUpdateData = {};

    if (input.siteName !== undefined) data.siteName = input.siteName;
    if (input.siteTagline !== undefined) data.siteTagline = input.siteTagline;
    if (input.logoId !== undefined) data.logoId = input.logoId;
    if (input.homeHeroVideoMediaId !== undefined) data.homeHeroVideoMediaId = input.homeHeroVideoMediaId;
    if (input.homeHeroImageMediaId !== undefined) data.homeHeroImageMediaId = input.homeHeroImageMediaId;
    if (input.contactEmail !== undefined) data.contactEmail = input.contactEmail;
    if (input.bookingEmail !== undefined) data.bookingEmail = input.bookingEmail;
    if (input.contactPhone !== undefined) data.contactPhone = input.contactPhone;
    if (input.whatsappNumber !== undefined) data.whatsappNumber = input.whatsappNumber;
    if (input.addressCity !== undefined) data.addressCity = input.addressCity;
    if (input.addressRegion !== undefined) data.addressRegion = input.addressRegion;
    if (input.addressCountry !== undefined) data.addressCountry = input.addressCountry;
    if (input.latitude !== undefined) data.latitude = input.latitude;
    if (input.longitude !== undefined) data.longitude = input.longitude;
    if (input.googleMapsUrl !== undefined) data.googleMapsUrl = input.googleMapsUrl;
    if (input.serviceAreaText !== undefined) data.serviceAreaText = input.serviceAreaText;
    if (input.defaultSeoTitle !== undefined) data.defaultSeoTitle = input.defaultSeoTitle;
    if (input.defaultSeoDescription !== undefined) data.defaultSeoDescription = input.defaultSeoDescription;
    if (input.defaultOgImageId !== undefined) data.defaultOgImageId = input.defaultOgImageId;
    if (input.twitterHandle !== undefined) data.twitterHandle = input.twitterHandle;
    if (input.defaultAccentColor !== undefined) data.defaultAccentColor = input.defaultAccentColor;
    if (input.featureBlogEnabled !== undefined) data.featureBlogEnabled = input.featureBlogEnabled;
    if (input.featureNewsletterEnabled !== undefined) {
      data.featureNewsletterEnabled = input.featureNewsletterEnabled;
    }
    if (input.featureShopEnabled !== undefined) data.featureShopEnabled = input.featureShopEnabled;
    if (input.bookingFormEnabled !== undefined) data.bookingFormEnabled = input.bookingFormEnabled;
    if (input.maintenanceMode !== undefined) data.maintenanceMode = input.maintenanceMode;
    if (input.responseTimePromise !== undefined) data.responseTimePromise = input.responseTimePromise;

    const updated = await this.repository.update(data);

    await this.audit.record({
      action: AuditAction.SETTINGS_UPDATE,
      entityType: 'SiteSettings',
      entityId: 'singleton',
      metadata: { changed: Object.keys(input) },
    });

    // Settings touch the header, footer and default SEO on every page — the
    // one entity that legitimately invalidates broadly. See TAG_MAP.
    this.events.emit(CONTENT_CHANGED, {
      entity: 'settings',
      id: 'singleton',
      action: 'update',
    } satisfies ContentChangedEvent);

    return toSettingsAdminDetail(updated);
  }
}
