/**
 * Minimal typings and helpers for the SoundCloud Widget API.
 *
 * The catalogue is 19 real tracks hosted on SoundCloud and nothing else —
 * there is no self-hosted audio yet — so the widget *is* the playback
 * engine, not a fallback. It runs in an iframe, which has one important
 * consequence: the audio is cross-origin, so Web Audio cannot analyse it.
 * Anything "audio-reactive" therefore runs off real BPM and real playback
 * position rather than a pretend FFT.
 */

export const SOUNDCLOUD_API = 'https://w.soundcloud.com/player/api.js';

export interface SoundCloudWidget {
  play: () => void;
  pause: () => void;
  seekTo: (milliseconds: number) => void;
  getPosition: (callback: (position: number) => void) => void;
  getDuration: (callback: (duration: number) => void) => void;
  bind: (event: string, callback: () => void) => void;
  unbind: (event: string) => void;
}

interface SoundCloudGlobal {
  Widget: ((element: HTMLIFrameElement) => SoundCloudWidget) & {
    Events: {
      READY: string;
      PLAY: string;
      PAUSE: string;
      FINISH: string;
      PLAY_PROGRESS: string;
    };
  };
}

declare global {
  interface Window {
    SC?: SoundCloudGlobal;
  }
}

/**
 * The widget URL for a track.
 *
 * `visual` and `show_artwork` are off deliberately: the iframe is invisible
 * and exists only as a transport. All visible UI is ours, so it themes with
 * the persona accent instead of SoundCloud orange.
 */
export function soundcloudWidgetUrl(trackId: string, autoPlay: boolean): string {
  const params = new URLSearchParams({
    url: `https://api.soundcloud.com/tracks/${trackId}`,
    auto_play: String(autoPlay),
    hide_related: 'true',
    show_comments: 'false',
    show_user: 'false',
    show_reposts: 'false',
    show_teaser: 'false',
    show_artwork: 'false',
    visual: 'false',
    buying: 'false',
    sharing: 'false',
    download: 'false',
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

let scriptPromise: Promise<void> | null = null;

/** Loads the widget API once, no matter how many components ask. */
export function loadSoundCloudApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.SC) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SOUNDCLOUD_API}"]`);
    if (existing) {
      existing.addEventListener('load', () => {
        resolve();
      });
      return;
    }
    const script = document.createElement('script');
    script.src = SOUNDCLOUD_API;
    script.async = true;
    script.addEventListener('load', () => {
      resolve();
    });
    script.addEventListener('error', () => {
      reject(new Error('SoundCloud widget API failed to load'));
    });
    document.head.appendChild(script);
  });
  return scriptPromise;
}
