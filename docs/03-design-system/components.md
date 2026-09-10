# Component library — `packages/ui`

Shared by `apps/web` and `apps/admin`. **Must never import from `apps/*`** —
enforced by lint.

## Layout

```
packages/ui/src/
├─ styles/{theme.css, print.css}
├─ lib/{cn.ts, cva.ts}
├─ primitives/     Button Link IconButton Input Textarea Select Checkbox Radio
│                  Switch Label Field FormMessage Badge Chip Tag Avatar
│                  Skeleton Spinner Separator VisuallyHidden AspectRatio
│                  ScrollArea Portal Dialog Drawer Sheet Popover Tooltip
│                  DropdownMenu Tabs Accordion Toast Progress Slider
│                  Pagination Breadcrumb Table
├─ composites/     SectionHeader Card MediaCard TrackCard EventCard PersonaCard
│                  ServiceCard TestimonialCard StatCounter Marquee Lightbox
│                  WaveformPlayer MiniPlayer VideoPlayer Masonry Timeline
│                  FilterBar CTABand PriceTable FaqAccordion GigMap GearGrid
│                  RichText CopyButton EmptyState ShareRow
├─ layout/         Container Stack Grid Section Hero Split Bleed
└─ index.ts        subpath exports: @dj/ui, @dj/ui/primitives, @dj/ui/composites
```

Subpath exports stop the barrel pulling every component into every bundle.

## Primitives vs composites

**Primitives** are generic and content-agnostic. A `Button` knows nothing about
DJs.

**Composites** know the domain. A `TrackCard` takes a `Track` contract type and
renders it. They compose primitives and never reach past them.

If a composite needs a new visual capability, **add a variant to the primitive**
rather than styling around it. Styling around it is how a second button style
ends up defined in four places.

## Variants — `cva` on every primitive

```tsx
const button = cva(
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none transition-[transform,background-color,box-shadow] duration-[--duration-fast] ease-[--ease-out-quart] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--color-focus] disabled:opacity-50 disabled:pointer-events-none motion-ok:active:scale-[0.98]',
  {
    variants: {
      variant: {
        solid:
          'bg-accent text-on-accent hover-hover:hover:bg-accent-strong hover-hover:hover:shadow-glow',
        outline:
          'border border-border text-fg hover-hover:hover:border-accent hover-hover:hover:text-accent',
        ghost: 'text-fg-muted hover-hover:hover:text-fg hover-hover:hover:bg-surface-raised',
        neon: 'bg-transparent text-accent border border-accent shadow-glow hover-hover:hover:bg-accent-soft',
        link: 'text-accent underline underline-offset-4 decoration-accent/40 hover:decoration-accent',
      },
      size: {
        sm: 'h-9 px-3 text-sm rounded-md',
        md: 'h-11 px-5 text-body rounded-lg',
        lg: 'h-14 px-8 text-lead rounded-lg',
        icon: 'size-11 rounded-lg',
      },
    },
    defaultVariants: { variant: 'solid', size: 'md' },
  },
);
```

Five things worth noticing:

- Only semantic colour names. No hex, no source ramps.
- `hover-hover:` not `hover:`, so a tap on touch does not leave a stuck state.
- `motion-ok:` on the press scale, so it disappears under reduced motion.
- The `transition` property is **enumerated**. Never `transition: all`, which
  animates layout properties by accident.
- `size-11` is 44px — the primary touch-target minimum (WCAG 2.5.8).

## Radix and shadcn

Radix provides behaviour; shadcn source is vendored and restyled. See
[ADR 0012](../01-decisions/0012-radix-vendored-shadcn.md).

On adoption, **drop the shadcn `hsl(var(--x))` convention** in favour of our
semantic names, so there remains exactly one token system.

Also: `vaul` for mobile drawers, `sonner` for toasts, `tailwind-merge` via
`cn()`.

## Icons

- `lucide-react` for UI, imported per icon (~1KB each).
- `@icons-pack/react-simple-icons` for brand marks — Spotify, SoundCloud,
  Instagram, WhatsApp, Apple Music, YouTube, Beatport, Mixcloud.
- Hand-authored inline SVGs in `packages/ui/icons` for audio-specific glyphs:
  waveform, crossfader, CDJ, EQ.

**No icon fonts, and no `react-icons`.** The legacy site shipped both
`lucide-react` and `react-icons` — two icon libraries for one set of icons.

## Storybook

**`packages/ui` only**, not app routes.

Justified by the combinatorial surface: four persona themes × component states
is painful to review inside the app. It doubles as the axe and
visual-regression harness and as the living token documentation. A toolbar
addon switches `data-theme`.

App-level compositions are **not** storied — e2e covers those, and storying
them would duplicate the same assertions in two places.

## Adding a component

1. Primitive or composite? If it knows a domain type, it is a composite.
2. `cva` for variants, semantic tokens only.
3. Forward refs and spread `...props`. A component you cannot attach a ref to
   cannot be used with Radix `asChild`.
4. Handle keyboard and screen-reader behaviour, or delegate to Radix.
5. A Storybook story per meaningful state, plus one under each persona theme.
6. A `vitest-axe` assertion.
7. **Do not add `'use client'` unless it genuinely needs it.** Most composites
   are server-renderable; the interactive part is usually a leaf.
