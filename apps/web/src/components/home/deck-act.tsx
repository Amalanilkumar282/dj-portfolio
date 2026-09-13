'use client';

import dynamic from 'next/dynamic';

import { MotionGate } from '@dj/motion';

import { usePlayer } from '../player/player-context';
import { RhythmField } from '../player/rhythm-field';

/**
 * The gate in front of the 3D deck.
 *
 * `dynamic(ssr: false)` cannot be called from a Server Component in Next 15,
 * and it is what keeps the `three` chunk out of the homepage's first load —
 * so the boundary has to be a client component. It is also the tier gate:
 * only `full` ever references the module, so a reduced-motion, Save-Data or
 * low-core visitor never downloads three.js at all.
 *
 * The lighter tiers are not a blank space: they get the same rhythm field the
 * mini player uses, at the real BPM of whatever is playing.
 */
const DeckScene = dynamic(() => import('./deck-scene'), { ssr: false });

export function DeckAct(): React.JSX.Element {
  return <MotionGate full={<DeckScene />} light={<DeckFallback />} static={<DeckFallback />} />;
}

function DeckFallback(): React.JSX.Element {
  const { current, isPlaying } = usePlayer();
  return (
    <div className="border-border flex aspect-[4/3] w-full flex-col justify-end rounded-md border p-8">
      <RhythmField
        seed={current?.id ?? 'idle'}
        bpm={current?.bpm ?? null}
        active={isPlaying}
        className="h-24 w-full opacity-70"
      />
      <p className="text-fg-muted mt-6 font-mono text-xs uppercase">
        {current ? `${current.title} · ${current.artistLabel}` : 'Press play on any track'}
      </p>
    </div>
  );
}
