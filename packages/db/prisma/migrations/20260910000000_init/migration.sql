-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PersonaKey" AS ENUM ('FELICITOUS', 'TRINITROCOSMIC', 'TNT', 'COUPLE_DUO');

-- CreateEnum
CREATE TYPE "TrackType" AS ENUM ('ORIGINAL', 'REMIX', 'LIVE_SET', 'MIX', 'PODCAST', 'COLLABORATION');

-- CreateEnum
CREATE TYPE "ReleaseType" AS ENUM ('ALBUM', 'EP', 'SINGLE', 'COMPILATION');

-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('CLUB', 'FESTIVAL', 'WEDDING', 'CORPORATE', 'PRIVATE', 'RADIO', 'LIVESTREAM');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('ANNOUNCED', 'CONFIRMED', 'SOLD_OUT', 'CANCELLED', 'POSTPONED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MediaResourceType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'RAW');

-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('HERO', 'GALLERY', 'AVATAR', 'FLYER', 'COVER_ART', 'LOGO', 'PRESS_PHOTO', 'DOCUMENT', 'BACKGROUND_VIDEO', 'OG_IMAGE', 'GEAR');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('WEDDING', 'CORPORATE', 'CLUB', 'FESTIVAL', 'PRIVATE_PARTY', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'BOOKED', 'LOST', 'SPAM', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InquirySource" AS ENUM ('WEBSITE_FORM', 'INSTAGRAM', 'WHATSAPP', 'REFERRAL', 'EMAIL', 'PHONE', 'OTHER');

-- CreateEnum
CREATE TYPE "SubscriberStatus" AS ENUM ('PENDING', 'CONFIRMED', 'UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'PUBLISH', 'UNPUBLISH', 'ARCHIVE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'LOGOUT_ALL', 'PASSWORD_CHANGE', 'TOKEN_REFRESH', 'TOKEN_REUSE_DETECTED', 'ROLE_CHANGE', 'TWO_FA_ENABLE', 'TWO_FA_DISABLE', 'MEDIA_UPLOAD', 'MEDIA_DELETE', 'SETTINGS_UPDATE', 'MAIL_FAILED');

-- CreateEnum
CREATE TYPE "RedirectKind" AS ENUM ('PERMANENT', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('INR', 'USD', 'EUR', 'AED', 'GBP');

-- CreateEnum
CREATE TYPE "StreamPlatform" AS ENUM ('SPOTIFY', 'SOUNDCLOUD', 'YOUTUBE', 'APPLE_MUSIC', 'BEATPORT', 'BANDCAMP', 'MIXCLOUD', 'DEEZER', 'AMAZON_MUSIC');

-- CreateEnum
CREATE TYPE "PressAssetKind" AS ENUM ('LOGO_PACK', 'LOGO_SVG', 'HI_RES_PHOTO', 'TECH_RIDER', 'STAGE_PLOT', 'BIO_PDF', 'EPK_PDF', 'RIDER_HOSPITALITY');

-- CreateEnum
CREATE TYPE "GearCategory" AS ENUM ('MIXER', 'CDJ', 'CONTROLLER', 'TURNTABLE', 'DAW', 'MONITOR', 'SOFTWARE', 'OUTBOARD', 'MICROPHONE', 'LIGHTING');

-- CreateEnum
CREATE TYPE "ProficiencyLevel" AS ENUM ('FAMILIAR', 'PROFICIENT', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "VideoProvider" AS ENUM ('YOUTUBE', 'VIMEO', 'CLOUDINARY');

-- CreateEnum
CREATE TYPE "GalleryLayout" AS ENUM ('MASONRY', 'GRID', 'CAROUSEL', 'FILMSTRIP');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totpSecret" TEXT,
    "totpEnabledAt" TIMESTAMP(3),
    "totpRecoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "replacedById" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "diff" JSONB,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "userId" TEXT,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_meta" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "canonicalUrl" TEXT,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImageId" TEXT,
    "twitterCard" TEXT DEFAULT 'summary_large_image',
    "noIndex" BOOLEAN NOT NULL DEFAULT false,
    "noFollow" BOOLEAN NOT NULL DEFAULT false,
    "structuredData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "resourceType" "MediaResourceType" NOT NULL,
    "deliveryType" TEXT NOT NULL DEFAULT 'upload',
    "format" TEXT NOT NULL,
    "version" INTEGER,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "aspectRatio" DOUBLE PRECISION,
    "durationSec" DOUBLE PRECISION,
    "pages" INTEGER,
    "secureUrl" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "purpose" "MediaPurpose" NOT NULL DEFAULT 'GALLERY',
    "originalFilename" TEXT,
    "etag" TEXT,
    "colors" JSONB,
    "dominantColor" TEXT,
    "blurDataUrl" TEXT,
    "blurhash" TEXT,
    "altText" TEXT,
    "caption" TEXT,
    "credit" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "focalX" DOUBLE PRECISION,
    "focalY" DOUBLE PRECISION,
    "waveformPeaks" JSONB,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personas" (
    "id" TEXT NOT NULL,
    "key" "PersonaKey" NOT NULL,
    "slug" TEXT NOT NULL,
    "stageName" TEXT NOT NULL,
    "subtitle" TEXT,
    "tagline" TEXT,
    "shortDescription" VARCHAR(280),
    "bio" TEXT NOT NULL,
    "bioShort" TEXT,
    "primaryGenreLabel" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#2DD4BF',
    "accentColorSecondary" TEXT,
    "gradientCss" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isDuo" BOOLEAN NOT NULL DEFAULT false,
    "memberNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "homeCity" TEXT DEFAULT 'Bangalore',
    "country" TEXT DEFAULT 'India',
    "bpmRangeLow" INTEGER,
    "bpmRangeHigh" INTEGER,
    "yearsActiveFrom" INTEGER,
    "heroMediaId" TEXT,
    "avatarMediaId" TEXT,
    "bgVideoMediaId" TEXT,
    "sections" JSONB,
    "seoMetaId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genres" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "colorHex" TEXT,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona_genres" (
    "personaId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "persona_genres_pkey" PRIMARY KEY ("personaId","genreId")
);

-- CreateTable
CREATE TABLE "social_links" (
    "id" TEXT NOT NULL,
    "personaId" TEXT,
    "platform" TEXT NOT NULL,
    "handle" TEXT,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "followerCount" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracks" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artistLabel" TEXT NOT NULL,
    "personaId" TEXT,
    "releaseId" TEXT,
    "trackNumber" INTEGER,
    "type" "TrackType" NOT NULL DEFAULT 'MIX',
    "description" TEXT,
    "bpm" INTEGER,
    "musicalKey" TEXT,
    "durationSec" INTEGER,
    "releaseDate" TIMESTAMP(3),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isDownloadable" BOOLEAN NOT NULL DEFAULT false,
    "soundcloudTrackId" TEXT,
    "embedUrl" TEXT,
    "embedHtml" TEXT,
    "artworkId" TEXT,
    "audioId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "seoMetaId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_genres" (
    "trackId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,

    CONSTRAINT "track_genres_pkey" PRIMARY KEY ("trackId","genreId")
);

-- CreateTable
CREATE TABLE "playlists" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "personaId" TEXT,
    "coverId" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "totalDurationSec" INTEGER DEFAULT 0,
    "seoMetaId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playlist_tracks" (
    "playlistId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "sortIndex" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "playlist_tracks_pkey" PRIMARY KEY ("playlistId","trackId")
);

-- CreateTable
CREATE TABLE "playlist_stream_links" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "platform" "StreamPlatform" NOT NULL,
    "url" TEXT NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "playlist_stream_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stream_links" (
    "id" TEXT NOT NULL,
    "platform" "StreamPlatform" NOT NULL,
    "url" TEXT NOT NULL,
    "trackId" TEXT,
    "releaseId" TEXT,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stream_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "releases" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ReleaseType" NOT NULL DEFAULT 'SINGLE',
    "personaId" TEXT,
    "artistLabel" TEXT NOT NULL,
    "label" TEXT,
    "catalogNumber" TEXT,
    "upc" TEXT,
    "description" TEXT,
    "releaseDate" TIMESTAMP(3),
    "coverId" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "seoMetaId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "addressLine" TEXT,
    "postalCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "websiteUrl" TEXT,
    "instagramUrl" TEXT,
    "capacity" INTEGER,
    "notes" TEXT,
    "logoId" TEXT,
    "seoMetaId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "publishedAt" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "kind" "EventKind" NOT NULL DEFAULT 'CLUB',
    "eventStatus" "EventStatus" NOT NULL DEFAULT 'ANNOUNCED',
    "description" TEXT,
    "personaId" TEXT,
    "venueId" TEXT,
    "venueNameOverride" TEXT,
    "cityOverride" TEXT,
    "countryOverride" TEXT,
    "programId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "doorsOpenAt" TIMESTAMP(3),
    "ticketUrl" TEXT,
    "ticketPriceMin" DECIMAL(10,2),
    "ticketPriceMax" DECIMAL(10,2),
    "currency" "Currency" NOT NULL DEFAULT 'INR',
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "ageRestriction" TEXT,
    "flyerId" TEXT,
    "galleryId" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPast" BOOLEAN NOT NULL DEFAULT false,
    "attendanceEstimate" INTEGER,
    "seoMetaId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lineup_slots" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "personaId" TEXT,
    "role" TEXT,
    "setStartsAt" TIMESTAMP(3),
    "setEndsAt" TIMESTAMP(3),
    "isHeadliner" BOOLEAN NOT NULL DEFAULT false,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_lineup_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "cadence" TEXT,
    "personaId" TEXT,
    "venueId" TEXT,
    "residencyFrom" TIMESTAMP(3),
    "residencyTo" TIMESTAMP(3),
    "isOngoing" BOOLEAN NOT NULL DEFAULT false,
    "heroId" TEXT,
    "galleryId" TEXT,
    "seoMetaId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "galleries" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "personaId" TEXT,
    "layout" "GalleryLayout" NOT NULL DEFAULT 'MASONRY',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "galleries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_items" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "caption" TEXT,
    "sortIndex" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "gallery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "provider" "VideoProvider" NOT NULL DEFAULT 'YOUTUBE',
    "providerVideoId" TEXT,
    "embedUrl" TEXT,
    "hostedMediaId" TEXT,
    "thumbnailId" TEXT,
    "durationSec" INTEGER,
    "chapters" JSONB,
    "transcript" TEXT,
    "personaId" TEXT,
    "eventId" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT,
    "venueOrEvent" TEXT,
    "company" TEXT,
    "quote" TEXT NOT NULL,
    "rating" INTEGER,
    "eventDate" TIMESTAMP(3),
    "personaId" TEXT,
    "avatarId" TEXT,
    "sourceUrl" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "logoId" TEXT,
    "logoMonoId" TEXT,
    "category" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "publishedAt" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona_brands" (
    "personaId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "persona_brands_pkey" PRIMARY KEY ("personaId","brandId")
);

-- CreateTable
CREATE TABLE "stats" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "numericValue" DOUBLE PRECISION,
    "unit" TEXT,
    "suffix" TEXT,
    "icon" TEXT,
    "personaId" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_entries" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "location" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logoId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "experience_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gear_items" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "GearCategory" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "proficiency" "ProficiencyLevel" NOT NULL DEFAULT 'PROFICIENT',
    "yearsUsed" INTEGER,
    "notes" TEXT,
    "isRiderItem" BOOLEAN NOT NULL DEFAULT false,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "imageId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "gear_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "summary" VARCHAR(280),
    "description" TEXT,
    "inclusions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exclusions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "addons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "durationHours" INTEGER,
    "priceFrom" DECIMAL(12,2),
    "priceTo" DECIMAL(12,2),
    "currency" "Currency" NOT NULL DEFAULT 'INR',
    "personaId" TEXT,
    "imageId" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "seoMetaId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "personaId" TEXT,
    "serviceId" TEXT,
    "slug" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "press_assets" (
    "id" TEXT NOT NULL,
    "kind" "PressAssetKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mediaId" TEXT,
    "personaId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "requiresEmail" BOOLEAN NOT NULL DEFAULT false,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "press_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" VARCHAR(400),
    "content" JSONB NOT NULL,
    "contentText" TEXT,
    "readingMinutes" INTEGER,
    "coverId" TEXT,
    "personaId" TEXT,
    "authorName" TEXT DEFAULT 'DJ Felicitous',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "seoMetaId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_tags" (
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "post_tags_pkey" PRIMARY KEY ("postId","tagId")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "static_pages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "contentText" TEXT,
    "lastReviewedAt" TIMESTAMP(3),
    "seoMetaId" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "static_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_inquiries" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "preferredChannel" TEXT DEFAULT 'WHATSAPP',
    "eventType" "EventKind" NOT NULL DEFAULT 'PRIVATE',
    "eventDate" TIMESTAMP(3),
    "eventEndDate" TIMESTAMP(3),
    "isDateFlexible" BOOLEAN NOT NULL DEFAULT false,
    "venueText" TEXT,
    "city" TEXT,
    "country" TEXT DEFAULT 'India',
    "guestCount" INTEGER,
    "durationHours" INTEGER,
    "budgetMin" DECIMAL(12,2),
    "budgetMax" DECIMAL(12,2),
    "currency" "Currency" NOT NULL DEFAULT 'INR',
    "personaId" TEXT,
    "serviceSlug" TEXT,
    "message" TEXT,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "source" "InquirySource" NOT NULL DEFAULT 'WEBSITE_FORM',
    "assignedToId" TEXT,
    "quotedAmount" DECIMAL(12,2),
    "lostReason" TEXT,
    "spamScore" INTEGER NOT NULL DEFAULT 0,
    "honeypotTripped" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "autoRespondedAt" TIMESTAMP(3),
    "mailFailureCount" INTEGER NOT NULL DEFAULT 0,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "referrerUrl" TEXT,
    "landingPath" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "booking_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_notes" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" "SubscriberStatus" NOT NULL DEFAULT 'PENDING',
    "confirmToken" TEXT,
    "confirmTokenExpires" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "unsubscribeToken" TEXT NOT NULL,
    "unsubscribedAt" TIMESTAMP(3),
    "source" TEXT,
    "ipHash" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "siteName" TEXT NOT NULL DEFAULT 'DJ Felicitous',
    "siteTagline" TEXT,
    "logoId" TEXT,
    "contactEmail" TEXT NOT NULL DEFAULT 'bookings@djfelicitous.com',
    "bookingEmail" TEXT,
    "contactPhone" TEXT,
    "whatsappNumber" TEXT,
    "addressCity" TEXT DEFAULT 'Bengaluru',
    "addressRegion" TEXT DEFAULT 'Karnataka',
    "addressCountry" TEXT DEFAULT 'IN',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "googleMapsUrl" TEXT,
    "serviceAreaText" TEXT,
    "defaultSeoTitle" TEXT,
    "defaultSeoDescription" TEXT,
    "defaultOgImageId" TEXT,
    "twitterHandle" TEXT,
    "defaultAccentColor" TEXT NOT NULL DEFAULT '#2DD4BF',
    "featureBlogEnabled" BOOLEAN NOT NULL DEFAULT false,
    "featureNewsletterEnabled" BOOLEAN NOT NULL DEFAULT false,
    "featureShopEnabled" BOOLEAN NOT NULL DEFAULT false,
    "bookingFormEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "responseTimePromise" TEXT DEFAULT 'Replies within 24 hours',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redirects" (
    "id" TEXT NOT NULL,
    "fromPath" TEXT NOT NULL,
    "toPath" TEXT NOT NULL,
    "kind" "RedirectKind" NOT NULL DEFAULT 'PERMANENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_views" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "country" TEXT,
    "deviceType" TEXT,
    "visitorHash" TEXT NOT NULL,
    "personaSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_metrics" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "path" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "uniques" INTEGER NOT NULL DEFAULT 0,
    "lcpP75Ms" INTEGER,
    "inpP75Ms" INTEGER,
    "clsP75" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

-- CreateIndex
CREATE INDEX "user_roles_roleId_idx" ON "user_roles"("roleId");

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_replacedById_key" ON "refresh_tokens"("replacedById");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_revokedAt_idx" ON "refresh_tokens"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- CreateIndex
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");

-- CreateIndex
CREATE INDEX "seo_meta_ogImageId_idx" ON "seo_meta"("ogImageId");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_publicId_key" ON "media_assets"("publicId");

-- CreateIndex
CREATE INDEX "media_assets_resourceType_purpose_idx" ON "media_assets"("resourceType", "purpose");

-- CreateIndex
CREATE INDEX "media_assets_folder_idx" ON "media_assets"("folder");

-- CreateIndex
CREATE INDEX "media_assets_tags_idx" ON "media_assets"("tags");

-- CreateIndex
CREATE INDEX "media_assets_deletedAt_createdAt_idx" ON "media_assets"("deletedAt", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "personas_key_key" ON "personas"("key");

-- CreateIndex
CREATE UNIQUE INDEX "personas_slug_key" ON "personas"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "personas_seoMetaId_key" ON "personas"("seoMetaId");

-- CreateIndex
CREATE INDEX "personas_status_sortIndex_idx" ON "personas"("status", "sortIndex");

-- CreateIndex
CREATE INDEX "personas_deletedAt_idx" ON "personas"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "genres"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "genres_name_key" ON "genres"("name");

-- CreateIndex
CREATE INDEX "persona_genres_genreId_idx" ON "persona_genres"("genreId");

-- CreateIndex
CREATE INDEX "social_links_personaId_sortIndex_idx" ON "social_links"("personaId", "sortIndex");

-- CreateIndex
CREATE UNIQUE INDEX "social_links_personaId_platform_key" ON "social_links"("personaId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_slug_key" ON "tracks"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_seoMetaId_key" ON "tracks"("seoMetaId");

-- CreateIndex
CREATE INDEX "tracks_title_idx" ON "tracks" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "tracks_personaId_status_releaseDate_idx" ON "tracks"("personaId", "status", "releaseDate" DESC);

-- CreateIndex
CREATE INDEX "tracks_status_isFeatured_sortIndex_idx" ON "tracks"("status", "isFeatured", "sortIndex");

-- CreateIndex
CREATE INDEX "tracks_type_idx" ON "tracks"("type");

-- CreateIndex
CREATE INDEX "tracks_deletedAt_idx" ON "tracks"("deletedAt");

-- CreateIndex
CREATE INDEX "track_genres_genreId_idx" ON "track_genres"("genreId");

-- CreateIndex
CREATE UNIQUE INDEX "playlists_slug_key" ON "playlists"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "playlists_seoMetaId_key" ON "playlists"("seoMetaId");

-- CreateIndex
CREATE INDEX "playlists_title_idx" ON "playlists" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "playlists_personaId_status_sortIndex_idx" ON "playlists"("personaId", "status", "sortIndex");

-- CreateIndex
CREATE INDEX "playlists_status_isFeatured_idx" ON "playlists"("status", "isFeatured");

-- CreateIndex
CREATE INDEX "playlists_deletedAt_idx" ON "playlists"("deletedAt");

-- CreateIndex
CREATE INDEX "playlist_tracks_trackId_idx" ON "playlist_tracks"("trackId");

-- CreateIndex
CREATE INDEX "playlist_tracks_playlistId_sortIndex_idx" ON "playlist_tracks"("playlistId", "sortIndex");

-- CreateIndex
CREATE UNIQUE INDEX "playlist_stream_links_playlistId_platform_key" ON "playlist_stream_links"("playlistId", "platform");

-- CreateIndex
CREATE INDEX "stream_links_releaseId_idx" ON "stream_links"("releaseId");

-- CreateIndex
CREATE UNIQUE INDEX "stream_links_trackId_platform_key" ON "stream_links"("trackId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "stream_links_releaseId_platform_key" ON "stream_links"("releaseId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "releases_slug_key" ON "releases"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "releases_seoMetaId_key" ON "releases"("seoMetaId");

-- CreateIndex
CREATE INDEX "releases_personaId_status_releaseDate_idx" ON "releases"("personaId", "status", "releaseDate" DESC);

-- CreateIndex
CREATE INDEX "releases_deletedAt_idx" ON "releases"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "venues_slug_key" ON "venues"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "venues_seoMetaId_key" ON "venues"("seoMetaId");

-- CreateIndex
CREATE INDEX "venues_name_idx" ON "venues" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "venues_city_idx" ON "venues"("city");

-- CreateIndex
CREATE INDEX "venues_deletedAt_idx" ON "venues"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "venues_name_city_key" ON "venues"("name", "city");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "events_galleryId_key" ON "events"("galleryId");

-- CreateIndex
CREATE UNIQUE INDEX "events_seoMetaId_key" ON "events"("seoMetaId");

-- CreateIndex
CREATE INDEX "events_title_idx" ON "events" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "events_status_startsAt_idx" ON "events"("status", "startsAt" DESC);

-- CreateIndex
CREATE INDEX "events_personaId_status_startsAt_idx" ON "events"("personaId", "status", "startsAt" DESC);

-- CreateIndex
CREATE INDEX "events_isPast_status_startsAt_idx" ON "events"("isPast", "status", "startsAt");

-- CreateIndex
CREATE INDEX "events_venueId_idx" ON "events"("venueId");

-- CreateIndex
CREATE INDEX "events_programId_idx" ON "events"("programId");

-- CreateIndex
CREATE INDEX "events_deletedAt_idx" ON "events"("deletedAt");

-- CreateIndex
CREATE INDEX "event_lineup_slots_eventId_sortIndex_idx" ON "event_lineup_slots"("eventId", "sortIndex");

-- CreateIndex
CREATE INDEX "event_lineup_slots_personaId_idx" ON "event_lineup_slots"("personaId");

-- CreateIndex
CREATE UNIQUE INDEX "programs_slug_key" ON "programs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "programs_galleryId_key" ON "programs"("galleryId");

-- CreateIndex
CREATE UNIQUE INDEX "programs_seoMetaId_key" ON "programs"("seoMetaId");

-- CreateIndex
CREATE INDEX "programs_personaId_status_sortIndex_idx" ON "programs"("personaId", "status", "sortIndex");

-- CreateIndex
CREATE INDEX "programs_venueId_idx" ON "programs"("venueId");

-- CreateIndex
CREATE INDEX "programs_deletedAt_idx" ON "programs"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "galleries_slug_key" ON "galleries"("slug");

-- CreateIndex
CREATE INDEX "galleries_personaId_status_sortIndex_idx" ON "galleries"("personaId", "status", "sortIndex");

-- CreateIndex
CREATE INDEX "galleries_deletedAt_idx" ON "galleries"("deletedAt");

-- CreateIndex
CREATE INDEX "gallery_items_galleryId_sortIndex_idx" ON "gallery_items"("galleryId", "sortIndex");

-- CreateIndex
CREATE INDEX "gallery_items_mediaId_idx" ON "gallery_items"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "gallery_items_galleryId_mediaId_key" ON "gallery_items"("galleryId", "mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "videos_slug_key" ON "videos"("slug");

-- CreateIndex
CREATE INDEX "videos_personaId_status_sortIndex_idx" ON "videos"("personaId", "status", "sortIndex");

-- CreateIndex
CREATE INDEX "videos_eventId_idx" ON "videos"("eventId");

-- CreateIndex
CREATE INDEX "videos_deletedAt_idx" ON "videos"("deletedAt");

-- CreateIndex
CREATE INDEX "testimonials_personaId_status_sortIndex_idx" ON "testimonials"("personaId", "status", "sortIndex");

-- CreateIndex
CREATE INDEX "testimonials_status_isFeatured_idx" ON "testimonials"("status", "isFeatured");

-- CreateIndex
CREATE INDEX "testimonials_deletedAt_idx" ON "testimonials"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE INDEX "brands_status_sortIndex_idx" ON "brands"("status", "sortIndex");

-- CreateIndex
CREATE INDEX "brands_deletedAt_idx" ON "brands"("deletedAt");

-- CreateIndex
CREATE INDEX "persona_brands_brandId_idx" ON "persona_brands"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "stats_personaId_key_key" ON "stats"("personaId", "key");

-- CreateIndex
CREATE INDEX "experience_entries_status_startDate_idx" ON "experience_entries"("status", "startDate" DESC);

-- CreateIndex
CREATE INDEX "experience_entries_deletedAt_idx" ON "experience_entries"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "gear_items_slug_key" ON "gear_items"("slug");

-- CreateIndex
CREATE INDEX "gear_items_category_sortIndex_idx" ON "gear_items"("category", "sortIndex");

-- CreateIndex
CREATE INDEX "gear_items_status_isRiderItem_idx" ON "gear_items"("status", "isRiderItem");

-- CreateIndex
CREATE INDEX "gear_items_deletedAt_idx" ON "gear_items"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "services_seoMetaId_key" ON "services"("seoMetaId");

-- CreateIndex
CREATE INDEX "services_category_status_sortIndex_idx" ON "services"("category", "status", "sortIndex");

-- CreateIndex
CREATE INDEX "services_deletedAt_idx" ON "services"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "faqs_slug_key" ON "faqs"("slug");

-- CreateIndex
CREATE INDEX "faqs_category_status_sortIndex_idx" ON "faqs"("category", "status", "sortIndex");

-- CreateIndex
CREATE INDEX "faqs_serviceId_idx" ON "faqs"("serviceId");

-- CreateIndex
CREATE INDEX "faqs_deletedAt_idx" ON "faqs"("deletedAt");

-- CreateIndex
CREATE INDEX "press_assets_kind_status_sortIndex_idx" ON "press_assets"("kind", "status", "sortIndex");

-- CreateIndex
CREATE INDEX "press_assets_deletedAt_idx" ON "press_assets"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "posts_slug_key" ON "posts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "posts_seoMetaId_key" ON "posts"("seoMetaId");

-- CreateIndex
CREATE INDEX "posts_title_idx" ON "posts" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "posts_status_publishedAt_idx" ON "posts"("status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "posts_personaId_idx" ON "posts"("personaId");

-- CreateIndex
CREATE INDEX "posts_deletedAt_idx" ON "posts"("deletedAt");

-- CreateIndex
CREATE INDEX "post_tags_tagId_idx" ON "post_tags"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "static_pages_slug_key" ON "static_pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "static_pages_seoMetaId_key" ON "static_pages"("seoMetaId");

-- CreateIndex
CREATE INDEX "static_pages_deletedAt_idx" ON "static_pages"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "booking_inquiries_reference_key" ON "booking_inquiries"("reference");

-- CreateIndex
CREATE INDEX "booking_inquiries_name_idx" ON "booking_inquiries" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "booking_inquiries_status_createdAt_idx" ON "booking_inquiries"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "booking_inquiries_eventDate_idx" ON "booking_inquiries"("eventDate");

-- CreateIndex
CREATE INDEX "booking_inquiries_email_idx" ON "booking_inquiries"("email");

-- CreateIndex
CREATE INDEX "booking_inquiries_assignedToId_status_idx" ON "booking_inquiries"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "booking_inquiries_notifiedAt_idx" ON "booking_inquiries"("notifiedAt");

-- CreateIndex
CREATE INDEX "booking_inquiries_deletedAt_idx" ON "booking_inquiries"("deletedAt");

-- CreateIndex
CREATE INDEX "inquiry_notes_inquiryId_createdAt_idx" ON "inquiry_notes"("inquiryId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "inquiry_notes_authorId_idx" ON "inquiry_notes"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_confirmToken_key" ON "newsletter_subscribers"("confirmToken");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribeToken_key" ON "newsletter_subscribers"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_status_idx" ON "newsletter_subscribers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "redirects_fromPath_key" ON "redirects"("fromPath");

-- CreateIndex
CREATE INDEX "redirects_isActive_idx" ON "redirects"("isActive");

-- CreateIndex
CREATE INDEX "page_views_path_createdAt_idx" ON "page_views"("path", "createdAt");

-- CreateIndex
CREATE INDEX "page_views_createdAt_idx" ON "page_views"("createdAt");

-- CreateIndex
CREATE INDEX "daily_metrics_date_idx" ON "daily_metrics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_metrics_date_path_key" ON "daily_metrics"("date", "path");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_meta" ADD CONSTRAINT "seo_meta_ogImageId_fkey" FOREIGN KEY ("ogImageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_heroMediaId_fkey" FOREIGN KEY ("heroMediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_avatarMediaId_fkey" FOREIGN KEY ("avatarMediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_bgVideoMediaId_fkey" FOREIGN KEY ("bgVideoMediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_seoMetaId_fkey" FOREIGN KEY ("seoMetaId") REFERENCES "seo_meta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persona_genres" ADD CONSTRAINT "persona_genres_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persona_genres" ADD CONSTRAINT "persona_genres_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_links" ADD CONSTRAINT "social_links_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_audioId_fkey" FOREIGN KEY ("audioId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_seoMetaId_fkey" FOREIGN KEY ("seoMetaId") REFERENCES "seo_meta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_genres" ADD CONSTRAINT "track_genres_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_genres" ADD CONSTRAINT "track_genres_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_seoMetaId_fkey" FOREIGN KEY ("seoMetaId") REFERENCES "seo_meta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_stream_links" ADD CONSTRAINT "playlist_stream_links_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stream_links" ADD CONSTRAINT "stream_links_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stream_links" ADD CONSTRAINT "stream_links_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_seoMetaId_fkey" FOREIGN KEY ("seoMetaId") REFERENCES "seo_meta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_seoMetaId_fkey" FOREIGN KEY ("seoMetaId") REFERENCES "seo_meta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_flyerId_fkey" FOREIGN KEY ("flyerId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "galleries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_seoMetaId_fkey" FOREIGN KEY ("seoMetaId") REFERENCES "seo_meta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lineup_slots" ADD CONSTRAINT "event_lineup_slots_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lineup_slots" ADD CONSTRAINT "event_lineup_slots_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_heroId_fkey" FOREIGN KEY ("heroId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "galleries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_seoMetaId_fkey" FOREIGN KEY ("seoMetaId") REFERENCES "seo_meta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "galleries" ADD CONSTRAINT "galleries_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "galleries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_hostedMediaId_fkey" FOREIGN KEY ("hostedMediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_thumbnailId_fkey" FOREIGN KEY ("thumbnailId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_logoMonoId_fkey" FOREIGN KEY ("logoMonoId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persona_brands" ADD CONSTRAINT "persona_brands_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persona_brands" ADD CONSTRAINT "persona_brands_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stats" ADD CONSTRAINT "stats_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experience_entries" ADD CONSTRAINT "experience_entries_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_items" ADD CONSTRAINT "gear_items_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_seoMetaId_fkey" FOREIGN KEY ("seoMetaId") REFERENCES "seo_meta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "press_assets" ADD CONSTRAINT "press_assets_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "press_assets" ADD CONSTRAINT "press_assets_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_seoMetaId_fkey" FOREIGN KEY ("seoMetaId") REFERENCES "seo_meta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "static_pages" ADD CONSTRAINT "static_pages_seoMetaId_fkey" FOREIGN KEY ("seoMetaId") REFERENCES "seo_meta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_inquiries" ADD CONSTRAINT "booking_inquiries_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_inquiries" ADD CONSTRAINT "booking_inquiries_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_notes" ADD CONSTRAINT "inquiry_notes_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "booking_inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_notes" ADD CONSTRAINT "inquiry_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_defaultOgImageId_fkey" FOREIGN KEY ("defaultOgImageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

