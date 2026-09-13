import type { Metadata } from 'next';
import Link from 'next/link';

import { Container, Section } from '../../../../components/container';
import { TrackEvent } from '../../../../components/track-event';

export const metadata: Metadata = {
  title: 'Enquiry received',
  robots: { index: false, follow: false },
};

export default async function BookThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}): Promise<React.JSX.Element> {
  const { ref } = await searchParams;

  return (
    <Section className="pt-24">
      <Container className="max-w-lg text-center">
        <h1 className="font-display text-h1 text-fg-strong">Got it!</h1>
        <p className="text-fg-secondary mt-4">
          Your enquiry has been received{ref ? <> — reference <strong className="text-fg-strong">{ref}</strong></> : null}.
          We&apos;ll be in touch shortly.
        </p>
        <Link href="/" className="text-accent mt-8 inline-block text-sm underline">
          Back to home
        </Link>
      </Container>
      <TrackEvent event="booking_submitted" />
    </Section>
  );
}
