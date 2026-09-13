import type { Metadata } from 'next';

import { Container, Section, SectionHeader } from '../../../components/container';
import { JsonLd, type JsonLdNode } from '../../../lib/json-ld';
import { absoluteUrl } from '../../../lib/site';
import { getFaqs } from '../../../server/queries/faqs';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Common questions about booking, pricing, travel and equipment.',
  alternates: { canonical: absoluteUrl('/faq') },
};

export default async function FaqPage(): Promise<React.JSX.Element> {
  const faqs = await getFaqs();

  const graph: JsonLdNode[] = [
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    },
  ];

  return (
    <Section className="pt-20">
      <Container className="max-w-2xl">
        <SectionHeader eyebrow="Before you ask" title="Frequently asked questions" />
        <dl className="divide-border divide-y">
          {faqs.map((faq) => (
            <div key={faq.id} id={faq.slug} className="py-5">
              <dt className="text-fg-strong font-semibold">{faq.question}</dt>
              <dd className="text-fg-secondary mt-2 text-sm">{faq.answer}</dd>
            </div>
          ))}
        </dl>
        {faqs.length === 0 ? <p className="text-fg-muted">No FAQs published yet.</p> : null}
      </Container>
      <JsonLd graph={graph} />
    </Section>
  );
}
