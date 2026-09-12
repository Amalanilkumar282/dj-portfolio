'use client';

import { useEffect, useMemo, useRef } from 'react';

/**
 * A bar field that reacts to playback.
 *
 * **Deliberately not called a waveform.** A waveform is a claim about a
 * specific recording's amplitude over time, and this is not that: the
 * catalogue has no stored `waveformPeaks`, and the audio plays inside a
 * cross-origin SoundCloud iframe, so Web Audio cannot analyse it either.
 * Drawing invented peaks and labelling them a waveform would be a small
 * fabrication of exactly the kind this project refuses elsewhere.
 *
 * What it *is*: a stable per-track pattern (seeded from the track id, so a
 * given track always looks the same) animated on the track's **real BPM**.
 * The tempo is genuine data; the bar heights are ornament and never
 * presented as anything else.
 *
 * Renders as inert SVG when paused or under reduced motion — no canvas, no
 * rAF, nothing running.
 */
export function RhythmField({
  seed,
  bpm,
  active,
  bars = 28,
  className,
}: {
  seed: string;
  bpm: number | null;
  active: boolean;
  bars?: number;
  className?: string;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  // Stable pseudo-random heights from the track id. Same track, same shape,
  // every render and every visit.
  const heights = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;

    return Array.from({ length: bars }, (_, index) => {
      hash = (hash * 1664525 + 1013904223) >>> 0;
      const base = (hash % 1000) / 1000;
      // Bias toward a centre-weighted shape so it reads as a level meter
      // rather than random noise.
      const centre = 1 - Math.abs(index / (bars - 1) - 0.5) * 1.3;
      return 0.22 + base * 0.5 * Math.max(0.25, centre);
    });
  }, [seed, bars]);

  // One CSS animation per bar, phase-offset, with the beat period as the
  // duration. No JS loop — the compositor handles it, and the reduced-motion
  // token kill switch stops it without this component knowing.
  const beatSeconds = bpm && bpm > 0 ? 60 / bpm : 0.5;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.setProperty('--beat', `${beatSeconds.toFixed(3)}s`);
  }, [beatSeconds]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={['flex items-end gap-[2px]', className].filter(Boolean).join(' ')}
    >
      {heights.map((height, index) => (
        <span
          key={index}
          className={[
            'bg-accent flex-1 rounded-full',
            active ? 'motion-ok:animate-[rhythm-pulse_var(--beat)_ease-in-out_infinite]' : '',
          ].join(' ')}
          style={{
            height: `${String(Math.round(height * 100))}%`,
            opacity: active ? 0.9 : 0.35,
            // Phase offset gives the field a travelling feel at the real tempo.
            animationDelay: `${((index % 7) * 0.06).toFixed(2)}s`,
            transition: 'opacity var(--duration-base) var(--ease-out-quart)',
          }}
        />
      ))}
    </div>
  );
}
