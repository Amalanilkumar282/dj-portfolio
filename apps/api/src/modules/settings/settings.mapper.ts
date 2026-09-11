import type { SiteSettingsAdminDetail, SiteSettingsDetail } from '@dj/contracts';

import { toMediaImage, type MediaAssetRow } from '../../common/base';

interface SettingsRow {
  siteName: string;
  siteTagline: string | null;
  logo: MediaAssetRow | null;
  contactEmail: string;
  bookingEmail: string | null;
  contactPhone: string | null;
  whatsappNumber: string | null;
  addressCity: string | null;
  addressRegion: string | null;
  addressCountry: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string | null;
  serviceAreaText: string | null;
  defaultSeoTitle: string | null;
  defaultSeoDescription: string | null;
  defaultOgImage: MediaAssetRow | null;
  twitterHandle: string | null;
  defaultAccentColor: string;
  featureBlogEnabled: boolean;
  featureNewsletterEnabled: boolean;
  featureShopEnabled: boolean;
  bookingFormEnabled: boolean;
  maintenanceMode: boolean;
  responseTimePromise: string | null;
  updatedAt: Date;
}

export function toSettingsDetail(row: SettingsRow): SiteSettingsDetail {
  return {
    siteName: row.siteName,
    siteTagline: row.siteTagline,
    logo: toMediaImage(row.logo),
    contactEmail: row.contactEmail,
    bookingEmail: row.bookingEmail,
    contactPhone: row.contactPhone,
    whatsappNumber: row.whatsappNumber,
    addressCity: row.addressCity,
    addressRegion: row.addressRegion,
    addressCountry: row.addressCountry,
    latitude: row.latitude,
    longitude: row.longitude,
    googleMapsUrl: row.googleMapsUrl,
    serviceAreaText: row.serviceAreaText,
    defaultSeoTitle: row.defaultSeoTitle,
    defaultSeoDescription: row.defaultSeoDescription,
    defaultOgImage: toMediaImage(row.defaultOgImage),
    twitterHandle: row.twitterHandle,
    defaultAccentColor: row.defaultAccentColor,
    featureBlogEnabled: row.featureBlogEnabled,
    featureNewsletterEnabled: row.featureNewsletterEnabled,
    featureShopEnabled: row.featureShopEnabled,
    bookingFormEnabled: row.bookingFormEnabled,
    maintenanceMode: row.maintenanceMode,
    responseTimePromise: row.responseTimePromise,
  };
}

export function toSettingsAdminDetail(row: SettingsRow): SiteSettingsAdminDetail {
  return { ...toSettingsDetail(row), updatedAt: row.updatedAt };
}
