/**
 * The generative field behind every hero.
 *
 * Four variants, one shader. `uVariant` morphs continuously rather than
 * switching, so the channel switcher crossfades texture the same way the
 * token layer crossfades colour — the whole point of the module is that it
 * feels like one instrument being retuned, not four images swapping.
 *
 * Colour comes in as uniforms read from `--color-accent` at runtime (see
 * `useAccentRgb`), never hardcoded: the palette belongs to whichever persona
 * is tuned in, and `dj/no-raw-color-literals` forbids hex here anyway.
 *
 * Deliberately cheap: no textures, no loops over lights, no raymarching.
 * Cost is a handful of sin/noise evaluations per pixel, which is what makes
 * it viable on a phone at DPR 1 (ADR 0022).
 */

export const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;

  varying vec2 vUv;

  uniform float uTime;
  uniform float uVariant;      // 0 felicitous · 1 trinitrocosmic · 2 tnt · 3 duo
  uniform float uIntensity;    // 0 at rest, rises while audio plays
  uniform float uPulse;        // beat phase, 0..1, driven by real BPM
  uniform vec2  uResolution;
  uniform vec3  uAccent;
  uniform vec3  uAccentStrong;

  // Cheap value noise. Two texture-free octaves is enough at this scale and
  // costs a fraction of simplex.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    return noise(p) * 0.6 + noise(p * 2.3) * 0.3;
  }

  // Bollywood / commercial: warm bokeh light-leaks, soft and celebratory.
  float fieldWarm(vec2 p, float t) {
    float d = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec2 c = vec2(sin(t * 0.18 + fi * 2.1), cos(t * 0.13 + fi * 1.7)) * 0.55;
      float r = length(p - c);
      d += 0.055 / (r + 0.18);
    }
    return d * 0.5 + fbm(p * 1.6 + t * 0.05) * 0.35;
  }

  // Psytrance: kaleidoscopic interference, fast and hypnotic.
  float fieldCosmic(vec2 p, float t) {
    float a = atan(p.y, p.x);
    float r = length(p);
    float k = sin(a * 6.0 + t * 0.6) * 0.5 + 0.5;
    float rings = sin(r * 14.0 - t * 1.2 + k * 2.0) * 0.5 + 0.5;
    return rings * (1.0 - smoothstep(0.15, 1.15, r)) + fbm(p * 3.0 - t * 0.08) * 0.25;
  }

  // Techno: a mono grid with scanlines. Industrial, rigid, unglamorous.
  float fieldGrid(vec2 p, float t) {
    vec2 g = abs(fract(p * 5.0 + vec2(0.0, t * 0.28)) - 0.5);
    float line = smoothstep(0.46, 0.5, max(g.x, g.y));
    float scan = sin(p.y * 160.0 + t * 2.0) * 0.5 + 0.5;
    float horizon = 1.0 - smoothstep(0.0, 0.9, abs(p.y));
    return line * horizon * 0.8 + scan * 0.05 * horizon;
  }

  // Duo: two fields interfering — two sources, one pattern.
  float fieldDual(vec2 p, float t) {
    float a = length(p - vec2(-0.34, 0.0));
    float b = length(p - vec2(0.34, 0.0));
    float wave = sin(a * 11.0 - t * 0.9) * sin(b * 11.0 + t * 0.7);
    return (wave * 0.5 + 0.5) * (1.0 - smoothstep(0.2, 1.2, min(a, b) + 0.25));
  }

  void main() {
    // Aspect-corrected, centre-origin coordinates.
    vec2 p = (vUv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0) * 2.0;
    float t = uTime;

    // Beat: a soft swell on every beat rather than a strobe. Capped well
    // under 3Hz of visible change (WCAG 2.3.1) even at 210 BPM.
    float beat = 1.0 + uPulse * uIntensity * 0.22;
    p /= beat;

    float warm   = fieldWarm(p, t);
    float cosmic = fieldCosmic(p, t);
    float grid   = fieldGrid(p, t);
    float dual   = fieldDual(p, t);

    // Blend between adjacent variants so a switch morphs rather than cuts.
    float v = clamp(uVariant, 0.0, 3.0);
    float field =
        warm   * max(0.0, 1.0 - abs(v - 0.0))
      + cosmic * max(0.0, 1.0 - abs(v - 1.0))
      + grid   * max(0.0, 1.0 - abs(v - 2.0))
      + dual   * max(0.0, 1.0 - abs(v - 3.0));

    field *= 0.55 + uIntensity * 0.45;

    // Two-stop accent ramp, so the field reads as one light source rather
    // than a flat tint.
    vec3 colour = mix(uAccentStrong, uAccent, clamp(field, 0.0, 1.0));
    colour *= clamp(field, 0.0, 1.4);

    // Vignette keeps the type legible over the centre — this is a backdrop,
    // never the subject.
    float vignette = 1.0 - smoothstep(0.55, 1.7, length(p));
    colour *= vignette;

    // Grain, tied to the field so it disappears in the dark areas rather
    // than sitting on top as a flat overlay.
    float grain = (hash(vUv * uResolution + t) - 0.5) * 0.045;
    colour += grain * clamp(field, 0.0, 1.0);

    gl_FragColor = vec4(max(colour, 0.0), 1.0);
  }
`;

/** Maps a persona theme key to the shader's variant axis. */
export const VARIANT_BY_THEME: Record<string, number> = {
  felicitous: 0,
  trinitrocosmic: 1,
  tnt: 2,
  duo: 3,
};
