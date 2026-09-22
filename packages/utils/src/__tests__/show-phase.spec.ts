import { describe, expect, it } from 'vitest';

import { isTicketable, resolveShowPhase, showPhaseLabel } from '../show-phase.js';
import type { EventPhaseInput } from '../show-phase.js';

const NOW = new Date('2026-06-15T18:00:00.000Z');

function at(offsetHours: number): Date {
  return new Date(NOW.getTime() + offsetHours * 60 * 60 * 1000);
}

function show(overrides: Partial<EventPhaseInput> = {}): EventPhaseInput {
  return {
    startsAt: at(48),
    endsAt: null,
    eventStatus: 'CONFIRMED',
    onSaleFrom: null,
    earlyBirdUntil: null,
    ticketUrl: null,
    ...overrides,
  };
}

describe('resolveShowPhase', () => {
  it('reports a show inside its stated window as live', () => {
    expect(
      resolveShowPhase(show({ startsAt: at(-1), endsAt: at(3) }), NOW),
    ).toBe('live');
  });

  it('keeps an end-time-less show live for its assumed six-hour run', () => {
    // A club night with no endsAt is still on at 2am. Treating it as past the
    // minute after doors would drop it out of "Happening now" while he plays.
    expect(resolveShowPhase(show({ startsAt: at(-5), endsAt: null }), NOW)).toBe('live');
    expect(resolveShowPhase(show({ startsAt: at(-7), endsAt: null }), NOW)).toBe('past');
  });

  it('treats a cancelled or postponed show as such even during its slot', () => {
    const during = { startsAt: at(-1), endsAt: at(3) };
    expect(resolveShowPhase(show({ ...during, eventStatus: 'CANCELLED' }), NOW)).toBe('cancelled');
    expect(resolveShowPhase(show({ ...during, eventStatus: 'POSTPONED' }), NOW)).toBe('postponed');
  });

  it('reports a finished show as past', () => {
    expect(resolveShowPhase(show({ startsAt: at(-48), endsAt: at(-44) }), NOW)).toBe('past');
    expect(resolveShowPhase(show({ eventStatus: 'COMPLETED' }), NOW)).toBe('past');
  });

  it('prefers early bird over plain on-sale while the window is open', () => {
    const phase = resolveShowPhase(
      show({ earlyBirdUntil: at(24), ticketUrl: 'https://tickets.example/x' }),
      NOW,
    );
    expect(phase).toBe('early-bird');
  });

  it('falls back to on-sale once the early-bird window shuts', () => {
    const phase = resolveShowPhase(
      show({ earlyBirdUntil: at(-1), ticketUrl: 'https://tickets.example/x' }),
      NOW,
    );
    expect(phase).toBe('on-sale');
  });

  it('stays announced until tickets actually go on sale', () => {
    // The whole point of storing onSaleFrom rather than a typed-in badge: the
    // page stops claiming tickets exist before they do, on its own.
    expect(
      resolveShowPhase(
        show({ onSaleFrom: at(10), earlyBirdUntil: at(20), ticketUrl: 'https://t.example/x' }),
        NOW,
      ),
    ).toBe('announced');
  });

  it('stays announced when there is no ticket link at all', () => {
    expect(resolveShowPhase(show(), NOW)).toBe('announced');
  });

  it('reports a sold-out future show as sold out', () => {
    expect(
      resolveShowPhase(
        show({ eventStatus: 'SOLD_OUT', ticketUrl: 'https://t.example/x' }),
        NOW,
      ),
    ).toBe('sold-out');
  });

  it('never offers tickets for a phase that cannot sell them', () => {
    expect(isTicketable('early-bird')).toBe(true);
    expect(isTicketable('on-sale')).toBe(true);
    expect(isTicketable('cancelled')).toBe(false);
    expect(isTicketable('sold-out')).toBe(false);
    expect(isTicketable('past')).toBe(false);
  });

  it('labels every phase', () => {
    expect(showPhaseLabel('live')).toBe('Happening now');
    expect(showPhaseLabel('early-bird')).toBe('Early bird');
  });
});
