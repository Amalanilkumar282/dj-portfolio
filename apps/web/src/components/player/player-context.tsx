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
  /**
   * True from the moment a play was requested (a fresh track, or resuming
   * the loaded one) until the transport actually confirms it started.
   * Distinct from `isPlaying` on purpose — see `play()`/`toggle()`'s doc
   * comments for why conflating the two made a still-buffering track look
   * like "started but silent" instead of visibly loading.
   */
  isLoading: boolean;
  /**
   * Set when a play request has waited too long to be confirmed (see
   * `LOAD_TIMEOUT_MS`) — most commonly a mobile browser silently blocking
   * the SoundCloud iframe's autoplay. Distinct from `isLoading` so the UI
   * can show "couldn't start, tap to retry" instead of spinning forever.
   */
  isStalled: boolean;
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

/** How long a play request can go unconfirmed before treating it as stuck.
 * Generous — a slow mobile connection can take a real few seconds to buffer
 * — but never infinite: a widget that has been silently blocked (a common
 * mobile-browser autoplay-policy outcome) or that never emits its own
 * `READY`/`PLAY` for some other reason would otherwise spin forever with
 * no way out, which is worse than a slightly-too-generous timeout. */
const LOAD_TIMEOUT_MS = 8000;

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
  /** The id of the track currently waiting to actually start — see
   * `PlayerState.isLoading`'s doc comment. */
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  /** The id of a track whose play request timed out unconfirmed — see
   * `LOAD_TIMEOUT_MS`. */
  const [stalledTrackId, setStalledTrackId] = useState<string | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  /** Starts (replacing any prior) the stall watchdog for a play request. */
  function armLoadTimeout(trackId: string): void {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = setTimeout(() => {
      setLoadingTrackId((current) => (current === trackId ? null : current));
      setStalledTrackId(trackId);
    }, LOAD_TIMEOUT_MS);
  }

  /** Called whenever a play request is actually confirmed (or abandoned) —
   * cancels the watchdog so it doesn't fire late over a track that has
   * since started fine, or been swapped for a different one. */
  function clearLoadTimeout(): void {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  }

  useEffect(
    () => () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    },
    [],
  );

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

        // The very first track has no `.load()` call to hang a `callback`
        // off — it starts via the iframe's own `src`, so this is its one
        // and only "now actually start it" trigger, fired exactly once.
        // A previous version of this ALSO relied on the iframe URL's own
        // `auto_play=true` param at the same time, i.e. two independent
        // "start this sound" commands sent over the same postMessage
        // channel moments apart. That race is what caused the exact
        // symptom reported: a track switch would intermittently report
        // "playing" (an early command's PLAY event) with no real audio, or
        // silently fail, in no reproducible pattern — because which
        // command "won" was a timing coincidence, not a decision. Every
        // start of every track now has exactly one trigger: this one for
        // the first track, `.load()`'s own `callback` for every track
        // after it (see `play()` below) — never both.
        widget.play();
      });
      widget.bind(events.PLAY, () => {
        setIsPlaying(true);
        setLoadingTrackId(null);
        setStalledTrackId(null);
        clearLoadTimeout();
        widget.getDuration((value) => {
          setDurationMs(value);
        });
      });
      widget.bind(events.PAUSE, () => {
        setIsPlaying(false);
        setLoadingTrackId(null);
        clearLoadTimeout();
      });
      widget.bind(events.FINISH, () => {
        setIsPlaying(false);
        setLoadingTrackId(null);
        clearLoadTimeout();
        setProgress(1);
      });
      widget.bind(events.PLAY_PROGRESS, () => {
        // Progress only advances while genuinely playing — a safety net for
        // `loadingTrackId` in case a `PLAY` event was ever missed, so a
        // spinner can't get stuck showing over audio that's audibly playing.
        setLoadingTrackId(null);
        setStalledTrackId(null);
        clearLoadTimeout();
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

  // `isPlaying` used to be set optimistically, synchronously, on click —
  // which meant the button flipped to its "playing" state (and, on a
  // track switch, `RhythmField` started animating) before the transport
  // had actually started any audio. On a slow mobile connection, where
  // the SoundCloud widget can take a real, perceptible moment to buffer
  // and start, that read as "it says it's playing but nothing's coming
  // out" — indistinguishable from the button being broken. `isPlaying` is
  // now only ever set from a transport's own confirmation (the widget's
  // `PLAY` event, or the `<audio>` element's `onPlaying`); `play()`/
  // `toggle()` set `loadingTrackId` instead, so the UI can show a distinct
  // "starting…" state instead of a premature "playing" one.
  const play = useCallback((track: PlayerTrack) => {
    const previous = currentRef.current;

    // Re-pressing play on the track already loaded should resume it, not
    // reload anything or lose the position.
    if (previous?.id === track.id) {
      setLoadingTrackId(track.id);
      setStalledTrackId(null);
      armLoadTimeout(track.id);
      widgetRef.current?.play();
      void audioRef.current?.play();
      return;
    }

    setProgress(0);
    setDurationMs(0);
    setCurrent(track);
    setLoadingTrackId(track.id);
    setStalledTrackId(null);
    armLoadTimeout(track.id);

    if (track.soundcloudTrackId) {
      if (!initialTrackIdRef.current) {
        // First SoundCloud track this session: this is what the iframe
        // mounts with (its `src`, set once below). The widget's own
        // `READY` handler above calls `.play()` once it's actually
        // interactive — nothing further to trigger here.
        initialTrackIdRef.current = track.soundcloudTrackId;
        setHasSoundCloud(true);
      } else {
        // Widget already exists — swap the loaded sound in place.
        // `auto_play` is deliberately omitted: `callback` is the one and
        // only trigger that starts it, once loading is actually done —
        // see the `READY` handler's doc comment for why never both.
        widgetRef.current?.load(soundcloudTrackApiUrl(track.soundcloudTrackId), {
          callback: () => {
            widgetRef.current?.play();
          },
        });
      }
    }
  }, []);

  const toggle = useCallback(() => {
    if (widgetRef.current) {
      if (isPlaying) {
        widgetRef.current.pause();
      } else {
        if (currentRef.current) {
          setLoadingTrackId(currentRef.current.id);
          setStalledTrackId(null);
          armLoadTimeout(currentRef.current.id);
        }
        widgetRef.current.play();
      }
      return;
    }

    const element = audioRef.current;
    if (!element) return;
    if (element.paused) {
      if (currentRef.current) {
        setLoadingTrackId(currentRef.current.id);
        setStalledTrackId(null);
        armLoadTimeout(currentRef.current.id);
      }
      void element.play();
    } else {
      element.pause();
      setIsPlaying(false);
      setLoadingTrackId(null);
      clearLoadTimeout();
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
    setLoadingTrackId(null);
    setStalledTrackId(null);
    clearLoadTimeout();
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

  const isLoading = loadingTrackId !== null && loadingTrackId === current?.id;
  const isStalled = stalledTrackId !== null && stalledTrackId === current?.id;

  const value = useMemo(
    () => ({
      current,
      isPlaying,
      isLoading,
      isStalled,
      progress,
      durationMs,
      isMuted,
      play,
      toggle,
      close,
      seek,
      toggleMute,
    }),
    [current, isPlaying, isLoading, isStalled, progress, durationMs, isMuted, play, toggle, close, seek, toggleMute],
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
          above, never by touching this attribute again.

          `auto_play` in the URL is deliberately `false` — the widget's own
          `READY` handler is what starts it, exactly once, exactly the same
          way every subsequent track starts via `.load()`'s `callback`. See
          that handler's doc comment for why this used to be `true` here
          *and* triggered again explicitly, and why that was the actual bug. */}
      {hasSoundCloud && initialTrackIdRef.current ? (
        <iframe
          ref={iframeRef}
          title="Audio player"
          src={soundcloudWidgetUrl(initialTrackIdRef.current, false)}
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
          onPlaying={() => {
            setIsPlaying(true);
            setLoadingTrackId(null);
            setStalledTrackId(null);
            clearLoadTimeout();
          }}
          onPause={() => {
            setIsPlaying(false);
            setLoadingTrackId(null);
            clearLoadTimeout();
          }}
          onEnded={() => {
            setIsPlaying(false);
            setLoadingTrackId(null);
            clearLoadTimeout();
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
