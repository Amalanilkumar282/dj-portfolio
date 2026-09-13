import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatPriceRange } from '@dj/utils';

import { Container, Section } from '../../../../components/container';
import { JsonLd, type JsonLdNode } from '../../../../lib/json-ld';
import { absoluteUrl } from '../../../../lib/site';
import { getFaqs } from '../../../../server/queries/faqs';
import { getService } from '../../../../server/queries/services';

interface Params {
  slug: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const service = await getService(slug);
  if (!service) return {};
  return {
    title: service.name,
    description: service.summary ?? undefined,
    alternates: { canonical: absoluteUrl(`/services/${slug}`) },
  };
}

export default async function ServicePage({ params }: { params: Promise<Params> }): Promise<React.JSX.Element> {
  const { slug } = await params;
  const [service, faqs] = await Promise.all([getService(slug), getFaqs({ serviceSlug: slug })]);
  if (!service) notFound();

  const url = absoluteUrl(`/services/${slug}`);
  const graph: JsonLdNode[] = [
    {
      '@type': 'Service',
      '@id': `${url}#service`,
      name: service.name,
      areaServed: ['Bengaluru', 'Karnataka', 'India'],
      offers: {
        '@type': 'Offer',
        priceCurrency: service.currency,
        price: service.priceFrom ?? undefined,
      },
    },
  ];
  if (faqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    });
  }

  return (
    <Section className="pt-20">
      <Container className="max-w-3xl">
        <p className="text-eyebrow text-accent font-semibold uppercase">{service.category.replace('_', ' ')}</p>
        <h1 className="font-display text-h1 text-fg-strong mt-4">{service.name}</h1>
        <p className="text-accent mt-4 text-lg font-semibold">
          {formatPriceRange(service.priceFrom, service.priceTo, service.currency)}
        </p>
        {service.description ? (
          <p className="text-fg-secondary mt-6 whitespace-pre-line">{service.description}</p>
        ) : null}
        {service.inclusions.length > 0 ? (
          <div className="mt-8">
            <h2 className="font-display text-h4 text-fg-strong">What&apos;s included</h2>
            <ul className="mt-3 list-inside list-disc space-y-1 text-fg-secondary">
              {service.inclusions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {service.addons.length > 0 ? (
          <div className="mt-8">
            <h2 className="font-display text-h4 text-fg-strong">Available add-ons</h2>
            <ul className="mt-3 list-inside list-disc space-y-1 text-fg-secondary">
              {service.addons.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {faqs.length > 0 ? (
          <div className="mt-10">
            <h2 className="font-display text-h4 text-fg-strong">Questions</h2>
            <dl className="mt-4 space-y-4">
              {faqs.map((faq) => (
                <div key={faq.id}>
                  <dt className="text-fg-strong font-medium">{faq.question}</dt>
                  <dd className="text-fg-secondary mt-1 text-sm">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
        <Link
          href="/book"
          className="bg-accent text-on-accent mt-10 inline-block rounded-full px-6 py-3 text-sm font-semibold"
        >
          Enquire about this package
        </Link>
      </Container>
      <JsonLd graph={graph} />
    </Section>
  );
}
