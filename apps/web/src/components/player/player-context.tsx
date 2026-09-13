'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  loadSoundCloudApi,
  soundcloudWidgetUrl,
  type SoundCloudWidget,
} from './soundcloud';

export interface PlayerTrack {
  id: string;
  slug: string;
  title: string;
  artistLabel: string;
  /** Real BPM where the catalogue has one. Drives the beat swell; never invented. */
  bpm: number | null;
  /** Self-hosted audio. None exists yet, but the path is wired for when it does. */
  audioUrl: string | null;
  /** The real playback source for all 19 catalogue tracks today. */
  soundcloudTrackId: string | null;
}

interface PlayerState {
  current: PlayerTrack | null;
  isPlaying: boolean;
  /** 0–1. Drives the deck platter and the seek control. */
  progress: number;
  durationMs: number;
  play: (track: PlayerTrack) => void;
  toggle: () => void;
  close: () => void;
  seek: (ratio: number) => void;
}

const PlayerContext = createContext<PlayerState | null>(null);

/**
 * Owns playback for the whole site.
 *
 * Lives in `(marketing)/layout.tsx`, above the route slot, so App Router
 * never unmounts it — playback surviving navigation is the entire point of a
 * mini player (motion.md item 7).
 *
 * Both media elements live here rather than in the MiniPlayer UI, so audio
 * is not at the mercy of whether a piece of chrome happens to be rendered.
 * Two transports are supported: a plain `<audio>` for self-hosted files, and
 * an invisible SoundCloud iframe driven by the Widget API, which is what all
 * 19 real catalogue tracks actually use.
 */
export function PlayerProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [current, setCurrent] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const widgetRef = useRef<SoundCloudWidget | null>(null);

  const usesSoundCloud = current?.soundcloudTrackId != null;

  // Wire the widget whenever the SoundCloud track changes. The iframe `src`
  // carries auto_play, so a fresh track starts on its own; binding here only
  // keeps our UI in step with what the widget is actually doing.
  useEffect(() => {
    if (!usesSoundCloud) {
      widgetRef.current = null;
      return;
    }

    let cancelled = false;
    const iframe = iframeRef.current;
    if (!iframe) return;

    void loadSoundCloudApi().then(() => {
      if (cancelled || !window.SC) return;
      const widget = window.SC.Widget(iframe);
      widgetRef.current = widget;

      const events = window.SC.Widget.Events;
      widget.bind(events.PLAY, () => {
        setIsPlaying(true);
        widget.getDuration((value) => {
          setDurationMs(value);
        });
      });
      widget.bind(events.PAUSE, () => {
        setIsPlaying(false);
      });
      widget.bind(events.FINISH, () => {
        setIsPlaying(false);
        setProgress(1);
      });
      widget.bind(events.PLAY_PROGRESS, () => {
        widget.getPosition((position) => {
          widget.getDuration((total) => {
            if (total > 0) setProgress(position / total);
          });
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [usesSoundCloud, current?.soundcloudTrackId]);

  const play = useCallback((track: PlayerTrack) => {
    setCurrent((previous) => {
      // Re-pressing play on the track already loaded should resume it, not
      // reload the iframe and lose the position.
      if (previous?.id === track.id) {
        widgetRef.current?.play();
        void audioRef.current?.play();
        return previous;
      }
      setProgress(0);
      setDurationMs(0);
      return track;
    });
    setIsPlaying(true);
  }, []);

  const toggle = useCallback(() => {
    if (widgetRef.current) {
      if (isPlaying) widgetRef.current.pause();
      else widgetRef.current.play();
      return;
    }

    const element = audioRef.current;
    if (!element) return;
    if (element.paused) {
      void element.play();
      setIsPlaying(true);
    } else {
      element.pause();
      setIsPlaying(false);
    }
  }, [isPlaying]);

  const close = useCallback(() => {
    widgetRef.current?.pause();
    audioRef.current?.pause();
    widgetRef.current = null;
    setCurrent(null);
    setIsPlaying(false);
    setProgress(0);
  }, []);

  const seek = useCallback(
    (ratio: number) => {
      const clamped = Math.min(1, Math.max(0, ratio));
      if (widgetRef.current && durationMs > 0) {
        widgetRef.current.seekTo(clamped * durationMs);
        setProgress(clamped);
        return;
      }
      const element = audioRef.current;
      if (element && Number.isFinite(element.duration)) {
        element.currentTime = clamped * element.duration;
        setProgress(clamped);
      }
    },
    [durationMs],
  );

  const value = useMemo(
    () => ({ current, isPlaying, progress, durationMs, play, toggle, close, seek }),
    [current, isPlaying, progress, durationMs, play, toggle, close, seek],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}

      {/* Transports. Invisible, but never unmounted while something is
          loaded — that is what keeps audio alive across navigation. */}
      {current?.soundcloudTrackId ? (
        <iframe
          ref={iframeRef}
          title={`${current.title} — audio`}
          src={soundcloudWidgetUrl(current.soundcloudTrackId, true)}
          allow="autoplay"
          className="pointer-events-none absolute h-0 w-0 border-0 opacity-0"
          aria-hidden="true"
        />
      ) : null}

      {current?.audioUrl ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- instrumental DJ mixes, no dialogue to caption; the accessible interface is the MiniPlayer's transport controls, not this element
        <audio
          ref={audioRef}
          src={current.audioUrl}
          crossOrigin="anonymous"
          autoPlay
          onTimeUpdate={(event) => {
            const element = event.currentTarget;
            if (element.duration > 0) setProgress(element.currentTime / element.duration);
          }}
          onEnded={() => {
            setIsPlaying(false);
          }}
          className="hidden"
        />
      ) : null}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within <PlayerProvider>');
  return ctx;
}
