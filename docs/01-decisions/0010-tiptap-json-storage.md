# 0010 — Rich text is stored as Tiptap JSON, never HTML

**Status:** Accepted · **Date:** 2026-09-10

## Context

Blog posts, static pages and long-form service descriptions need a rich text
editor for a non-technical author.

## Decision

Tiptap v3 in the admin. The stored value is **ProseMirror JSON** in a `Json`
column, never an HTML string. The frontend renders it through a typed
`RichText` component.

## Consequences

- **Injected markup cannot reach the DOM.** There is no HTML string to
  sanitise, because the renderer only knows how to render node types it
  recognises and ignores anything else. This is a structural XSS defence
  rather than a filtering one.
- Content is queryable and transformable: a `contentText` plain-text
  projection is derived on write and feeds the generated search vector,
  reading time and meta-description fallbacks.
- Custom nodes cover what the site actually needs: `TrackEmbed`,
  `PlaylistEmbed`, `EventEmbed`, `GalleryEmbed`, `Callout` and `Figure` —
  the last of which enforces alt text and caption.
- Tiptap is headless, so it inherits the design tokens instead of fighting a
  vendor theme.
- Cost: the renderer must handle every node type the editor can produce. A new
  node means a change in two places, and forgetting the renderer means content
  silently disappears — so `RichText` throws in development on an unknown node.

## Alternatives rejected

- **HTML in a text column.** Requires sanitising on write and trusting it
  forever after; every renderer becomes a potential XSS sink.
- **Markdown in a textarea.** Wrong tool for a non-technical author, and no way
  to embed a track player.
- **Lexical.** Capable, but a thinner ecosystem for the custom embeds we need.
- **Quill / Draft.js.** Effectively legacy.
