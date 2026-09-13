'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '../../lib/auth-context';
import { previewUrl } from '../../lib/preview';
import { usePersonaKeyOptions, useProgramOptions, useVenueOptions } from '../../lib/reference-data';
import { MediaSelect } from '../media/media-select';

interface LineupSlot {
  artistName: string;
  role: string;
  isHeadliner: boolean;
}

interface EventDetail {
  slug: string;
  title: string;
  subtitle: string | null;
  kind: string;
  eventStatus: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  ticketUrl: string | null;
  ticketPriceMin: number | null;
  ticketPriceMax: number | null;
  currency: string;
  isFree: boolean;
  isFeatured: boolean;
  lineup: { artistName: string; role: string | null; isHeadliner: boolean }[];
}

const EVENT_KINDS = ['CLUB', 'FESTIVAL', 'WEDDING', 'CORPORATE', 'PRIVATE', 'RADIO', 'LIVESTREAM'];
const EVENT_STATUSES = ['ANNOUNCED', 'CONFIRMED', 'SOLD_OUT', 'CANCELLED', 'POSTPONED', 'COMPLETED'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'AED', 'GBP'];

function toDateTimeInputValue(value: string | null): string {
  if (!value) return '';
  return value.slice(0, 16);
}

export function EventForm({ id }: { id?: string }): React.JSX.Element {
  const { request } = useAuth();
  const router = useRouter();
  const personaKeyOptions = usePersonaKeyOptions();
  const venueOptions = useVenueOptions();
  const programOptions = useProgramOptions();

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [kind, setKind] = useState('CLUB');
  const [eventStatus, setEventStatus] = useState('ANNOUNCED');
  const [description, setDescription] = useState('');
  const [personaKey, setPersonaKey] = useState('');
  const [venueId, setVenueId] = useState('');
  const [venueNameOverride, setVenueNameOverride] = useState('');
  const [programId, setProgramId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [ticketPriceMin, setTicketPriceMin] = useState('');
  const [ticketPriceMax, setTicketPriceMax] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [isFree, setIsFree] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [flyerId, setFlyerId] = useState('');
  const [lineup, setLineup] = useState<LineupSlot[]>([]);
  const [slug, setSlug] = useState<string | null>(null);

  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    request<EventDetail>(`admin/events/${id}`)
      .then((event) => {
        setSlug(event.slug);
        setTitle(event.title);
        setSubtitle(event.subtitle ?? '');
        setKind(event.kind);
        setEventStatus(event.eventStatus);
        setDescription(event.description ?? '');
        setStartsAt(toDateTimeInputValue(event.startsAt));
        setEndsAt(toDateTimeInputValue(event.endsAt));
        setTicketUrl(event.ticketUrl ?? '');
        setTicketPriceMin(event.ticketPriceMin != null ? String(event.ticketPriceMin) : '');
        setTicketPriceMax(event.ticketPriceMax != null ? String(event.ticketPriceMax) : '');
        setCurrency(event.currency);
        setIsFree(event.isFree);
        setIsFeatured(event.isFeatured);
        setLineup(
          event.lineup.map((slot) => ({
            artistName: slot.artistName,
            role: slot.role ?? '',
            isHeadliner: slot.isHeadliner,
          })),
        );
      })
      .catch(() => {
        setError('Could not load this event.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, request]);

  function addLineupSlot(): void {
    setLineup((current) => [...current, { artistName: '', role: '', isHeadliner: false }]);
  }

  function updateLineupSlot(index: number, patch: Partial<LineupSlot>): void {
    setLineup((current) => current.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  }

  function removeLineupSlot(index: number): void {
    setLineup((current) => current.filter((_, i) => i !== index));
  }

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        title,
        subtitle: subtitle || undefined,
        kind,
        eventStatus,
        description: description || undefined,
        personaKey: personaKey || undefined,
        venueId: venueId || undefined,
        venueNameOverride: venueId ? undefined : venueNameOverride || undefined,
        programId: programId || undefined,
        startsAt,
        endsAt: endsAt || undefined,
        ticketUrl: ticketUrl || undefined,
        ticketPriceMin: ticketPriceMin ? Number(ticketPriceMin) : undefined,
        ticketPriceMax: ticketPriceMax ? Number(ticketPriceMax) : undefined,
        currency,
        isFree,
        isFeatured,
        flyerId: flyerId || undefined,
        lineup: lineup
          .filter((slot) => slot.artistName.trim().length > 0)
          .map((slot) => ({ artistName: slot.artistName, role: slot.role || undefined, isHeadliner: slot.isHeadliner })),
      };
      if (id) {
        await request(`admin/events/${id}`, { method: 'PATCH', body });
      } else {
        await request('admin/events', { method: 'POST', body });
      }
      router.push('/events');
    } catch {
      setError('Could not save this event. Check that a venue or venue name is set, and dates are valid.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-fg-muted text-sm">Loading…</p>;

  const preview = slug ? previewUrl(`/events/${slug}`) : null;

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h2 text-fg-strong">{id ? 'Edit event' : 'New event'}</h1>
        {preview ? (
          <a href={preview} target="_blank" rel="noopener noreferrer" className="text-accent text-sm underline">
            Preview live →
          </a>
        ) : null}
      </div>
      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        className="mt-6 space-y-4"
      >
        <div>
          <label htmlFor="title" className="text-fg-strong text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            required
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="subtitle" className="text-fg-strong text-sm font-medium">
            Subtitle
          </label>
          <input
            id="subtitle"
            value={subtitle}
            onChange={(event) => {
              setSubtitle(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="kind" className="text-fg-strong text-sm font-medium">
              Kind
            </label>
            <select
              id="kind"
              value={kind}
              onChange={(event) => {
                setKind(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            >
              {EVENT_KINDS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="eventStatus" className="text-fg-strong text-sm font-medium">
              Event status
            </label>
            <select
              id="eventStatus"
              value={eventStatus}
              onChange={(event) => {
                setEventStatus(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            >
              {EVENT_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="personaKey" className="text-fg-strong text-sm font-medium">
              Persona
            </label>
            <select
              id="personaKey"
              value={personaKey}
              onChange={(event) => {
                setPersonaKey(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            >
              {personaKeyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="programId" className="text-fg-strong text-sm font-medium">
              Program (residency)
            </label>
            <select
              id="programId"
              value={programId}
              onChange={(event) => {
                setProgramId(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            >
              {programOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="venueId" className="text-fg-strong text-sm font-medium">
            Venue
          </label>
          <select
            id="venueId"
            value={venueId}
            onChange={(event) => {
              setVenueId(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          >
            {venueOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {!venueId ? (
          <div>
            <label htmlFor="venueNameOverride" className="text-fg-strong text-sm font-medium">
              Venue name (no venue on file — required if no venue is selected)
            </label>
            <input
              id="venueNameOverride"
              value={venueNameOverride}
              onChange={(event) => {
                setVenueNameOverride(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startsAt" className="text-fg-strong text-sm font-medium">
              Starts at
            </label>
            <input
              id="startsAt"
              type="datetime-local"
              required
              value={startsAt}
              onChange={(event) => {
                setStartsAt(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            />
          </div>
          <div>
            <label htmlFor="endsAt" className="text-fg-strong text-sm font-medium">
              Ends at
            </label>
            <input
              id="endsAt"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => {
                setEndsAt(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            />
          </div>
        </div>
        <div>
          <label htmlFor="description" className="text-fg-strong text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="ticketPriceMin" className="text-fg-strong text-sm font-medium">
              Ticket from
            </label>
            <input
              id="ticketPriceMin"
              type="number"
              value={ticketPriceMin}
              onChange={(event) => {
                setTicketPriceMin(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            />
          </div>
          <div>
            <label htmlFor="ticketPriceMax" className="text-fg-strong text-sm font-medium">
              Ticket to
            </label>
            <input
              id="ticketPriceMax"
              type="number"
              value={ticketPriceMax}
              onChange={(event) => {
                setTicketPriceMax(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            />
          </div>
          <div>
            <label htmlFor="currency" className="text-fg-strong text-sm font-medium">
              Currency
            </label>
            <select
              id="currency"
              value={currency}
              onChange={(event) => {
                setCurrency(event.target.value);
              }}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
            >
              {CURRENCIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="ticketUrl" className="text-fg-strong text-sm font-medium">
            Ticket URL
          </label>
          <input
            id="ticketUrl"
            value={ticketUrl}
            onChange={(event) => {
              setTicketUrl(event.target.value);
            }}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <MediaSelect label="Flyer" value={flyerId} onChange={setFlyerId} />

        <div>
          <span className="text-fg-strong text-sm font-medium">Lineup</span>
          <div className="mt-1 space-y-2">
            {lineup.map((slot, index) => (
              <div key={index} className="border-border bg-surface flex items-center gap-2 rounded-md border p-2">
                <input
                  value={slot.artistName}
                  onChange={(event) => {
                    updateLineupSlot(index, { artistName: event.target.value });
                  }}
                  placeholder="Artist name"
                  className="w-1/2 rounded border border-border bg-bg px-2 py-1 text-sm text-fg-strong"
                />
                <input
                  value={slot.role}
                  onChange={(event) => {
                    updateLineupSlot(index, { role: event.target.value });
                  }}
                  placeholder="Role (optional)"
                  className="w-1/3 rounded border border-border bg-bg px-2 py-1 text-sm text-fg-strong"
                />
                <label className="flex items-center gap-1 text-xs text-fg-secondary">
                  <input
                    type="checkbox"
                    checked={slot.isHeadliner}
                    onChange={(event) => {
                      updateLineupSlot(index, { isHeadliner: event.target.checked });
                    }}
                    className="h-4 w-4"
                  />
                  Headliner
                </label>
                <button
                  type="button"
                  onClick={() => {
                    removeLineupSlot(index);
                  }}
                  className="text-danger text-xs underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addLineupSlot} className="text-accent mt-2 text-sm underline">
            + Add lineup slot
          </button>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-fg-strong">
            <input
              type="checkbox"
              checked={isFree}
              onChange={(event) => {
                setIsFree(event.target.checked);
              }}
              className="h-4 w-4"
            />
            Free entry
          </label>
          <label className="flex items-center gap-2 text-sm text-fg-strong">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(event) => {
                setIsFeatured(event.target.checked);
              }}
              className="h-4 w-4"
            />
            Featured
          </label>
        </div>

        {error ? (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="bg-accent text-on-accent rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? 'Saving…' : id ? 'Save changes' : 'Create event'}
        </button>
      </form>
    </div>
  );
}
