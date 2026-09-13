'use client';

/* eslint-disable react/no-unknown-property -- <mesh>, <planeGeometry> and
 * <shaderMaterial> are React Three Fiber intrinsics rendered to a WebGL
 * scene graph, not to the DOM. eslint-plugin-react only knows DOM
 * attributes, so every valid three.js prop reads as unknown to it. The
 * rule is checking the wrong target here rather than catching a mistake.
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Mesh, ShaderMaterial } from 'three';

import { useAccentRgb, useCoarsePointer } from '@dj/motion';

import { FRAGMENT_SHADER, VARIANT_BY_THEME, VERTEX_SHADER } from './shader-field.gl';

/**
 * The WebGL tier of the generative field.
 *
 * Only ever mounted by `<ShaderField>` behind a `MotionGate`, and only via
 * `dynamic(ssr: false)` — so on the static tier this module is never even
 * fetched, which is what keeps the reduced-motion budget at ≤60KB.
 */

interface FieldProps {
  variant: number;
  intensity: number;
  bpm: number | null;
}

function Field({ variant, intensity, bpm }: FieldProps): React.JSX.Element {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  const { size, gl } = useThree();
  const hostRef = useRef<HTMLElement | null>(null);

  // Read the live accent off the canvas element itself, so a persona-themed
  // subtree resolves to that persona's colour rather than the site default.
  useEffect(() => {
    hostRef.current = gl.domElement.parentElement;
  }, [gl]);

  const accent = useAccentRgb(hostRef);
  const accentStrong = useAccentRgb(hostRef, '--color-accent-strong');

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uVariant: { value: variant },
      uIntensity: { value: intensity },
      uPulse: { value: 0 },
      uResolution: { value: [1, 1] as [number, number] },
      uAccent: { value: [0.4, 0.85, 1] as [number, number, number] },
      uAccentStrong: { value: [0.2, 0.5, 0.8] as [number, number, number] },
    }),
    // Built once; every value is mutated in the frame loop below. Rebuilding
    // it would recompile the material on every prop change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((_state, delta) => {
    const material = materialRef.current;
    if (!material) return;

    // Pulled out once: three.js types uniforms as an index signature, so
    // every access is possibly-undefined under noUncheckedIndexedAccess.
    const { uTime, uResolution, uAccent, uAccentStrong, uVariant, uIntensity, uPulse } =
      material.uniforms;
    if (!uTime || !uResolution || !uAccent || !uAccentStrong) return;
    if (!uVariant || !uIntensity || !uPulse) return;

    uTime.value = (uTime.value as number) + delta;
    uResolution.value = [size.width, size.height];
    uAccent.value = [accent[0], accent[1], accent[2]];
    uAccentStrong.value = [accentStrong[0], accentStrong[1], accentStrong[2]];

    // Ease toward the target so a channel switch morphs rather than cuts.
    // Matches the accent crossfade the token layer already performs.
    const currentVariant = uVariant.value as number;
    uVariant.value = currentVariant + (variant - currentVariant) * Math.min(1, delta * 2.4);
    const currentIntensity = uIntensity.value as number;
    uIntensity.value = currentIntensity + (intensity - currentIntensity) * Math.min(1, delta * 1.5);

    // Beat phase from the track's real BPM. A swell, never a strobe.
    if (bpm !== null && bpm > 0) {
      const phase = (((uTime.value as number) * bpm) / 60) % 1;
      uPulse.value = (1 - phase) ** 3;
    } else {
      uPulse.value = 0;
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

export interface ShaderCanvasProps {
  /** Persona theme key. Unknown keys fall back to the duo field. */
  themeKey?: string | undefined;
  /** 0 at rest, 1 while audio is playing. */
  intensity?: number;
  /** Real BPM of the playing track, if known. Drives the beat swell. */
  bpm?: number | null;
}

export default function ShaderCanvas({
  themeKey,
  intensity = 0,
  bpm = null,
}: ShaderCanvasProps): React.JSX.Element | null {
  const coarsePointer = useCoarsePointer();
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Never render offscreen or in a hidden tab. A fullscreen fragment shader
  // is the single most expensive thing on the page; leaving it running while
  // the visitor reads the footer is pure battery cost.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry?.isIntersecting === true && document.visibilityState === 'visible');
      },
      { rootMargin: '10%' },
    );
    observer.observe(element);

    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') setVisible(false);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const variant = VARIANT_BY_THEME[themeKey ?? ''] ?? VARIANT_BY_THEME.duo ?? 3;

  return (
    <div ref={containerRef} className="absolute inset-0" aria-hidden="true">
      <Canvas
        // ADR 0022: capped hard on touch, where fill rate is the constraint.
        dpr={coarsePointer ? 1 : [1, 1.25]}
        frameloop={visible ? 'always' : 'never'}
        gl={{ antialias: false, alpha: false, powerPreference: 'low-power' }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Field variant={variant} intensity={intensity} bpm={bpm} />
      </Canvas>
    </div>
  );
}
