import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Container, Section, SectionHeader } from '../../../../components/container';
import { GalleryGrid } from '../../../../components/gallery/gallery-grid';
import { absoluteUrl } from '../../../../lib/site';
import { getGallery } from '../../../../server/queries/galleries';

interface Params {
  slug: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const gallery = await getGallery(slug);
  if (!gallery) return {};

  return {
    title: gallery.title,
    description: gallery.description ?? `Photos from ${gallery.title}.`,
    alternates: { canonical: absoluteUrl(`/gallery/${slug}`) },
  };
}

export default async function GalleryPage({
  params,
}: {
  params: Promise<Params>;
}): Promise<React.JSX.Element> {
  const { slug } = await params;
  const gallery = await getGallery(slug);
  if (!gallery) notFound();

  return (
    <Section className="pt-20">
      <Container>
        <SectionHeader eyebrow="Gallery" title={gallery.title} description={gallery.description} />

        {gallery.items.length === 0 ? (
          <p className="text-fg-muted text-sm">This gallery has no photos yet.</p>
        ) : (
          <GalleryGrid
            items={gallery.items.flatMap((item) => (item.image ? [{ id: item.id, image: item.image, caption: item.caption }] : []))}
          />
        )}
      </Container>
    </Section>
  );
}
