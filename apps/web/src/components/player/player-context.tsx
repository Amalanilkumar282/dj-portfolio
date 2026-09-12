'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export interface PlayerTrack {
  id: string;
  title: string;
  artistLabel: string;
  audioUrl: string;
}

interface PlayerState {
  current: PlayerTrack | null;
  isPlaying: boolean;
  play: (track: PlayerTrack) => void;
  toggle: () => void;
  close: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const PlayerContext = createContext<PlayerState | null>(null);

/**
 * Lives in `(marketing)/layout.tsx`, above the route slot, so App Router
 * never unmounts it across navigations — playback surviving a page change
 * is the entire point of a "mini player" (masterplan §5.6 item 7).
 *
 * This is the documented *fallback tier*: a real `<audio>` element and plain
 * controls, not wavesurfer.js's precomputed-peaks waveform — there is no
 * real audio in the catalogue yet to justify that dependency (gap #4), and
 * the fallback is what a reduced-motion/no-JS-enhancement visitor gets
 * regardless. Upgrading to the waveform renderer is a drop-in addition once
 * real tracks exist, not a rewrite of this contract.
 */
export function PlayerProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [current, setCurrent] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback((track: PlayerTrack) => {
    setCurrent(track);
    setIsPlaying(true);
    // The <audio> element re-mounts its src on the next render; autoplay is
    // requested there via the `autoPlay` prop rather than here, since the
    // ref may still point at the previous track's element on this tick.
  }, []);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }, []);

  const close = useCallback(() => {
    audioRef.current?.pause();
    setCurrent(null);
    setIsPlaying(false);
  }, []);

  const value = useMemo(
    () => ({ current, isPlaying, play, toggle, close, audioRef }),
    [current, isPlaying, play, toggle, close],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within <PlayerProvider>');
  return ctx;
}
