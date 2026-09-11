import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { SitemapEntry } from '@dj/contracts';

import type { Env } from '../../config/env.schema';
import { EventsService } from '../events/events.service';
import { PersonasService } from '../personas/personas.service';
import { PlaylistsService } from '../playlists/playlists.service';
import { PostsService } from '../posts/posts.service';
import { ProgramsService } from '../programs/programs.service';
import { ReleasesService } from '../releases/releases.service';
import { ServicesService } from '../services/services.service';
import { StaticPagesService } from '../static-pages/static-pages.service';
import { TracksService } from '../tracks/tracks.service';
import { VenuesService } from '../venues/venues.service';

/** One publishable resource's contribution to the sitemap. */
interface SitemapSource {
  pathFor: (slug: string) => string;
  changefreq: SitemapEntry['changefreq'];
  priority: number;
  listSlugs: () => Promise<{ slug: string; updatedAt: Date }[]>;
}

/**
 * Aggregates every published, indexable URL into one flat feed.
 *
 * One `GET /sitemap` response rather than each resource exposing its own
 * feed: `next-sitemap`'s `generateSitemaps()` on the web side wants exactly
 * this shape, and it is the single place that decides indexability — see
 * docs/02-architecture/seo.md.
 */
@Injectable()
export class SitemapService {
  private readonly webBaseUrl: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly personas: PersonasService,
    private readonly venues: VenuesService,
    private readonly tracks: TracksService,
    private readonly releases: ReleasesService,
    private readonly playlists: PlaylistsService,
    private readonly programs: ProgramsService,
    private readonly events: EventsService,
    private readonly services: ServicesService,
    private readonly staticPages: StaticPagesService,
    private readonly posts: PostsService,
  ) {
    this.webBaseUrl = config.get('WEB_BASE_URL', { infer: true });
  }

  async list(): Promise<SitemapEntry[]> {
    const sources: SitemapSource[] = [
      {
        pathFor: (slug) => `/${slug}`,
        changefreq: 'weekly',
        priority: 0.9,
        listSlugs: () => this.personas.listSlugs(),
      },
      {
        pathFor: (slug) => `/venues/${slug}`,
        changefreq: 'monthly',
        priority: 0.4,
        listSlugs: () => this.venues.listSlugs(),
      },
      {
        pathFor: (slug) => `/music/${slug}`,
        changefreq: 'monthly',
        priority: 0.6,
        listSlugs: () => this.tracks.listSlugs(),
      },
      {
        pathFor: (slug) => `/music/albums/${slug}`,
        changefreq: 'monthly',
        priority: 0.5,
        listSlugs: () => this.releases.listSlugs(),
      },
      {
        pathFor: (slug) => `/music/playlists/${slug}`,
        changefreq: 'monthly',
        priority: 0.5,
        listSlugs: () => this.playlists.listSlugs(),
      },
      {
        pathFor: (slug) => `/programs/${slug}`,
        changefreq: 'monthly',
        priority: 0.5,
        listSlugs: () => this.programs.listSlugs(),
      },
      {
        pathFor: (slug) => `/events/${slug}`,
        changefreq: 'weekly',
        priority: 0.7,
        listSlugs: () => this.events.listSlugs(),
      },
      {
        pathFor: (slug) => `/services/${slug}`,
        changefreq: 'monthly',
        priority: 0.7,
        listSlugs: () => this.services.listSlugs(),
      },
      {
        pathFor: (slug) => `/${slug}`,
        changefreq: 'yearly',
        priority: 0.3,
        listSlugs: () => this.staticPages.listSlugs(),
      },
      {
        pathFor: (slug) => `/blog/${slug}`,
        changefreq: 'monthly',
        priority: 0.5,
        listSlugs: () => this.posts.listSlugs(),
      },
    ];

    const perSource = await Promise.all(
      sources.map(async (source) => {
        const rows = await source.listSlugs();
        return rows.map(
          (row): SitemapEntry => ({
            loc: `${this.webBaseUrl}${source.pathFor(row.slug)}`,
            lastmod: row.updatedAt,
            changefreq: source.changefreq,
            priority: source.priority,
          }),
        );
      }),
    );

    return perSource.flat().sort((a, b) => a.loc.localeCompare(b.loc));
  }
}
