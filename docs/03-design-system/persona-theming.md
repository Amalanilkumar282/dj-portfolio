# Persona theming

Four personas, four visual identities, **one component library**. A component
written against `--color-accent` themes itself correctly everywhere for free.

Related: [ADR 0009](../01-decisions/0009-persona-dynamic-route.md),
[`tokens.md`](tokens.md).

---

## The mechanism

`[data-theme]` blocks remap **semantic aliases only** — they never introduce
new tokens.

```css
[data-theme='felicitous'] {
  --color-accent: var(--color-rose-400);
  --color-accent-strong: var(--color-flame-500);
  --gradient-persona: linear-gradient(120deg, var(--color-rose-500), var(--color-flame-400));
}

[data-theme='trinitrocosmic'] {
  --color-accent: var(--color-violet-400);
  --color-accent-strong: var(--color-violet-500);
  --gradient-persona: conic-gradient(
    from 210deg,
    var(--color-violet-500),
    oklch(0.7 0.22 330),
    var(--color-violet-400)
  );
}

[data-theme='tnt'] {
  --color-accent: var(--color-cyan-400);
  --color-accent-strong: var(--color-cyan-500);
  --gradient-persona: linear-gradient(180deg, var(--color-cyan-400), oklch(0.55 0.09 210));
  /* Industrial identity: sharp corners and a mono display face. Theming is
     not only colour. */
  --radius-lg: 2px;
  --radius-xl: 2px;
  --font-display: var(--font-jetbrains);
}

[data-theme='duo'] {
  --color-accent: var(--color-rose-400);
  --color-accent-strong: var(--color-violet-400);
  --gradient-persona: linear-gradient(100deg, var(--color-rose-400), var(--color-violet-400));
}
```

TNT overriding `--radius-*` and `--font-display` is the point worth noticing:
a persona's identity is not just its accent colour, and the token layer is
where that difference belongs — not in per-persona component branches.

---

## Set server-side, so there is no flash

```tsx
// app/(marketing)/[persona]/layout.tsx  — a Server Component
export default async function PersonaLayout({ params, children }) {
  const { persona: slug } = await params;
  const persona = await getPersona(slug);

  return (
    <div
      data-theme={persona.themeKey}
      style={
        {
          // CMS-driven accents override theme.css, so the artist can retune a
          // persona without a deploy. theme.css remains the fallback.
          '--color-accent': persona.accentColor,
          ...(persona.accentColorSecondary
            ? { '--color-accent-strong': persona.accentColorSecondary }
            : {}),
          ...(persona.gradientCss ? { '--gradient-persona': persona.gradientCss } : {}),
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
```

The correct accent is therefore in the **first HTML paint**. There is no
hydration flash, and no `useEffect` that briefly shows the wrong colour.

Two sources, deliberately layered:

1. `theme.css` `[data-theme]` blocks — the designed defaults, and the fallback
   if the CMS value is ever missing or invalid.
2. `Persona.accentColor` / `accentColorSecondary` / `gradientCss` — inline
   overrides from the database.

---

## Interpolating the accent on the home page

The home page's persona "channel switcher" changes the accent for the whole
viewport as the visitor moves between channels. CSS custom properties do not
animate by default, so the accent is registered with `@property`:

```css
@property --color-accent {
  syntax: '<color>';
  inherits: true;
  initial-value: #6ee7ff;
}

:root {
  transition: --color-accent var(--duration-slow) var(--ease-out-quart);
}
```

Now setting `document.documentElement.style.setProperty('--color-accent', …)`
**crossfades** rather than snapping — the effect that makes the switcher feel
like hardware. Under reduced motion the duration token is 1ms, so it snaps
instead, with no extra code.

This is the one place `data-theme` is set on `documentElement` from the client,
and it is transient. Everywhere else it is server-rendered on a wrapper.

---

## Rules

1. **Remap semantic aliases. Never add persona-specific tokens.** A
   `--color-tnt-cyan` token would immediately be used by a component, which
   would then only work for TNT.
2. **Components never reference a source ramp.** `bg-accent`, not `bg-cyan-400`.
   Enforced by `dj/no-raw-color-literals` plus review.
3. **Any new themed token must be defined in all four blocks**, or none. A
   token defined in three renders with the bare `:root` value in the fourth,
   which is a bug that only shows on one page.
4. **Check contrast for every persona.** The four accents have different
   lightness — cyan-400 is L≈0.85, violet-400 is L≈0.72. A pairing that passes
   on TNT can fail on Trinitrocosmic. The contrast matrix test covers all four.
5. **`--color-on-accent` is always `ink-950`.** Text on an accent fill is dark.
   Accent-on-accent is never legible.

---

## Adding a fifth persona

The reason this architecture exists — it should require **no code**:

1. Create the `Persona` row in admin with `slug`, `accentColor` and
   `gradientCss`.
2. Publish it. `generateStaticParams` picks it up on the next build;
   `dynamicParams: true` renders it on demand before that.
3. Optionally add a `[data-theme="<key>"]` block to `theme.css` if it needs
   more than colour — a different display font or radius, as TNT does.

If step 3 is the only code change, the architecture is working. If you find
yourself editing a page component, something has leaked.
