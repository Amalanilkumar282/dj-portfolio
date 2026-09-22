import type { Metadata } from 'next';
import Link from 'next/link';

import { CloudinaryImage } from '../../../components/cloudinary-image';
import { Container, Section, SectionHeader } from '../../../components/container';
import { VideoRail } from '../../../components/home/video-rail';
import { SIZES } from '../../../lib/media';
import { absoluteUrl } from '../../../lib/site';
import { getGalleries } from '../../../server/queries/galleries';
import { getVideos } from '../../../server/queries/videos';

export const metadata: Metadata = {
  title: 'Gallery',
  description: 'Photos and video from the road — sets, crowds and rigs across every channel.',
  alternates: { canonical: absoluteUrl('/gallery') },
};

/**
 * The gallery index.
 *
 * As of launch there are zero real photos in this repo (see CLAUDE.md) —
 * every gallery here is one the artist has actually published from the
 * admin. An empty state is the honest default, not a placeholder grid of
 * stock imagery pretending content exists.
 */
export default async function GalleryIndexPage(): Promise<React.JSX.Element> {
  // Photos and video on one page rather than two routes, because the artist's
  // own sketch drew them as two sections of a single "gallery" - and split
  // across two near-empty pages neither would look worth opening.
  const [galleries, videos] = await Promise.all([getGalleries(), getVideos({ limit: 50 })]);

  return (
    <Section className="pt-20">
      <Container>
        <SectionHeader
          as="h1"
          eyebrow="On the road"
          title="Gallery"
          description="Photos from sets, crowds and rigs — added by the artist as they come in."
        />

        {galleries.length === 0 ? (
          <p className="text-fg-muted text-sm">No galleries published yet — check back soon.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {galleries.map((gallery) => (
              <Link
                key={gallery.id}
                href={`/gallery/${gallery.slug}`}
                className="group border-border hover-hover:hover:border-accent overflow-hidden rounded-md border bg-surface transition-[border-color] duration-(--duration-fast)"
              >
                {gallery.cover ? (
                  <div className="relative aspect-video w-full overflow-hidden">
                    <CloudinaryImage image={gallery.cover} sizes={SIZES.cardGrid3} fill className="object-cover" />
                  </div>
                ) : (
                  <div
                    className="aspect-video w-full"
                    style={{ background: 'var(--gradient-persona)' }}
                    aria-hidden="true"
                  />
                )}
                <div className="p-5">
                  <p className="text-fg-strong font-semibold">{gallery.title}</p>
                  <p className="text-fg-muted mt-1 text-xs uppercase">
                    {gallery.itemCount} {gallery.itemCount === 1 ? 'photo' : 'photos'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {videos.length > 0 ? (
          <div className="mt-20">
            <SectionHeader
              eyebrow="Watch"
              title="Videos"
              description="Sets, recaps and clips. Nothing loads from YouTube until you press play."
            />
            <VideoRail videos={videos} />
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
