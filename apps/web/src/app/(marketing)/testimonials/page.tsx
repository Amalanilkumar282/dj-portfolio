import type { Metadata } from 'next';

import { formatIstDate } from '@dj/utils';

import { Container, Section, SectionHeader } from '../../../components/container';
import { JsonLd, type JsonLdNode } from '../../../lib/json-ld';
import { absoluteUrl } from '../../../lib/site';
import { getTestimonials } from '../../../server/queries/testimonials';

export const metadata: Metadata = {
  title: 'Testimonials',
  description: 'What clients, planners and promoters say about working with DJ Felicitous.',
  alternates: { canonical: absoluteUrl('/testimonials') },
};

export default async function TestimonialsPage(): Promise<React.JSX.Element> {
  const testimonials = await getTestimonials({ limit: 100 });

  // Review/AggregateRating are emitted ONLY for isVerified testimonials —
  // fabricated review markup is a Google structured-data violation, and the
  // legacy site did exactly that. See docs/02-architecture/seo.md.
  const verified = testimonials.filter((t) => t.isVerified && t.rating != null);
  const graph: JsonLdNode[] =
    verified.length > 0
      ? [
          {
            '@type': 'Product',
            name: 'DJ Felicitous booking',
            review: verified.map((t) => ({
              '@type': 'Review',
              author: { '@type': 'Person', name: t.authorName },
              reviewRating: { '@type': 'Rating', ratingValue: t.rating },
              reviewBody: t.quote,
            })),
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: verified.reduce((sum, t) => sum + (t.rating ?? 0), 0) / verified.length,
              reviewCount: verified.length,
            },
          },
        ]
      : [];

  return (
    <Section className="pt-20">
      <Container>
        <SectionHeader eyebrow="Word of mouth" title="Testimonials" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <blockquote key={testimonial.id} className="rounded-md border border-border bg-surface p-6">
              <p className="text-fg-secondary text-sm italic">&ldquo;{testimonial.quote}&rdquo;</p>
              <footer className="text-fg-muted mt-4 text-xs">
                {testimonial.authorName}
                {testimonial.authorRole ? `, ${testimonial.authorRole}` : ''}
                {testimonial.venueOrEvent ? ` — ${testimonial.venueOrEvent}` : ''}
                {testimonial.eventDate ? ` (${formatIstDate(testimonial.eventDate)})` : ''}
              </footer>
            </blockquote>
          ))}
        </div>
        {testimonials.length === 0 ? <p className="text-fg-muted">No testimonials published yet.</p> : null}
      </Container>
      {graph.length > 0 ? <JsonLd graph={graph} /> : null}
    </Section>
  );
}
