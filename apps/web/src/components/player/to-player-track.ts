import type { TrackDetail, TrackSummary } from '@dj/contracts';

import type { PlayerTrack } from './player-context';

/**
 * Narrows a catalogue track to what the player needs.
 *
 * Accepts a summary or a detail, so a listing card and a track page hand the
 * player the same shape.
 */
export function toPlayerTrack(track: TrackSummary | TrackDetail): PlayerTrack {
  return {
    id: track.id,
    slug: track.slug,
    title: track.title,
    artistLabel: track.artistLabel,
    bpm: track.bpm,
    audioUrl: 'audioUrl' in track ? track.audioUrl : null,
    soundcloudTrackId: track.soundcloudTrackId,
  };
}

/** True when there is an actual source to play. */
export function isPlayable(track: TrackSummary | TrackDetail): boolean {
  return track.soundcloudTrackId !== null || ('audioUrl' in track && track.audioUrl !== null);
}
