import { Module } from '@nestjs/common';

import { EventsModule } from '../events/events.module';
import { PersonasModule } from '../personas/personas.module';
import { PlaylistsModule } from '../playlists/playlists.module';
import { PostsModule } from '../posts/posts.module';
import { ProgramsModule } from '../programs/programs.module';
import { ReleasesModule } from '../releases/releases.module';
import { ServicesModule } from '../services/services.module';
import { StaticPagesModule } from '../static-pages/static-pages.module';
import { TracksModule } from '../tracks/tracks.module';
import { VenuesModule } from '../venues/venues.module';

import { SitemapController } from './sitemap.controller';
import { SitemapService } from './sitemap.service';

@Module({
  imports: [
    PersonasModule,
    VenuesModule,
    TracksModule,
    ReleasesModule,
    PlaylistsModule,
    ProgramsModule,
    EventsModule,
    ServicesModule,
    StaticPagesModule,
    PostsModule,
  ],
  controllers: [SitemapController],
  providers: [SitemapService],
})
export class SitemapModule {}
