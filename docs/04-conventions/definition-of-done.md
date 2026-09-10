# Definition of done

Run through this before opening a PR or declaring a task complete. It is short
on purpose.

## Every change

- [ ] `pnpm turbo lint typecheck test` passes
- [ ] `pnpm format:check` passes
- [ ] No `eslint-disable` without a comment saying why. The four `dj/*` rules
      encode legacy bugs — disabling one is reintroducing a bug, not a
      workaround.
- [ ] No `any`, no `!` non-null assertion in application code
- [ ] No commented-out code, no stray `console.log`
- [ ] New behaviour has a test that would **fail without the change**
- [ ] Docs updated in the same PR if the change alters documented behaviour
- [ ] [`../06-roadmap/STATUS.md`](../06-roadmap/STATUS.md) updated

## Database change

- [ ] `pnpm db:migrate` run; migration committed
- [ ] `pnpm db:migrate:check` reports **no drift**
- [ ] Model registered in `packages/db/src/models.ts` where applicable
- [ ] Any partial index or CHECK constraint added to
      `prisma/sql/post-migrate.sql` **and asserted in `schema.int-spec.ts`**
- [ ] Permissions added to `seed/data/rbac.ts`
- [ ] Destructive change follows expand/contract across two deploys
- [ ] `seed:system` still idempotent (run it twice)

## API endpoint

- [ ] Zod schema in `packages/contracts`, DTO via `createZodDto`
- [ ] Public and admin controllers are **separate files**; admin carries
      class-level guards
- [ ] Prisma touched only in the repository
- [ ] `sort` and `include` allowlists declared; every sortable column indexed
- [ ] Errors are RFC 9457 with a JSON Pointer where field-specific
- [ ] Cache policy set; `revalidateTag` emitted for content mutations, with the
      tag added to **both** `cache-tags.ts` and the API `TAG_MAP`
- [ ] Swagger annotated
- [ ] Query count ≤8 per request (the dev canary warns above this)

## Public page

- [ ] **No `'use client'` in `page.tsx` or `layout.tsx`**
- [ ] ≤6 client islands, ≤90KB route JS
- [ ] `generateMetadata` implemented, with canonical URL
- [ ] JSON-LD added to the page graph
- [ ] Added to `sitemap.ts` if indexable
- [ ] Exactly one `priority` image (the LCP element)
- [ ] `sizes` from the `SIZES` module, not ad-hoc
- [ ] Loading and error states exist
- [ ] Renders correctly with **JavaScript disabled**
- [ ] Renders correctly under `prefers-reduced-motion: reduce`
- [ ] Renders correctly in all four persona themes if persona-scoped
- [ ] axe: zero serious/critical
- [ ] Keyboard-only pass done by hand
- [ ] `size-limit` and Lighthouse budgets still pass

## Component in `packages/ui`

- [ ] Semantic tokens only — no raw colours, no source ramps
- [ ] `cva` variants; `hover-hover:` for decorative hover; `motion-ok:` for
      motion
- [ ] Ref forwarded, `...props` spread
- [ ] Keyboard and screen-reader behaviour handled, or delegated to Radix
- [ ] Storybook story per meaningful state, plus one per persona theme
- [ ] `vitest-axe` assertion
- [ ] No import from `apps/*`

## Motion or 3D

- [ ] Wrapped in `<MotionGate>`
- [ ] **The fallback is complete and beautiful on its own** — not a degraded
      version of the real thing
- [ ] Reduced-motion path verified
- [ ] `saveData` and low-`deviceMemory` paths verified
- [ ] Lazy-loaded; mounts on interaction or scroll, never on load
- [ ] Shares the existing `three` chunk if 3D
- [ ] No layout-property transitions
- [ ] Nothing flashes above 3Hz

## Content or copy

- [ ] **Nothing invented.** No placeholder testimonials, no fabricated venues
      or press quotes, no guessed gig dates, no made-up prices. See
      [`../07-content/brand.md`](../07-content/brand.md).
- [ ] Prices null where unknown — "On request" is the honest render
- [ ] Testimonials `isVerified: false` until the artist confirms them
- [ ] Alt text on every image
- [ ] "Bengaluru", not "Banglore"

## Security-relevant change

- [ ] New endpoint is `@Public()` **or** guarded — never neither
- [ ] Rate limit considered
- [ ] No secret in client-side code or a `NEXT_PUBLIC_` variable
- [ ] New env var added to `.env.example` **and** `env.schema.ts`
      (`pnpm check:env` enforces parity)
- [ ] User input never reaches raw SQL
- [ ] HTML sanitised on write, not on render
- [ ] `AuditLog` written for any privileged action

---

## Before saying "done" to the user

State plainly what was verified and how, and what was **not**. If a check was
skipped because of a missing credential or a machine limitation, say so
explicitly rather than leaving it implied — and put it in
[`../06-roadmap/STATUS.md`](../06-roadmap/STATUS.md) so the next session finds
it. An honest gap is useful; a silent one costs someone hours.
