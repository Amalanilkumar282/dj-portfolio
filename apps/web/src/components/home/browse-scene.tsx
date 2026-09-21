'use client';
/* eslint-disable react/no-unknown-property -- React Three Fiber intrinsics
 * render to a WebGL scene graph, not to the DOM. eslint-plugin-react only
 * knows DOM attributes, so every valid three.js prop reads as unknown. The
 * rule is checking the wrong target here.
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group, Mesh } from 'three';
import { Color } from 'three';

import { useAccentRgb } from '@dj/motion';

import { usePlayer } from '../player/player-context';
import type { PlayerTrack } from '../player/player-context';

import { stepTrackIndex } from './browse-act';
import { useTokenColor } from './three-token-color';

/**
 * Act 5 — a rotary browse wheel.
 *
 * The deck (Act 4) scrubs the position of whatever is already loaded; the
 * wall (Act 3) is a flat list. Neither is the one control a real CDJ spends
 * the most physical space on: the browse encoder you spin to move through a
 * crate and press to load. Built the same way the deck was — primitives, no
 * model file, retuned from the live accent token via `useTokenColor`.
 *
 * Horizontal drag distance maps to rotation, not true polar angle — a wheel
 * read this way still feels like a physical dial without tracking a pointer
 * around a centre point, and it's exactly how the deck's own seek gesture
 * already works.
 */

/** Pixels of horizontal drag per catalogue step — tuned so a single quick
 * swipe moves one track, not several. */
const STEP_PX = 70;

function Wheel({
  spinRef,
  accentHost,
}: {
  spinRef: { current: number };
  accentHost: React.RefObject<HTMLElement | null>;
}): React.JSX.Element {
  const wheelRef = useRef<Group>(null);
  const glowRef = useRef<Mesh>(null);
  const accent = useAccentRgb(accentHost);
  const accentColor = useMemo(() => new Color(), []);

  const bodyColor = useTokenColor(accentHost, '--color-bg');
  const rimColor = useTokenColor(accentHost, '--color-surface');
  const markerColor = useTokenColor(accentHost, '--color-fg-strong');
  const detailColor = useTokenColor(accentHost, '--color-border');

  const ridges = useMemo(() => Array.from({ length: 24 }, (_, index) => (index / 24) * Math.PI * 2), []);

  useFrame(() => {
    const wheel = wheelRef.current;
    if (wheel) wheel.rotation.y = spinRef.current;

    const glow = glowRef.current;
    if (glow && 'color' in glow.material) {
      const [r, g, b] = accent;
      accentColor.setRGB(r, g, b);
      (glow.material as { color: Color }).color.copy(accentColor);
    }
  });

  return (
    <group rotation={[0.5, 0, 0]}>
      {/* Body */}
      <mesh position={[0, -0.3, 0]}>
        <boxGeometry args={[3, 0.24, 3]} />
        <meshStandardMaterial color={bodyColor} roughness={0.72} metalness={0.35} />
      </mesh>

      {/* Wheel */}
      <group ref={wheelRef}>
        <mesh position={[0, -0.1, 0]}>
          <cylinderGeometry args={[1.3, 1.3, 0.2, 48]} />
          <meshStandardMaterial color={rimColor} roughness={0.4} metalness={0.6} />
        </mesh>

        {/* Ridges around the rim — the textured grip a real jog wheel has,
            and what makes rotation actually readable in a static frame. */}
        {ridges.map((angle) => (
          <mesh
            key={angle}
            position={[Math.cos(angle) * 1.3, -0.1, Math.sin(angle) * 1.3]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[0.06, 0.22, 0.1]} />
            <meshStandardMaterial color={detailColor} roughness={0.6} />
          </mesh>
        ))}

        {/* Marker: a perfectly symmetric wheel looks static no matter how
            far it has actually turned without one. */}
        <mesh position={[0.9, 0.02, 0]}>
          <boxGeometry args={[0.3, 0.06, 0.14]} />
          <meshStandardMaterial color={markerColor} roughness={0.5} />
        </mesh>
      </group>

      {/* Accent ring — the one element that carries the live persona colour. */}
      <mesh ref={glowRef} position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.4, 0.035, 12, 80]} />
        <meshBasicMaterial />
      </mesh>

      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 4]} intensity={1.3} />
      <pointLight position={[-3, 2, -2]} intensity={0.7} />
    </group>
  );
}

export default function BrowseScene({ tracks }: { tracks: PlayerTrack[] }): React.JSX.Element {
  const { current, play } = usePlayer();
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const spinRef = useRef(0);
  const dragAccumRef = useRef(0);
  const indexRef = useRef(tracks.findIndex((track) => track.id === current?.id));

  // Keeps the wheel's own notion of "where we are" in sync with a track
  // loaded from elsewhere on the page (the track wall, the deck's scrub),
  // so Prev/Next always continues from whatever is actually playing.
  useEffect(() => {
    indexRef.current = tracks.findIndex((track) => track.id === current?.id);
  }, [current, tracks]);

  // Never render frames for a wheel nobody is looking at.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(
      ([entry]) => { setVisible(entry?.isIntersecting === true && !document.hidden); },
      { rootMargin: '120px' },
    );
    observer.observe(host);

    const onVisibility = (): void => { setVisible(!document.hidden); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  function advance(direction: 1 | -1): void {
    const nextIndex = stepTrackIndex(tracks.length, indexRef.current, direction);
    const track = tracks[nextIndex];
    if (!track) return;
    indexRef.current = nextIndex;
    play(track);
  }

  // Dragging spins the wheel and, every STEP_PX of horizontal travel, loads
  // the next/previous track. A `while` loop rather than a single step so a
  // fast flick that crosses several steps in one move event doesn't drop any.
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.buttons !== 1) return;
    spinRef.current += event.movementX * 0.02;
    dragAccumRef.current += event.movementX;

    while (dragAccumRef.current >= STEP_PX) {
      dragAccumRef.current -= STEP_PX;
      advance(1);
    }
    while (dragAccumRef.current <= -STEP_PX) {
      dragAccumRef.current += STEP_PX;
      advance(-1);
    }
  }

  return (
    <div ref={hostRef} className="w-full min-w-0">
      <div
        onPointerMove={onPointerMove}
        className="relative aspect-[4/3] w-full cursor-grab touch-none active:cursor-grabbing"
      >
        <Canvas
          dpr={[1, 1.25]}
          frameloop={visible ? 'always' : 'never'}
          camera={{ position: [0, 2.6, 4.2], fov: 42 }}
          gl={{ antialias: true, alpha: true }}
        >
          <Wheel spinRef={spinRef} accentHost={hostRef} />
        </Canvas>
      </div>

      {/* The accessible route to the same control — this surface stays a
          pointer affordance and is not itself focusable, same discipline as
          the deck's own scrub gesture. */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => { advance(-1); }}
          className="text-fg-muted hover-hover:hover:text-accent font-mono text-xs uppercase"
        >
          ‹ Prev
        </button>
        <p className="text-fg-muted min-w-0 truncate text-center font-mono text-xs uppercase">
          {current ? `${current.title} · ${current.artistLabel}` : 'Turn the wheel to browse'}
        </p>
        <button
          type="button"
          onClick={() => { advance(1); }}
          className="text-fg-muted hover-hover:hover:text-accent font-mono text-xs uppercase"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
