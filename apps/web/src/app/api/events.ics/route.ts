import { absoluteUrl, SITE } from '../../../lib/site';
import { getUpcomingEvents } from '../../../server/queries/events';

export const revalidate = 3600;

function toIcsDate(date: Date): string {
  const [datePart] = date.toISOString().replace(/[-:]/g, '').split('.');
  return `${datePart ?? ''}Z`;
}

function escapeIcs(value: string): string {
  return value.replace(/[\\,;]/g, (char) => `\\${char}`).replace(/\n/g, '\\n');
}

/** A subscribable gig calendar — promoters and venues genuinely add these to their own calendars. */
export async function GET(): Promise<Response> {
  const events = await getUpcomingEvents({ limit: 100 });
  const now = toIcsDate(new Date());

  const veventBlocks = events
    .map((event) => {
      const start = toIcsDate(event.startsAt);
      const end = toIcsDate(event.endsAt ?? new Date(event.startsAt.getTime() + 3 * 60 * 60 * 1000));
      const location = [event.venueName, event.city].filter(Boolean).join(', ');

      return [
        'BEGIN:VEVENT',
        `UID:${event.id}@djfelicitous.com`,
        `DTSTAMP:${now}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${escapeIcs(event.title)}`,
        location ? `LOCATION:${escapeIcs(location)}` : '',
        `URL:${absoluteUrl(`/events/${event.slug}`)}`,
        'END:VEVENT',
      ]
        .filter(Boolean)
        .join('\r\n');
    })
    .join('\r\n');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${SITE.name}//Events//EN`,
    'CALSCALE:GREGORIAN',
    veventBlocks,
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');

  return new Response(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'attachment; filename="dj-felicitous-events.ics"',
    },
  });
}
