# 0012 — Radix for behaviour, shadcn source vendored not depended on

**Status:** Accepted · **Date:** 2026-09-10

## Context

The site needs dialogs, dropdowns, tabs, accordions, sliders and tooltips.
Each has genuinely hard accessibility requirements — focus trapping, typeahead,
`aria-modal`, roving tabindex, slider keyboard semantics — that are easy to get
subtly wrong. The visual design, meanwhile, is a specific dark cinematic techno
aesthetic that no component library ships.

## Decision

Split the two concerns:

- **`@radix-ui/react-*` are real dependencies.** They provide behaviour and
  accessibility, and they are correct out of the box.
- **shadcn/ui components are copied into `packages/ui/primitives` as source**
  and immediately restyled onto our semantic tokens. shadcn is a starting
  point, not a dependency.

Plus `vaul` for mobile drawers, `sonner` for toasts, and `cva` +
`tailwind-merge` for variants.

## Consequences

- We get WCAG-correct interaction behaviour without writing it, which is the
  main reason this decision exists.
- Owning the source means the aesthetic is not fighting a vendor's design
  opinions, and no upgrade can silently restyle the site.
- The shadcn `hsl(var(--x))` convention is dropped on adoption in favour of our
  semantic colour names, so there is exactly one token system — enforced by the
  `dj/no-raw-color-literals` lint rule.
- Cost: vendored source does not receive upstream fixes automatically. Radix
  upgrades still arrive normally, and Radix is where the risky logic lives.

## Alternatives rejected

- **shadcn/ui as a dependency.** It is explicitly not distributed that way.
- **MUI, Chakra or Mantine.** Heavy and opinionated; restyling them to this
  design costs more than starting from headless primitives.
- **Writing the primitives from scratch.** We would get the accessibility
  wrong. That is not false modesty — focus management and
  `aria-activedescendant` are exactly where hand-rolled component libraries
  reliably fail.
