import type { Metadata } from 'next';
import Link from 'next/link';

import { Container, Section, SectionHeader } from '../../../components/container';
import { absoluteUrl } from '../../../lib/site';
import { getSettings } from '../../../server/queries/settings';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch by email, phone or WhatsApp.',
  alternates: { canonical: absoluteUrl('/contact') },
};

export default async function ContactPage(): Promise<React.JSX.Element> {
  const settings = await getSettings();

  return (
    <Section className="pt-20">
      <Container className="max-w-2xl">
        <SectionHeader eyebrow="Let's talk" title="Contact" />
        {settings.responseTimePromise ? (
          <p className="text-fg-secondary">{settings.responseTimePromise}.</p>
        ) : null}
        <div className="mt-8 flex flex-col gap-4">
          <Link
            href="/book"
            className="bg-accent text-on-accent rounded-full px-6 py-3 text-center text-sm font-semibold"
          >
            Submit a booking enquiry
          </Link>
          {settings.whatsappNumber ? (
            <a
              href={`https://wa.me/${settings.whatsappNumber.replace(/[^\d]/g, '')}`}
              rel="noopener noreferrer"
              target="_blank"
              className="rounded-full border border-border px-6 py-3 text-center text-sm font-semibold text-fg-strong"
            >
              Message on WhatsApp
            </a>
          ) : null}
          {settings.bookingEmail ?? settings.contactEmail ? (
            <a
              href={`mailto:${settings.bookingEmail ?? settings.contactEmail}`}
              className="text-accent text-center text-sm underline"
            >
              {settings.bookingEmail ?? settings.contactEmail}
            </a>
          ) : null}
          {settings.contactPhone ? (
            <a href={`tel:${settings.contactPhone}`} className="text-accent text-center text-sm underline">
              {settings.contactPhone}
            </a>
          ) : null}
        </div>
        {settings.serviceAreaText ? (
          <p className="text-fg-muted mt-8 text-sm">Serving {settings.serviceAreaText}.</p>
        ) : null}
      </Container>
    </Section>
  );
}
