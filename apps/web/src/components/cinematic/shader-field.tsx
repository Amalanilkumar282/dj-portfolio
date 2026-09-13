'use client';

import dynamic from 'next/dynamic';

import { MotionGate } from '@dj/motion';

import type { ShaderCanvasProps } from './shader-canvas';

/**
 * The generative backdrop, in three finished tiers.
 *
 * The CSS composition is **always in the HTML** — it is not a placeholder
 * waiting for WebGL, it is the design, and the canvas fades in over it. That
 * is the rule from docs/03-design-system/motion.md: if the fallback looks
 * like a broken version of the real thing, the fallback is not finished.
 *
 * `dynamic(ssr: false)` means the three.js chunk is only ever *referenced*
 * on the full tier, so a reduced-motion or Save-Data visitor never downloads
 * it at all.
 */
const ShaderCanvas = dynamic(() => import('./shader-canvas'), { ssr: false });

export function ShaderField(props: ShaderCanvasProps): React.JSX.Element {
  return (
    <MotionGate
      full={
        <>
          <CssField {...props} animated />
          <div className="motion-ok:animate-[shader-in_1.2s_var(--ease-out-quart)_forwards] absolute inset-0 opacity-0">
            <ShaderCanvas {...props} />
          </div>
        </>
      }
      light={<CssField {...props} animated />}
      static={<CssField {...props} />}
    />
  );
}

/**
 * The CSS tier: layered radial and conic gradients in the persona accent,
 * plus a masked grain. Costs nothing, themes itself, and reads as a
 * deliberate composition on its own.
 */
function CssField({
  themeKey,
  animated = false,
}: ShaderCanvasProps & { animated?: boolean }): React.JSX.Element {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className={[
          'absolute inset-0 opacity-70',
          animated ? 'motion-ok:animate-[field-drift_24s_ease-in-out_infinite_alternate]' : '',
        ].join(' ')}
        style={{
          background: [
            'radial-gradient(70% 55% at 22% 28%, var(--color-accent-soft), transparent 70%)',
            'radial-gradient(55% 45% at 78% 22%, var(--color-accent-soft), transparent 65%)',
            'radial-gradient(90% 70% at 50% 108%, var(--color-accent-soft), transparent 72%)',
          ].join(','),
        }}
      />
      {/* The persona gradient itself, heavily knocked back — this is what
          makes Trinitrocosmic's conic sweep and TNT's vertical ramp read
          differently even with no WebGL at all. */}
      <div
        className="absolute inset-0 opacity-[0.13] mix-blend-screen"
        style={{ background: 'var(--gradient-persona)' }}
      />
      <div className="bg-bg/0 absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.14 }} />
      {/* Vignette keeps overlaid type legible at every tier. */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(120% 90% at 50% 45%, transparent 35%, var(--color-bg) 100%)',
        }}
      />
      {themeKey === 'tnt' ? <Scanlines /> : null}
    </div>
  );
}

/** TNT is industrial: it gets scanlines at every tier, not only in WebGL. */
function Scanlines(): React.JSX.Element {
  return (
    <div
      className="absolute inset-0 opacity-[0.07]"
      style={{
        backgroundImage:
          'repeating-linear-gradient(to bottom, var(--color-accent) 0px, var(--color-accent) 1px, transparent 1px, transparent 3px)',
      }}
    />
  );
}

/**
 * An inlined SVG turbulence, ~400 bytes. Not a raw colour literal — it is a
 * greyscale noise source, tinted by whatever sits beneath it.
 */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";
