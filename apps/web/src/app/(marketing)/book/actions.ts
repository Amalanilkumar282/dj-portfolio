'use server';

import { redirect } from 'next/navigation';

import { BookingInquiryPublicResult } from '@dj/contracts';

import { ApiError, apiPost } from '../../../lib/api-client';

export interface BookFormState {
  error?: string;
}

/**
 * Server action backing the plain `<form action={submitInquiry}>` on
 * `/book` — no client JS on the submit path, works with JavaScript
 * disabled, and posts straight to the real `POST /inquiries` endpoint.
 *
 * The multi-step wizard UX (progress, live availability, step transitions)
 * is Phase 8 ("Conversion"). This is the honest, fully-functional version
 * that phase upgrades rather than replaces.
 */
/** A blank optional field posts as `''`, which must be treated as absent, not as the literal string. */
function emptyToUndefined(value: FormDataEntryValue | null): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export async function submitInquiry(_prevState: BookFormState, formData: FormData): Promise<BookFormState> {
  const guestCountRaw = formData.get('guestCount');
  const budgetRaw = formData.get('budgetMax');

  // `redirect()` throws internally, so it must run outside this `try` — a
  // catch around it would swallow that throw and report a false failure.
  let reference: string;
  try {
    const result = await apiPost(
      '/inquiries',
      {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: emptyToUndefined(formData.get('phone')),
        eventType: emptyToUndefined(formData.get('eventType')),
        eventDate: emptyToUndefined(formData.get('eventDate')),
        city: emptyToUndefined(formData.get('city')),
        guestCount: guestCountRaw ? Number(guestCountRaw) : undefined,
        budgetMax: budgetRaw ? Number(budgetRaw) : undefined,
        message: emptyToUndefined(formData.get('message')),
        website: emptyToUndefined(formData.get('website')),
        // Turnstile is unconfigured (placeholder credentials) in every
        // non-production environment today, so verification is skipped —
        // see TurnstileService. Once a real site key exists, replace this
        // with the actual widget token from a client-side Turnstile leaf.
        turnstileToken: 'unconfigured',
      },
      BookingInquiryPublicResult,
    );
    reference = result.reference;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 429) return { error: "You've submitted a few of these already — try again shortly." };
      if (error.status === 422) return { error: 'Please check the form — something is missing or invalid.' };
    }
    return { error: 'Something went wrong submitting your enquiry. Please try again or email us directly.' };
  }

  redirect(`/book/thanks?ref=${encodeURIComponent(reference)}`);
}
