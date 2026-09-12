# ADR 0022 — The motion tier gates on memory and cores, not pointer type

**Status:** Accepted
**Date:** 2026-09-12
**Supersedes:** the `useCapability` sketch in
[`docs/03-design-system/motion.md`](../03-design-system/motion.md)

## Context

`motion.md` specifies capability detection as:

```ts
if (reduced || saveData) return 'static';
if (mem < 4 || cores <= 4) return 'light';
return coarse ? 'light' : 'full';
```

The final line sends **every touch device to `light`**, so no phone or tablet
ever receives the WebGL tier regardless of how capable it is.

That rule was written when the cinematic layer was expected to be carried by
full-viewport **video**, where a touch device genuinely is the wrong target:
autoplaying 2.5MB loops over a mobile connection is a bandwidth and battery
problem no amount of GPU headroom fixes.

The layer actually being built is **generative** — there are no photos, no
video and no 3D models in the project, so the visuals are fragment shaders and
procedural geometry. That changes the cost profile completely. A fullscreen
fragment shader downloads nothing beyond its source and costs GPU time
proportional to pixels drawn, which is controllable by capping device pixel
ratio. The constraint is silicon, and pointer type is a poor proxy for it: a
2023 phone outruns a four-core ultrabook, yet the documented rule gives the
laptop the richer experience.

## Decision

Drop the pointer-type clause. The tier is decided by stated preference first,
then hardware:

```ts
if (reduced || saveData) return 'static';
if (memory < 4 || cores <= 4) return 'light';
return 'full';
```

Pointer type is still detected, but exposed separately as `useCoarsePointer()`
and consumed only by effects that are *semantically* wrong on touch rather
than too expensive:

- the magnetic cursor and cursor spotlight — there is no cursor to follow
- Lenis smooth scroll — it fights native momentum scrolling, which is better

## Consequences

**Mitigations that make this safe, all enforced in the shader components:**

- device pixel ratio capped at **1.0 on coarse pointers**, 1.5 otherwise —
  the single biggest lever on fragment-shader cost
- `frameloop="demand"` / rAF paused by `IntersectionObserver` when the canvas
  is offscreen and on `visibilitychange` when the tab is hidden
- **3D scenes remain desktop-only**, unchanged: `frontend.md`'s budget table
  exempts them to ≤200KB explicitly as "desktop-gated", and that exemption is
  not being widened. This ADR moves the *shader* tier only.
- missing hints (`deviceMemory` is absent in Safari) default to capable, so
  iOS gets `full` — deliberate, since iOS GPUs are consistently strong and the
  alternative is penalising an entire platform for not shipping a hint

**What stays true:** every tier is still a complete design; the `static` tier
still renders without mounting a single island, so the ≤60KB reduced-motion
budget is unaffected.

**What to watch:** if real telemetry shows mid-range Android devices dropping
frames on the shader field, the correct response is a stricter memory/core
threshold, not a return to the pointer heuristic.
