import Link from 'next/link';

import type { ExperienceEntryDetail, ProgramSummary } from '@dj/contracts';
import { Card } from '@dj/ui/primitives';

/**
 * "Resident DJ" — the standing nights, with their real date ranges.
 *
 * Two models in this schema describe a residency and they are not connected
 * to each other:
 *
 *   - `Program` — a named night with a `Venue` relation, `residencyFrom` /
 *     `residencyTo` / `isOngoing`, and the events that belong to it.
 *   - `ExperienceEntry` — a flat CV row: free-text `role` and
 *     `organisation`, `startDate` / `endDate` / `isCurrent`, no relations.
 *
 * `Program` is the richer of the two and is preferred here. Experience rows
 * are merged in **only where they are not already represented by a program**,
 * matched on organisation against the program's venue or name — otherwise a
 * residency maintained in both places would list twice, which reads as
 * padding. See the ADR for why this overlap is recorded rather than
 * resolved: collapsing the two models is a migration, not a homepage change.
 */

interface Residency {
  key: string;
  title: string;
  place: string | null;
  period: string;
  cadence: string | null;
  href: string | null;
  isCurrent: boolean;
}

export function Residencies({
  programs,
  experience,
}: {
  programs: ProgramSummary[];
  experience: ExperienceEntryDetail[];
}): React.JSX.Element | null {
  const fromPrograms: Residency[] = programs.map((program) => ({
    key: `program:${program.id}`,
    title: program.name,
    place: program.venueName,
    period: formatPeriod(program.residencyFrom, program.residencyTo, program.isOngoing),
    cadence: program.cadence,
    href: `/programs/${program.slug}`,
    isCurrent: program.isOngoing,
  }));

  const claimed = new Set(
    programs.flatMap((program) =>
      [program.venueName, program.name]
        .filter((value): value is string => value !== null)
        .map(normalise),
    ),
  );

  const fromExperience: Residency[] = experience
    .filter((entry) => /resident/i.test(entry.role))
    .filter((entry) => !claimed.has(normalise(entry.organisation)))
    .map((entry) => ({
      key: `experience:${entry.id}`,
      title: entry.organisation,
      place: entry.location,
      period: formatPeriod(entry.startDate, entry.endDate, entry.isCurrent),
      cadence: entry.role,
      // ExperienceEntry has no slug and so no page of its own.
      href: null,
      isCurrent: entry.isCurrent,
    }));

  // Current residencies first — "playing there now" outranks "played there
  // for a year", which is the opposite of chronological order.
  const all = [...fromPrograms, ...fromExperience].sort(
    (a, b) => Number(b.isCurrent) - Number(a.isCurrent),
  );

  if (all.length === 0) return null;

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {all.map((residency) => {
        const body = (
          <>
            <div className="flex items-start justify-between gap-3">
              <p className="font-display text-h4 text-fg-strong min-w-0">{residency.title}</p>
              {residency.isCurrent ? (
                <span className="text-accent shrink-0 font-mono text-xs uppercase">Current</span>
              ) : null}
            </div>
            {residency.place ? (
              <p className="text-fg-secondary mt-2 text-sm">{residency.place}</p>
            ) : null}
            <p className="text-fg-muted mt-auto pt-6 font-mono text-xs uppercase">
              {residency.period}
              {residency.cadence ? ` · ${residency.cadence}` : ''}
            </p>
          </>
        );

        return (
          <li key={residency.key}>
            {residency.href ? (
              <Link
                href={residency.href}
                className="block h-full rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)"
              >
                <Card interactive className="flex h-full flex-col p-6">
                  {body}
                </Card>
              </Link>
            ) : (
              <Card className="flex h-full flex-col p-6">{body}</Card>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * "Aug 2024 – Jul 2025", or "Aug 2024 – Present" while it is still running.
 *
 * Month precision on purpose: a residency is not a day, and a full date
 * implies an accuracy the underlying record does not have. IST, because both
 * the artist and the audience are in India and a UTC month boundary would
 * show the wrong month for anything starting late on the 31st.
 */
function formatPeriod(from: Date | null, to: Date | null, isCurrent: boolean): string {
  if (!from) return isCurrent ? 'Ongoing' : '—';

  const start = monthYear(from);
  if (isCurrent || !to) return `${start} – Present`;
  return `${start} – ${monthYear(to)}`;
}

function monthYear(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
