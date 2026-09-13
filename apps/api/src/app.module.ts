import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE, Reflector } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';

import { CommonModule } from './common/common.module';
import { AllExceptionsFilter, PrismaExceptionFilter } from './common/filters';
import { JwtAccessGuard, PermissionsGuard } from './common/guards';
import {
  AuditInterceptor,
  HttpCacheInterceptor,
  IdempotencyInterceptor,
  QueryCountInterceptor,
  TimeoutInterceptor,
} from './common/interceptors';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { validateEnv } from './config/env.schema';
import { AppCacheModule } from './infra/cache/cache.module';
import { CloudinaryModule } from './infra/cloudinary/cloudinary.module';
import { HealthModule } from './infra/health/health.module';
import { LoggerModule } from './infra/logger/logger.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RevalidationModule } from './infra/revalidation/revalidation.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BrandsModule } from './modules/brands/brands.module';
import { EventsModule } from './modules/events/events.module';
import { ExperienceModule } from './modules/experience/experience.module';
import { FaqsModule } from './modules/faqs/faqs.module';
import { GalleriesModule } from './modules/galleries/galleries.module';
import { GearModule } from './modules/gear/gear.module';
import { GenresModule } from './modules/genres/genres.module';
import { InquiriesModule } from './modules/inquiries/inquiries.module';
import { MediaModule } from './modules/media/media.module';
import { NewsletterModule } from './modules/newsletter/newsletter.module';
import { PersonasModule } from './modules/personas/personas.module';
import { PlaylistsModule } from './modules/playlists/playlists.module';
import { PostsModule } from './modules/posts/posts.module';
import { PressAssetsModule } from './modules/press-assets/press-assets.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { RedirectsModule } from './modules/redirects/redirects.module';
import { ReleasesModule } from './modules/releases/releases.module';
import { ServicesModule } from './modules/services/services.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SitemapModule } from './modules/sitemap/sitemap.module';
import { StaticPagesModule } from './modules/static-pages/static-pages.module';
import { StatsModule } from './modules/stats/stats.module';
import { TagsModule } from './modules/tags/tags.module';
import { TestimonialsModule } from './modules/testimonials/testimonials.module';
import { TracksModule } from './modules/tracks/tracks.module';
import { VenuesModule } from './modules/venues/venues.module';

/**
 * The application root.
 *
 * ## Provider order IS the security boundary
 *
 * Nest applies **guards** in registration order and **filters** in REVERSE
 * registration order. Both facts matter here, and getting either wrong is a
 * security bug rather than a style problem:
 *
 * - `ThrottlerGuard` first, so a flood is rejected before any argon2 work or
 *   database read happens. Putting auth first would let an attacker burn CPU
 *   at will.
 * - `JwtAccessGuard` next. It **denies by default**; `@Public()` opts out.
 * - `PermissionsGuard` last, because it needs the principal the previous
 *   guard attached.
 *
 * - `AllExceptionsFilter` is registered FIRST so it ends up OUTERMOST, and
 *   `PrismaExceptionFilter` registered second gets first refusal on the
 *   errors it declares. Swapping them makes every constraint violation a
 *   generic 500.
 *
 * Interceptors run in registration order on the way in:
 *
 * - `TimeoutInterceptor` outermost, so it can cap everything inside it.
 * - `IdempotencyInterceptor` before the handler, so a replay short-circuits
 *   without doing the work twice.
 * - `HttpCacheInterceptor` next, so it sees the final body for the ETag.
 * - `AuditInterceptor` innermost, so it only fires on a successful handler.
 *
 * The request context is opened by **middleware**, not an interceptor. See
 * `RequestContextMiddleware` for why that distinction is load-bearing.
 *
 * See docs/02-architecture/backend.md
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      // Boot fails on invalid config, deliberately: a container that starts
      // with a missing RESEND_API_KEY and silently drops booking emails is a
      // business bug, not a config bug.
      validate: validateEnv,
    }),

    LoggerModule,
    CommonModule,
    PrismaModule,
    AppCacheModule,
    AuditModule,
    RevalidationModule,
    ScheduleModule.forRoot(),
    // Backs the `content.changed` domain event that drives revalidation.
    EventEmitterModule.forRoot({ delimiter: '.' }),

    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: seconds(10), limit: 30 },
        { name: 'default', ttl: seconds(60), limit: 120 },
      ],
      // The uptime monitor hits /health every minute from one address and
      // must never be throttled out of its own probe.
      skipIf: (context) => {
        const path = context.switchToHttp().getRequest<{ path?: string }>().path ?? '';
        return path.startsWith('/health');
      },
    }),

    AuthModule,
    RbacModule,
    PersonasModule,
    GenresModule,
    VenuesModule,
    TracksModule,
    ReleasesModule,
    PlaylistsModule,
    ProgramsModule,
    EventsModule,
    CloudinaryModule,
    MediaModule,
    FaqsModule,
    ExperienceModule,
    GearModule,
    TestimonialsModule,
    StaticPagesModule,
    ServicesModule,
    BrandsModule,
    GalleriesModule,
    StatsModule,
    SettingsModule,
    RedirectsModule,
    SitemapModule,
    InquiriesModule,
    NewsletterModule,
    PressAssetsModule,
    TagsModule,
    PostsModule,
    HealthModule,
  ],

  providers: [
    Reflector,

    // ── guards: order matters, see the class comment ─────────────────────
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAccessGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },

    // ── filters: registered first means applied last (outermost) ─────────
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },

    // ── validation ───────────────────────────────────────────────────────
    // DTOs validate against the same schemas the admin forms and the OpenAPI
    // document use. This is OUR wrapper, not nestjs-zod's export: the stock
    // pipe throws 400 and leaks raw Zod issues onto the wire. See
    // common/pipes/zod-validation.pipe.ts.
    { provide: APP_PIPE, useClass: ZodValidationPipe },

    // ── interceptors ─────────────────────────────────────────────────────
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_INTERCEPTOR, useClass: HttpCacheInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    // Innermost, so it observes everything the handler and the interceptors
    // above it did. Development and test only.
    { provide: APP_INTERCEPTOR, useClass: QueryCountInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Wraps every downstream guard, interceptor and handler in the
    // AsyncLocalStorage scope. An interceptor could not do this reliably.
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
