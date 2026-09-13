import { getSettings } from '../server/queries/settings';

/**
 * The persistent WhatsApp/call dock.
 *
 * Per the artist's own account, WhatsApp and a phone call are how nearly
 * every real booking actually starts — not the contact form. So those two
 * channels get a fixed, always-visible affordance on every marketing page,
 * not just a line of text on /contact. A Server Component: two `<a>` tags,
 * no JS, nothing to hydrate.
 *
 * Sits above the mini player's `z-40` so it stays reachable while a track is
 * loaded, and clears the mini player's height on small screens via `bottom`
 * offsets set with plain CSS rather than JS measurement.
 */
export async function ContactDock(): Promise<React.JSX.Element | null> {
  const settings = await getSettings();
  if (!settings.whatsappNumber && !settings.contactPhone) return null;

  return (
    <div
      // Below the consent banner's z-50: while a first-time visitor hasn't
      // decided yet, that notice — which needs an explicit choice — takes
      // priority over an always-present convenience button.
      className="fixed inset-x-0 z-40 flex justify-center gap-3 px-(--spacing-gutter) sm:inset-x-auto sm:right-6 sm:justify-end"
      style={{
        // `--dock-clearance` (the mini player) and `--consent-clearance`
        // (the cookie notice) are each set only while that element is on
        // screen, so this stacks above whichever combination is present
        // without either of those components knowing about this one.
        bottom:
          'calc(1rem + var(--dock-clearance, 0px) + var(--consent-clearance, 0px) + env(safe-area-inset-bottom))',
      }}
    >
      {settings.whatsappNumber ? (
        <a
          href={`https://wa.me/${settings.whatsappNumber.replace(/[^\d]/g, '')}?text=${encodeURIComponent('Hi! I want to book DJ Felicitous for an event.')}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Message on WhatsApp"
          className="bg-success text-on-accent hover-hover:hover:brightness-110 motion-ok:active:scale-95 flex size-14 items-center justify-center rounded-full shadow-lg transition-[transform,filter] duration-(--duration-fast)"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7 fill-current">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.79 14.15c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.11.11-1.79-.11-.41-.13-.94-.3-1.62-.6-2.85-1.23-4.71-4.11-4.85-4.3-.14-.19-1.16-1.55-1.16-2.96 0-1.4.73-2.09 1-2.38.26-.28.57-.35.76-.35.19 0 .38 0 .55.01.18.01.42-.07.65.5.24.58.81 2 .88 2.14.07.15.12.32.02.51-.09.19-.14.31-.28.48-.14.16-.29.36-.42.49-.14.14-.28.29-.12.57.16.28.71 1.17 1.52 1.9 1.05.94 1.93 1.23 2.21 1.37.28.14.44.12.61-.07.16-.19.7-.82.89-1.1.19-.28.38-.23.63-.14.26.09 1.63.77 1.91.91.28.14.47.21.53.33.07.12.07.68-.17 1.36Z" />
          </svg>
        </a>
      ) : null}
      {settings.contactPhone ? (
        <a
          href={`tel:${settings.contactPhone}`}
          aria-label={`Call ${settings.contactPhone}`}
          className="bg-accent text-on-accent hover-hover:hover:bg-accent-strong motion-ok:active:scale-95 hidden size-14 items-center justify-center rounded-full shadow-lg transition-[transform,background-color] duration-(--duration-fast) sm:flex"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-current">
            <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2Z" />
          </svg>
        </a>
      ) : null}
    </div>
  );
}
