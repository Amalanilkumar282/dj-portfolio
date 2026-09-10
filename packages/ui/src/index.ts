/**
 * @dj/ui — the shared design system.
 *
 * Consumed by both apps/web and apps/admin. Must never import from apps/*
 * (enforced by lint).
 *
 * Primitives, layout and composites are added in Phase 7 alongside the pages
 * that need them. The tokens in styles/theme.css are the part that exists
 * now, because they are the source of truth every other decision references.
 *
 * See docs/03-design-system/components.md
 */

export { cn } from './lib/cn.js';
