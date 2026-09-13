/**
 * Layout primitives.
 *
 * Empty for now, deliberately: `Container` / `Section` / `SectionHeader`
 * currently live in `apps/web/src/components/container.tsx` and are used by
 * every public page. Moving them here is a worthwhile refactor but touches
 * ~25 page files, so it is not being bundled into the visual revamp.
 *
 * This barrel exists so the `./layout` subpath in package.json resolves
 * rather than failing at import time.
 */

export {};
