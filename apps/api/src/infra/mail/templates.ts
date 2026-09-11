import { formatIstDate, formatINR } from '@dj/utils';

/**
 * Email bodies as small string builders, not React Email components.
 *
 * The masterplan called for React Email; this is a deliberate, documented
 * scope reduction for Group B — plain HTML strings are simple enough for
 * three transactional emails and avoid a second templating dependency and
 * build step. Revisit with `@react-email/components` if the template count
 * or design ambition grows. See STATUS.md.
 */

const WRAPPER_START = `<!doctype html><html><body style="font-family:-apple-system,sans-serif;background:#0a0a0a;color:#f5f5f5;padding:32px;margin:0">
<div style="max-width:560px;margin:0 auto;background:#141414;border-radius:12px;padding:32px">`;
const WRAPPER_END = `</div></body></html>`;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

export interface BookingInquirySummary {
  reference: string;
  name: string;
  email: string;
  phone: string | null;
  eventType: string;
  eventDate: Date | null;
  city: string | null;
  personaLabel: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  message: string | null;
}

export function bookingInquiryNotification(input: BookingInquirySummary): { html: string; text: string } {
  const rows: [string, string][] = [
    ['Reference', input.reference],
    ['Name', input.name],
    ['Email', input.email],
    ['Phone', input.phone ?? '—'],
    ['Event type', input.eventType],
    ['Event date', input.eventDate ? formatIstDate(input.eventDate) : 'Flexible / not set'],
    ['City', input.city ?? '—'],
    ['Persona requested', input.personaLabel ?? 'Any'],
    [
      'Budget',
      input.budgetMin != null || input.budgetMax != null
        ? `${input.budgetMin != null ? formatINR(input.budgetMin) : '?'} – ${input.budgetMax != null ? formatINR(input.budgetMax) : '?'}`
        : 'Not specified',
    ],
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#a3a3a3;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join('');

  const html = `${WRAPPER_START}
<h1 style="font-size:20px;margin:0 0 16px">New booking enquiry — ${escapeHtml(input.reference)}</h1>
<table style="width:100%;border-collapse:collapse;font-size:14px">${rowsHtml}</table>
${input.message ? `<p style="margin-top:16px;padding-top:16px;border-top:1px solid #262626;white-space:pre-wrap">${escapeHtml(input.message)}</p>` : ''}
${WRAPPER_END}`;

  const text = [
    `New booking enquiry — ${input.reference}`,
    ...rows.map(([label, value]) => `${label}: ${value}`),
    input.message ? `\n${input.message}` : '',
  ].join('\n');

  return { html, text };
}

export function bookingInquiryAutoresponder(input: {
  name: string;
  reference: string;
  responseTimePromise: string;
  whatsappUrl: string | null;
}): { html: string; text: string } {
  const html = `${WRAPPER_START}
<h1 style="font-size:20px;margin:0 0 16px">Thanks, ${escapeHtml(input.name)} — got your enquiry</h1>
<p>Your reference is <strong>${escapeHtml(input.reference)}</strong>. ${escapeHtml(input.responseTimePromise)}.</p>
${input.whatsappUrl ? `<p style="margin-top:16px"><a href="${input.whatsappUrl}" style="color:#25D366">Message on WhatsApp →</a></p>` : ''}
${WRAPPER_END}`;

  const text = [
    `Thanks, ${input.name} — got your enquiry`,
    `Reference: ${input.reference}`,
    input.responseTimePromise,
    input.whatsappUrl ? `WhatsApp: ${input.whatsappUrl}` : '',
  ].join('\n');

  return { html, text };
}

export function newsletterConfirm(input: { confirmUrl: string }): { html: string; text: string } {
  const html = `${WRAPPER_START}
<h1 style="font-size:20px;margin:0 0 16px">Confirm your subscription</h1>
<p>One click and you're on the list.</p>
<p style="margin-top:16px"><a href="${input.confirmUrl}" style="color:#2dd4bf">Confirm subscription →</a></p>
${WRAPPER_END}`;

  const text = `Confirm your subscription: ${input.confirmUrl}`;

  return { html, text };
}
