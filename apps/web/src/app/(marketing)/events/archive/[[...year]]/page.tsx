import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatIstDate } from '@dj/utils';

import { Container, Section, SectionHeader } from '../../../../../components/container';
import { absoluteUrl } from '../../../../../lib/site';
import { getPastEvents } from '../../../../../server/queries/events';

interface Params {
  year?: string[];
}

function parseYear(segments: string[] | undefined): number | undefined {
  if (!segments || segments.length === 0) return undefined;
  const year = Number(segments[0]);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) notFound();
  return year;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { year: segments } = await params;
  const year = parseYear(segments);
  return {
    title: year ? `${String(year)} archive` : 'Past events archive',
    alternates: { canonical: absoluteUrl(`/events/archive${year ? `/${String(year)}` : ''}`) },
  };
}

export default async function EventsArchivePage({
  params,
}: {
  params: Promise<Params>;
}): Promise<React.JSX.Element> {
  const { year: segments } = await params;
  const year = parseYear(segments);
  const events = await getPastEvents(year === undefined ? {} : { year });

  return (
    <Section className="pt-20">
      <Container>
        <SectionHeader eyebrow="Archive" title={year ? `${String(year)} shows` : 'Past shows'} />
        {events.length === 0 ? (
          <p className="text-fg-muted">Nothing in the archive{year ? ` for ${String(year)}` : ''} yet.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.slug}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border p-4 hover:border-accent"
                >
                  <span className="text-fg-strong font-medium">{event.title}</span>
                  <span className="text-fg-muted text-sm">
                    {formatIstDate(event.startsAt)}
                    {event.city ? ` · ${event.city}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </Section>
  );
}
