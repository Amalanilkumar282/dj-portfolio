import type { Metadata } from 'next';

import { Container, Section, SectionHeader } from '../../../components/container';
import { absoluteUrl } from '../../../lib/site';

import { BookForm } from './book-form';

export const metadata: Metadata = {
  title: 'Book',
  description: 'Submit a booking enquiry for your wedding, corporate event, club night or festival.',
  alternates: { canonical: absoluteUrl('/book') },
};

export default function BookPage(): React.JSX.Element {
  return (
    <Section className="pt-20">
      <Container className="max-w-2xl">
        <SectionHeader eyebrow="Let's make it happen" title="Book DJ Felicitous" />
        <BookForm />
      </Container>
    </Section>
  );
}
