'use client';

import { useEffect } from 'react';

import { track, type AnalyticsEvent } from '../lib/analytics';

/** Fires one analytics event on mount. For pages where the event *is* the render — no user action to hang it off. */
export function TrackEvent({ event }: { event: AnalyticsEvent }): null {
  useEffect(() => {
    track(event);
  }, [event]);
  return null;
}
