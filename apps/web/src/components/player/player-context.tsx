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
  soundcloudTrackApiUrl,
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
  isMuted: boolean;
  play: (track: PlayerTrack) => void;
  toggle: () => void;
  close: () => void;
  seek: (ratio: number) => void;
  toggleMute: () => void;
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
  const [isMuted, setIsMuted] = useState(false);
  // Whether the SoundCloud iframe/widget has ever been needed. Flips true
  // once, on the first SoundCloud track played, and never back — see the
  // widget-mount effect below for why it then stays mounted for good.
  const [hasSoundCloud, setHasSoundCloud] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const widgetRef = useRef<SoundCloudWidget | null>(null);
  const isMutedRef = useRef(false);
  const currentRef = useRef<PlayerTrack | null>(null);
  /** The very first SoundCloud track ever played — the iframe's initial
   * (and only ever) `src`. Every track after that loads via `widget.load()`. */
  const initialTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  // Mount the SoundCloud widget exactly once, on the first SoundCloud track
  // played, and never again — this is the whole fix for "playback gets
  // stuck from the second track onward" and for "closing the player
  // crashes the page".
  //
  // The previous version of this effect re-ran on every track change and
  // changed the iframe's own `src` to switch tracks. Reassigning an
  // iframe's `src` makes the browser navigate it to a brand-new document,
  // which tears down whatever was listening inside it — so the widget had
  // to be destroyed and rebuilt from scratch on every single track, was
  // only briefly interactive once its fresh document's own `READY` event
  // fired, and its old listeners were being unbound on a document that was
  // already gone (which is what crashed on close — `unbind()` reaching
  // into a torn-down iframe). SoundCloud's Widget API has a documented,
  // correct way to change the loaded track without any of that:
  // `widget.load(url, options)`, called on the *same* long-lived widget
  // instance. So the iframe is now created once, the widget is bound once,
  // and `play()` below calls `.load()` for every track after the first —
  // the widget, its listeners and its document all stay exactly the same
  // for the whole session.
  useEffect(() => {
    if (!hasSoundCloud) return;

    let cancelled = false;
    const iframe = iframeRef.current;
    if (!iframe) return;

    void loadSoundCloudApi().then(() => {
      if (cancelled || !window.SC) return;
      const widget = window.SC.Widget(iframe);
      const events = window.SC.Widget.Events;

      widget.bind(events.READY, () => {
        if (cancelled) return;
        widgetRef.current = widget;
        widget.setVolume(isMutedRef.current ? 0 : 100);
      });
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

    // Only ever runs on a real provider unmount (deps never change once
    // `hasSoundCloud` flips true) — but guarded regardless, since a widget
    // method reaching into an iframe document that the browser has already
    // torn down (e.g. on a fast page unload) is exactly what used to throw
    // and crash the whole app on close.
    return () => {
      cancelled = true;
      const widget = widgetRef.current;
      const events = window.SC?.Widget.Events;
      if (!widget || !events) return;
      try {
        widget.unbind(events.READY);
        widget.unbind(events.PLAY);
        widget.unbind(events.PAUSE);
        widget.unbind(events.FINISH);
        widget.unbind(events.PLAY_PROGRESS);
      } catch {
        // Best-effort cleanup on teardown — nothing left to recover into.
      }
    };
  }, [hasSoundCloud]);

  const play = useCallback((track: PlayerTrack) => {
    const previous = currentRef.current;

    // Re-pressing play on the track already loaded should resume it, not
    // reload anything or lose the position.
    if (previous?.id === track.id) {
      widgetRef.current?.play();
      void audioRef.current?.play();
      setIsPlaying(true);
      return;
    }

    setProgress(0);
    setDurationMs(0);
    setCurrent(track);
    setIsPlaying(true);

    if (track.soundcloudTrackId) {
      if (!initialTrackIdRef.current) {
        // First SoundCloud track this session: this is what the iframe
        // mounts with (its `src`, set once below) and its `auto_play`
        // starts it — nothing further to call here.
        initialTrackIdRef.current = track.soundcloudTrackId;
        setHasSoundCloud(true);
      } else {
        // Widget already exists — swap the loaded sound in place.
        widgetRef.current?.load(soundcloudTrackApiUrl(track.soundcloudTrackId), { auto_play: true });
      }
    }
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
    // Pauses only — the widget/iframe stay mounted (see the widget-mount
    // effect above). Tearing them down here is exactly what used to crash
    // the page: the widget would be destroyed mid-flight, and either a
    // pending async callback or the next `play()` would reach into an
    // iframe document that no longer existed.
    widgetRef.current?.pause();
    audioRef.current?.pause();
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

  const toggleMute = useCallback(() => {
    setIsMuted((previous) => {
      const next = !previous;
      widgetRef.current?.setVolume(next ? 0 : 100);
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ current, isPlaying, progress, durationMs, isMuted, play, toggle, close, seek, toggleMute }),
    [current, isPlaying, progress, durationMs, isMuted, play, toggle, close, seek, toggleMute],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}

      {/* Transports. Invisible, and — once created — never unmounted, even
          across navigation or the player being closed: that's what keeps
          both a single audio session alive and, for the SoundCloud widget,
          what keeps it from having to be torn down and rebuilt (and
          re-`READY`-raced) on every track. Its `src` is set once, to
          whichever track happened to be the first played this session;
          every track after that changes via `widget.load()` in `play()`
          above, never by touching this attribute again. */}
      {hasSoundCloud && initialTrackIdRef.current ? (
        <iframe
          ref={iframeRef}
          title="Audio player"
          src={soundcloudWidgetUrl(initialTrackIdRef.current, true)}
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
          muted={isMuted}
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
