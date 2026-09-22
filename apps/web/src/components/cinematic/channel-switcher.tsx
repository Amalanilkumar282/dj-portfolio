'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { MediaImage } from '@dj/contracts';
import { Chip } from '@dj/ui/primitives';

import { personaThemeName } from '../../lib/site';
import { CloudinaryImage } from '../cloudinary-image';

/**
 * The channel switcher — the signature module.
 *
 * Tuning to a channel repaints the entire viewport, not just this component:
 * setting `--color-accent` on `documentElement` is picked up by every
 * `bg-accent`, `text-accent` and `shadow-glow` on the page at once, and
 * theme.css already registers that property via `@property` with a
 * `--duration-slow` transition, so it crossfades instead of snapping. That
 * registration exists specifically for this module. Under reduced motion the
 * duration token is 1ms, so it snaps — no second code path.
 *
 * Colours come from each persona's CMS `accentColor`, so the artist can
 * retune a channel from the admin without a deploy.
 */

export interface Channel {
  id: string;
  slug: string;
  key: string;
  stageName: string;
  subtitle: string | null;
  shortDescription: string | null;
  primaryGenreLabel: string | null;
  accentColor: string;
  accentColorSecondary: string | null;
  gradientCss: string | null;
  trackCount: number;
  avatarImage: MediaImage | null;
}

const ACCENT_PROPS = ['--color-accent', '--color-accent-strong', '--gradient-persona'] as const;

export function ChannelSwitcher({
  channels,
  onTune,
}: {
  channels: Channel[];
  onTune?: (themeKey: string | null) => void;
}): React.JSX.Element {
  const [active, setActive] = useState<number | null>(null);
  const [wipeKey, setWipeKey] = useState(0);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const tune = useCallback(
    (index: number | null) => {
      const root = document.documentElement;
      const channel = index === null ? null : channels[index];

      if (!channel) {
        for (const prop of ACCENT_PROPS) root.style.removeProperty(prop);
      } else {
        root.style.setProperty('--color-accent', channel.accentColor);
        root.style.setProperty(
          '--color-accent-strong',
          channel.accentColorSecondary ?? channel.accentColor,
        );
        if (channel.gradientCss) root.style.setProperty('--gradient-persona', channel.gradientCss);
      }

      // A custom-property change fires no event of its own; the shader reads
      // the accent off the DOM, so this tells it to look again.
      window.dispatchEvent(new Event('dj:accent-change'));

      setActive(index);
      onTune?.(channel ? personaThemeName(channel.key) : null);
      if (channel) setWipeKey((key) => key + 1);
    },
    [channels, onTune],
  );

  // Never leave a tuned accent behind on navigation — the next page has its
  // own theme, and an inline style on <html> would override it.
  useEffect(() => {
    return () => {
      const root = document.documentElement;
      for (const prop of ACCENT_PROPS) root.style.removeProperty(prop);
    };
  }, []);

  function onKeyDown(event: React.KeyboardEvent, index: number): void {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = (index + delta + channels.length) % channels.length;
    itemRefs.current[next]?.focus();
    tune(next);
  }

  return (
    // Pointer-only: leaving the rail returns the site to its default accent.
    // Not an interactive element - there is nothing to activate here, and
    // every channel inside is a real focusable <a> with its own handlers.
    <div
      className="relative"
      onMouseLeave={() => {
        tune(null);
      }}
      role="presentation"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          key={wipeKey}
          className="motion-ok:animate-[channel-wipe_var(--duration-slow)_var(--ease-out-quart)] absolute -inset-x-1/4 inset-y-0 opacity-0"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--color-accent-soft), transparent)',
          }}
        />
      </div>

      <ul className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible">
        {channels.map((channel, index) => {
          const isActive = active === index;
          return (
            <li key={channel.id} className="min-w-[78%] snap-start sm:min-w-[46%] lg:min-w-0">
              <Link
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                href={`/${channel.slug}`}
                data-theme={personaThemeName(channel.key)}
                onMouseEnter={() => {
                  tune(index);
                }}
                onFocus={() => {
                  tune(index);
                }}
                onKeyDown={(event) => {
                  onKeyDown(event, index);
                }}
                className={[
                  'group border-border bg-surface/60 relative flex h-full min-h-56 flex-col justify-between overflow-hidden rounded-lg border p-5 backdrop-blur-(--blur-glass)',
                  'transition-[border-color,transform,box-shadow] duration-(--duration-base) ease-(--ease-out-quart)',
                  'hover-hover:hover:border-accent motion-ok:hover-hover:hover:-translate-y-1',
                  isActive ? 'border-accent shadow-glow' : '',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-1 opacity-70"
                  style={{ background: 'var(--gradient-persona)' }}
                />

                <span className="flex items-start justify-between gap-3">
                  <span className="text-eyebrow text-fg-muted font-mono uppercase">
                    CH {String(index + 1).padStart(2, '0')}
                  </span>
                  {channel.trackCount > 0 ? (
                    <span className="text-eyebrow text-fg-muted font-mono">
                      {channel.trackCount} {channel.trackCount === 1 ? 'track' : 'tracks'}
                    </span>
                  ) : null}
                </span>

                {/* min-w-0 on both the row and the text column is load-bearing:
                    a flex item's default min-width is `auto` (its content's
                    own min-content size), so without it a long, unbroken
                    stage name ("DJ Felicitous & DJ Geetz") pushed this row
                    wider than the card and the card's own `overflow-hidden`
                    clipped the tail behind the border instead of wrapping it -
                    the same class of bug already fixed on the rails and the
                    browse-act grid elsewhere in this codebase, here on a flex
                    row instead of a grid column. leading-none was also
                    fighting a second, shorter line once wrapping was allowed,
                    so it's now leading-tight and only on single-line text. */}
                <span className="mt-6 flex min-w-0 items-center gap-3">
                  {channel.avatarImage ? (
                    <span className="border-border/60 relative block size-12 shrink-0 overflow-hidden rounded-full border">
                      <CloudinaryImage
                        image={channel.avatarImage}
                        sizes="48px"
                        width={48}
                        height={48}
                        className="size-full object-cover"
                      />
                    </span>
                  ) : null}
                  <span className="min-w-0 block">
                    <span className="font-display text-h3 text-fg-strong block leading-tight break-words">
                      {channel.stageName}
                    </span>
                    {channel.subtitle ? (
                      <span className="text-fg-secondary mt-2 block truncate text-sm">
                        {channel.subtitle}
                      </span>
                    ) : null}
                  </span>
                </span>

                <span className="mt-4 flex items-center justify-between gap-3">
                  {channel.primaryGenreLabel ? (
                    <Chip tone="accent">{channel.primaryGenreLabel}</Chip>
                  ) : (
                    <span />
                  )}
                  <span
                    aria-hidden="true"
                    className="text-accent text-lg transition-transform duration-(--duration-base) ease-(--ease-out-quart) group-hover:translate-x-1"
                  >
                    &rarr;
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p aria-live="polite" className="text-fg-secondary text-lead mt-6 min-h-12 max-w-2xl">
        {active !== null ? channels[active]?.shortDescription : null}
      </p>
    </div>
  );
}
