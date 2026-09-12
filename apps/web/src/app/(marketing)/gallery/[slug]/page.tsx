import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CloudinaryImage } from '../../../../components/cloudinary-image';
import { Container, Section, SectionHeader } from '../../../../components/container';
import { SIZES } from '../../../../lib/media';
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
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
            {gallery.items.map((item) =>
              item.image ? (
                <figure key={item.id} className="overflow-hidden rounded-md border border-border">
                  <CloudinaryImage
                    image={item.image}
                    sizes={SIZES.cardGrid3}
                    width={item.image.width}
                    height={item.image.height}
                    className="w-full"
                  />
                  {item.caption ? (
                    <figcaption className="text-fg-muted bg-surface p-3 text-xs">{item.caption}</figcaption>
                  ) : null}
                </figure>
              ) : null,
            )}
          </div>
        )}
      </Container>
    </Section>
  );
}
