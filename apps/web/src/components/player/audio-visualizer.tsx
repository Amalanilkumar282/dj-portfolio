'use client';

import { useEffect, useRef } from 'react';

/**
 * masterplan §5.6 item 6 — fftSize 512, one 2D canvas, RAF-driven, never
 * autoplays anything on its own (it only ever reacts to audio the mini
 * player is already playing). No real track has real audio yet (gap #16),
 * so this renders flat until one does — that's the correct behaviour for
 * silence, not a bug.
 */
export function AudioVisualizer({
  audioRef,
  isPlaying,
}: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // A `MediaElementAudioSourceNode` can only ever be created once per
    // `<audio>` element — guard so remounts/effect re-runs don't throw.
    if (!contextRef.current) {
      const AudioCtx = window.AudioContext;
      const context = new AudioCtx();
      const source = context.createMediaElementSource(audio);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyser.connect(context.destination);
      contextRef.current = context;
      analyserRef.current = analyser;
    }
  }, [audioRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    const context = contextRef.current;
    if (!canvas || !analyser || !context) return;

    if (!isPlaying) {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      return;
    }

    void context.resume();
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    // Canvas 2D can't read CSS custom properties, so resolve the accent
    // color once via `currentColor` on the element itself (styled with the
    // `text-accent` utility) rather than hardcoding a hex value here.
    ctx2d.fillStyle = getComputedStyle(canvas).color;
    const data = new Uint8Array(analyser.frequencyBinCount);

    function draw(): void {
      if (!ctx2d || !canvas) return;
      frameRef.current = requestAnimationFrame(draw);
      analyser?.getByteFrequencyData(data);
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = canvas.width / data.length;
      for (let i = 0; i < data.length; i += 1) {
        const value = data[i] ?? 0;
        const barHeight = (value / 255) * canvas.height;
        ctx2d.fillRect(i * barWidth, canvas.height - barHeight, barWidth * 0.8, barHeight);
      }
    }
    draw();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isPlaying]);

  return <canvas ref={canvasRef} width={120} height={32} aria-hidden="true" className="text-accent" />;
}
