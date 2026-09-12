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

/**
 * Act 4 — a procedurally built deck.
 *
 * There is no GLTF in this repo and none is needed: a CDJ is cylinders, a
 * torus and a few boxes. Building it from primitives keeps the scene inside
 * the shared `three` chunk with **no model download at all**, which is the
 * only way a 3D act fits the budget on a site with no asset pipeline.
 *
 * The platter's rotation is driven by the real player: it spins only while
 * audio is actually playing, and dragging it seeks the real transport. It is
 * an instrument, not an ornament — which is also why it is desktop/full-tier
 * only and never the sole way to reach a control.
 */

/**
 * Every colour on the deck is read back out of the token layer at runtime.
 *
 * three.js needs a real colour value, and `dj/no-raw-color-literals` rightly
 * forbids writing one here — so the same `getComputedStyle` probe the shader
 * field uses resolves each token, whatever format it is authored in. The
 * happy side effect is that the deck retunes when the visitor switches
 * channel, with no per-theme branch.
 */
function useTokenColor(host: React.RefObject<HTMLElement | null>, property: string): Color {
  const [r, g, b] = useAccentRgb(host, property);
  return useMemo(() => new Color(r, g, b), [r, g, b]);
}

function Deck({ spinning, accentHost }: { spinning: boolean; accentHost: React.RefObject<HTMLElement | null> }): React.JSX.Element {
  const platterRef = useRef<Group>(null);
  const glowRef = useRef<Mesh>(null);
  const accent = useAccentRgb(accentHost);

  const bodyColor = useTokenColor(accentHost, '--color-bg');
  const platterColor = useTokenColor(accentHost, '--color-surface');
  const markerColor = useTokenColor(accentHost, '--color-fg-strong');
  const detailColor = useTokenColor(accentHost, '--color-border');

  const accentColor = useMemo(() => new Color(), []);
  const spinRef = useRef(0);

  useFrame((_state, delta) => {
    // Ease the angular velocity instead of switching it, so pausing spins
    // down like a real platter rather than freezing mid-rotation.
    const target = spinning ? 1 : 0;
    spinRef.current += (target - spinRef.current) * Math.min(1, delta * 2.4);

    const platter = platterRef.current;
    if (platter) platter.rotation.y += spinRef.current * delta * 1.6;

    const glow = glowRef.current;
    if (glow && 'color' in glow.material) {
      const [r, g, b] = accent;
      accentColor.setRGB(r, g, b);
      (glow.material as { color: Color }).color.copy(accentColor);
    }
  });

  return (
    <group rotation={[0.62, 0, 0]}>
      {/* Body */}
      <mesh position={[0, -0.34, 0]}>
        <boxGeometry args={[3.4, 0.28, 3.4]} />
        <meshStandardMaterial color={bodyColor} roughness={0.72} metalness={0.35} />
      </mesh>

      {/* Platter */}
      <group ref={platterRef}>
        <mesh position={[0, -0.14, 0]}>
          <cylinderGeometry args={[1.24, 1.24, 0.14, 64]} />
          <meshStandardMaterial color={platterColor} roughness={0.34} metalness={0.72} />
        </mesh>
        {/* The marker dot: without it a perfectly symmetric disc looks static
            no matter how fast it turns. */}
        <mesh position={[0.86, -0.05, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.06, 16]} />
          <meshStandardMaterial color={markerColor} roughness={0.5} />
        </mesh>
      </group>

      {/* Accent ring — the one element that carries the live persona colour. */}
      <mesh ref={glowRef} position={[0, -0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.34, 0.035, 12, 80]} />
        <meshBasicMaterial />
      </mesh>

      {/* Pitch fader and cue pads, as silhouette only. */}
      <mesh position={[1.42, -0.16, 0.1]}>
        <boxGeometry args={[0.22, 0.06, 1.5]} />
        <meshStandardMaterial color={detailColor} roughness={0.6} />
      </mesh>
      {[-0.6, -0.2, 0.2, 0.6].map((z) => (
        <mesh key={z} position={[-1.42, -0.16, z]}>
          <boxGeometry args={[0.34, 0.06, 0.3]} />
          <meshStandardMaterial color={detailColor} roughness={0.55} />
        </mesh>
      ))}

      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 4]} intensity={1.3} />
      <pointLight position={[-3, 2, -2]} intensity={0.7} />
    </group>
  );
}

export default function DeckScene(): React.JSX.Element {
  const { isPlaying, progress, seek } = usePlayer();
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Never render frames for a deck nobody is looking at.
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

  // Dragging across the deck scrubs the real transport. The accessible route
  // to the same control is the mini player's `role="slider"`, which is why
  // this surface stays a pointer affordance and is not itself focusable.
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.buttons !== 1) return;
    const rect = event.currentTarget.getBoundingClientRect();
    seek((event.clientX - rect.left) / rect.width);
  }

  return (
    <div
      ref={hostRef}
      onPointerMove={onPointerMove}
      className="relative aspect-[4/3] w-full cursor-ew-resize"
    >
      <Canvas
        dpr={[1, 1.5]}
        frameloop={visible ? 'always' : 'never'}
        camera={{ position: [0, 2.6, 4.2], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Deck spinning={isPlaying} accentHost={hostRef} />
      </Canvas>

      <p className="text-fg-muted absolute inset-x-0 bottom-0 text-center font-mono text-xs uppercase">
        {isPlaying ? `Playing · ${String(Math.round(progress * 100))}%` : 'Press play to spin the deck'}
      </p>
    </div>
  );
}
