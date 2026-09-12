'use client';

import { useActionState, useEffect } from 'react';

import { TurnstileWidget } from '../../../components/turnstile-widget';
import { track } from '../../../lib/analytics';

import { submitInquiry, type BookFormState } from './actions';

const EVENT_TYPES = [
  { value: 'WEDDING', label: 'Wedding / sangeet' },
  { value: 'CORPORATE', label: 'Corporate event' },
  { value: 'CLUB', label: 'Club night' },
  { value: 'FESTIVAL', label: 'Festival' },
  { value: 'PRIVATE', label: 'Private party' },
];

const initialState: BookFormState = {};

/**
 * The one client leaf on `/book`. Progressive enhancement holds even here:
 * the `<form>` still works with JavaScript disabled (it posts to the server
 * action's endpoint directly) — `useActionState` only adds the inline error
 * message on top.
 */
export function BookForm(): React.JSX.Element {
  const [state, formAction, pending] = useActionState(submitInquiry, initialState);

  useEffect(() => {
    track('booking_started');
  }, []);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {/* Honeypot: hidden from sighted users via CSS, not `type="hidden"` —
          a bot that fills every visible-looking field still trips it. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="text-fg-strong text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            autoComplete="name"
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="email" className="text-fg-strong text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="phone" className="text-fg-strong text-sm font-medium">
            Phone (optional)
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="eventType" className="text-fg-strong text-sm font-medium">
            Event type
          </label>
          <select
            id="eventType"
            name="eventType"
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          >
            {EVENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="eventDate" className="text-fg-strong text-sm font-medium">
            Event date (optional)
          </label>
          <input
            id="eventDate"
            name="eventDate"
            type="date"
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="city" className="text-fg-strong text-sm font-medium">
            City
          </label>
          <input
            id="city"
            name="city"
            autoComplete="address-level2"
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="guestCount" className="text-fg-strong text-sm font-medium">
            Guest count (optional)
          </label>
          <input
            id="guestCount"
            name="guestCount"
            type="number"
            min={1}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
        <div>
          <label htmlFor="budgetMax" className="text-fg-strong text-sm font-medium">
            Budget (₹, optional)
          </label>
          <input
            id="budgetMax"
            name="budgetMax"
            type="number"
            min={0}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
          />
        </div>
      </div>

      <div>
        <label htmlFor="message" className="text-fg-strong text-sm font-medium">
          Tell us about the event
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-strong"
        />
      </div>

      <TurnstileWidget />

      {state.error ? (
        <p role="alert" className="text-danger text-sm">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-on-accent rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send enquiry'}
      </button>
    </form>
  );
}
