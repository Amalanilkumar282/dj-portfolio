'use client';

/** Formats milliseconds as `m:ss`, e.g. `4260000` → `"1:11"`. */
export function formatClock(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}

/** Spoken as "1 minute 24 seconds of 6 minutes", not as a bare percentage. */
function spokenPosition(positionMs: number, durationMs: number): string {
  if (durationMs <= 0) return 'Position unknown';
  return `${formatClock(positionMs)} of ${formatClock(durationMs)}`;
}

/**
 * A real `role="slider"` seek control — the accessible interface to
 * playback position, shared by the mini-player and (now) each track card's
 * own transport once it's the active track. Click/tap to jump, arrow keys
 * to nudge by 2%.
 */
export function Seek({
  progress,
  positionMs,
  durationMs,
  onSeek,
  className,
}: {
  progress: number;
  positionMs: number;
  durationMs: number;
  onSeek: (ratio: number) => void;
  className?: string;
}): React.JSX.Element {
  const percent = Math.round(progress * 100);

  function onKeyDown(event: React.KeyboardEvent): void {
    const step = event.key === 'ArrowRight' ? 0.02 : event.key === 'ArrowLeft' ? -0.02 : 0;
    if (step === 0) return;
    event.preventDefault();
    onSeek(progress + step);
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={spokenPosition(positionMs, durationMs)}
      onKeyDown={onKeyDown}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onSeek((event.clientX - rect.left) / rect.width);
      }}
      className={className ?? 'bg-border relative hidden h-1.5 w-40 cursor-pointer rounded-full md:block lg:w-64'}
    >
      <span className="bg-accent absolute inset-y-0 left-0 rounded-full" style={{ width: `${String(percent)}%` }} />
    </div>
  );
}
