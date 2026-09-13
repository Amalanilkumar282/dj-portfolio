import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Container, Section } from '../../../../components/container';
import { RichText } from '../../../../components/rich-text';
import { absoluteUrl } from '../../../../lib/site';
import { getStaticPage } from '../../../../server/queries/static-pages';

const SLUG = 'terms';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getStaticPage(SLUG);
  return { title: page?.title ?? 'Terms', alternates: { canonical: absoluteUrl(`/${SLUG}`) } };
}

export default async function TermsPage(): Promise<React.JSX.Element> {
  const page = await getStaticPage(SLUG);
  if (!page) notFound();

  return (
    <Section className="pt-20">
      <Container className="max-w-2xl">
        <h1 className="font-display text-h1 text-fg-strong">{page.title}</h1>
        <div className="mt-8">
          <RichText content={page.content} />
        </div>
      </Container>
    </Section>
  );
}
