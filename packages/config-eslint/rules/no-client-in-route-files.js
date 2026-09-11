/**
 * Bans `'use client'` at the top of App Router `page.tsx` / `layout.tsx`.
 *
 * The legacy site marked every page as a Client Component, which cost it all
 * SSR and made per-route `metadata` impossible. Client behaviour belongs in
 * leaf islands, not route entry points.
 *
 * See docs/02-architecture/frontend.md §"Server-first".
 */
/**
 * Matched against a forward-slash-normalised path.
 *
 * Without normalising, `/app/` never matches on Windows — where paths arrive
 * as `src\app\page.tsx` — so this rule silently never fired for anyone
 * developing on Windows, and the invariant held only in Linux CI. A lint rule
 * that is a no-op on a contributor's machine is worse than no rule, because
 * everyone believes it is running.
 */
const ROUTE_FILE = /\/app\/.*\/?(page|layout)\.(t|j)sx?$/;

const normalise = (filename) => filename.replace(/\\/g, '/');

export default {
  meta: {
    type: 'problem',
    docs: {
      description: "disallow 'use client' in App Router page/layout files",
    },
    schema: [],
    messages: {
      noClientRoute:
        "'use client' is not allowed in {{ basename }}. Route entry points must be Server Components — move interactivity into a leaf client island. See docs/02-architecture/frontend.md.",
    },
  },
  create(context) {
    const filename = normalise(context.filename ?? context.getFilename());
    if (!ROUTE_FILE.test(filename)) return {};

    return {
      Program(node) {
        for (const stmt of node.body) {
          if (
            stmt.type !== 'ExpressionStatement' ||
            stmt.expression.type !== 'Literal' ||
            typeof stmt.expression.value !== 'string'
          ) {
            break; // directives must be first; stop at the first non-directive
          }
          if (stmt.expression.value === 'use client') {
            context.report({
              node: stmt,
              messageId: 'noClientRoute',
              data: { basename: filename.split('/').pop() },
            });
          }
        }
      },
    };
  },
};
